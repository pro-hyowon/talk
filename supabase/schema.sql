-- =====================================================================
--  미니톡(MiniTalk) — Supabase 데이터베이스 설정 스크립트
--  Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 [Run] 하세요.
--  여러 번 실행해도 안전하도록(재실행 가능) 작성되어 있습니다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------

-- 회원 프로필 (가입하면 자동으로 생성됨)
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name   text not null check (char_length(display_name) between 1 and 20),
  status_message text not null default '' check (char_length(status_message) <= 60),
  avatar_url     text,
  created_at     timestamptz not null default now()
);

-- 친구 목록 (내가 추가한 친구 — 카카오톡처럼 상대 승인 없이 추가)
create table if not exists public.friends (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- 채팅방 (1:1 방은 dm_key 로 중복 생성을 막음)
create table if not exists public.rooms (
  id              uuid primary key default gen_random_uuid(),
  is_group        boolean not null default false,
  title           text check (title is null or char_length(title) <= 30),
  dm_key          text unique,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message    text,
  last_message_at timestamptz not null default now()
);

-- 채팅방 참여자 (last_read_id = 마지막으로 읽은 메시지 번호 → 읽음 표시·안 읽은 수 계산)
create table if not exists public.room_members (
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_id bigint not null default 0,
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members(user_id);

-- 메시지 (kind: text=글, image=사진, system=입장·퇴장 안내)
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  sender_id  uuid default auth.uid() references public.profiles(id) on delete set null,
  kind       text not null default 'text' check (kind in ('text', 'image', 'system')),
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_room_idx on public.messages(room_id, id desc);

-- ---------------------------------------------------------------------
-- 2. 보조 함수 (보안 정책에서 사용)
-- ---------------------------------------------------------------------

-- 내가 이 방의 참여자인가?
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members where room_id = p_room and user_id = auth.uid()
  );
$$;

-- 저장소 경로(첫 폴더 = 방 ID) 용: 문자열로 받아 안전하게 비교
create or replace function public.is_room_member_text(p_room text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members where room_id::text = p_room and user_id = auth.uid()
  );
$$;

-- 이 사람과 같은 방에 있는가?
create or replace function public.shares_room_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members a
    join room_members b on a.room_id = b.room_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------
-- 3. 가입 시 프로필 자동 생성
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  v_name     text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), v_username);
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, left(v_name, 20));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. 메시지가 올라오면: 방 미리보기 갱신 + 보낸 사람은 읽음 처리
--    + 1:1 방에서 나갔던 상대가 있으면 다시 방에 넣어 줌
-- ---------------------------------------------------------------------
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dm_key text;
begin
  update rooms
     set last_message = case new.kind when 'image' then '사진' else left(new.content, 100) end,
         last_message_at = new.created_at
   where id = new.room_id
  returning dm_key into v_dm_key;

  if new.sender_id is not null then
    update room_members
       set last_read_id = greatest(last_read_id, new.id)
     where room_id = new.room_id and user_id = new.sender_id;
  end if;

  if v_dm_key is not null then
    insert into room_members (room_id, user_id, last_read_id)
    select new.room_id, x::uuid, new.id - 1
      from unnest(string_to_array(v_dm_key, ':')) as x
     where exists (select 1 from profiles p where p.id = x::uuid)
    on conflict (room_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- ---------------------------------------------------------------------
-- 5. 앱에서 호출하는 기능(RPC)
-- ---------------------------------------------------------------------

-- 내 친구 목록
create or replace function public.my_friends()
returns table (id uuid, username text, display_name text, status_message text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.status_message, p.avatar_url
    from friends f join profiles p on p.id = f.friend_id
   where f.user_id = auth.uid()
   order by p.display_name;
$$;

-- 아이디로 사용자 찾기 (정확히 일치하는 1명만)
create or replace function public.find_user(p_username text)
returns table (id uuid, username text, display_name text, status_message text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.status_message, p.avatar_url
    from profiles p
   where auth.uid() is not null and p.username = lower(trim(p_username))
   limit 1;
$$;

-- 내 채팅방 목록 (안 읽은 수, 참여자 포함)
create or replace function public.my_rooms()
returns table (
  room_id uuid, is_group boolean, title text, last_message text,
  last_message_at timestamptz, unread integer, member_count integer, members jsonb
)
language sql stable security definer set search_path = public as $$
  select r.id, r.is_group, r.title, r.last_message, r.last_message_at,
         (select count(*)::int from messages m
           where m.room_id = r.id and m.id > me.last_read_id
             and m.kind <> 'system' and m.sender_id is distinct from auth.uid()),
         (select count(*)::int from room_members x where x.room_id = r.id),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
                     order by p.display_name)
                     from room_members x join profiles p on p.id = x.user_id
                    where x.room_id = r.id and x.user_id <> auth.uid()), '[]'::jsonb)
    from room_members me
    join rooms r on r.id = me.room_id
   where me.user_id = auth.uid()
     and (r.is_group or r.last_message is not null)
   order by r.last_message_at desc;
$$;

-- 1:1 채팅방 열기 (없으면 만들기)
create or replace function public.get_or_create_dm(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me   uuid := auth.uid();
  v_key  text;
  v_room uuid;
  v_last bigint;
begin
  if v_me is null then raise exception '로그인이 필요합니다'; end if;
  if p_other = v_me then raise exception '나와의 1:1 대화는 만들 수 없습니다'; end if;
  if not exists (select 1 from profiles where id = p_other) then
    raise exception '사용자를 찾을 수 없습니다';
  end if;

  v_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);

  insert into rooms (is_group, dm_key, created_by) values (false, v_key, v_me)
  on conflict (dm_key) do nothing
  returning id into v_room;

  if v_room is not null then
    -- 새로 만든 방: 두 사람 모두 참여
    insert into room_members (room_id, user_id) values (v_room, v_me), (v_room, p_other);
  else
    -- 기존 방: 내가 나갔었다면 다시 참여
    select id into v_room from rooms where dm_key = v_key;
    select coalesce(max(id), 0) into v_last from messages where room_id = v_room;
    insert into room_members (room_id, user_id, last_read_id) values (v_room, v_me, v_last)
    on conflict (room_id, user_id) do nothing;
  end if;

  return v_room;
end;
$$;

-- 단체방 만들기
create or replace function public.create_group(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_room  uuid;
  v_names text;
  v_mine  text;
begin
  if v_me is null then raise exception '로그인이 필요합니다'; end if;

  insert into rooms (is_group, title, created_by)
  values (true, nullif(left(trim(coalesce(p_title, '')), 30), ''), v_me)
  returning id into v_room;

  insert into room_members (room_id, user_id) values (v_room, v_me);
  insert into room_members (room_id, user_id)
  select v_room, p.id from profiles p
   where p.id = any(p_members) and p.id <> v_me
  on conflict do nothing;

  if (select count(*) from room_members where room_id = v_room) < 2 then
    raise exception '초대할 사람을 1명 이상 선택하세요';
  end if;

  select display_name into v_mine from profiles where id = v_me;
  select string_agg(p.display_name, ', ' order by p.display_name) into v_names
    from room_members m join profiles p on p.id = m.user_id
   where m.room_id = v_room and m.user_id <> v_me;

  insert into messages (room_id, sender_id, kind, content)
  values (v_room, null, 'system', left(v_mine || '님이 ' || v_names || '님을 초대했습니다.', 2000));

  return v_room;
end;
$$;

-- 단체방에 초대하기
create or replace function public.invite_to_room(p_room uuid, p_members uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_last  bigint;
  v_names text;
  v_mine  text;
begin
  if not exists (select 1 from room_members where room_id = p_room and user_id = v_me) then
    raise exception '이 방의 참여자가 아닙니다';
  end if;
  if not (select is_group from rooms where id = p_room) then
    raise exception '1:1 대화방에는 초대할 수 없습니다. 새 단체방을 만들어 주세요';
  end if;

  select coalesce(max(id), 0) into v_last from messages where room_id = p_room;

  with added as (
    insert into room_members (room_id, user_id, last_read_id)
    select p_room, p.id, v_last from profiles p where p.id = any(p_members)
    on conflict do nothing
    returning user_id
  )
  select string_agg(p.display_name, ', ' order by p.display_name) into v_names
    from added a join profiles p on p.id = a.user_id;

  if v_names is not null then
    select display_name into v_mine from profiles where id = v_me;
    insert into messages (room_id, sender_id, kind, content)
    values (p_room, null, 'system', left(v_mine || '님이 ' || v_names || '님을 초대했습니다.', 2000));
  end if;
end;
$$;

-- 채팅방 나가기
create or replace function public.leave_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_group boolean;
  v_mine  text;
begin
  delete from room_members where room_id = p_room and user_id = v_me;
  if not found then return; end if;

  if not exists (select 1 from room_members where room_id = p_room) then
    delete from rooms where id = p_room;   -- 아무도 없으면 방과 메시지 삭제
    return;
  end if;

  select is_group into v_group from rooms where id = p_room;
  if v_group then
    select display_name into v_mine from profiles where id = v_me;
    insert into messages (room_id, sender_id, kind, content)
    values (p_room, null, 'system', v_mine || '님이 나갔습니다.');
  end if;
end;
$$;

-- 읽음 처리 (방에 들어와 있을 때 호출)
create or replace function public.mark_read(p_room uuid)
returns void language sql security definer set search_path = public as $$
  update room_members
     set last_read_id = greatest(last_read_id,
           (select coalesce(max(id), 0) from messages where room_id = p_room))
   where room_id = p_room and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 6. 보안 정책 (Row Level Security) — 본인·참여자만 볼 수 있게
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.friends      enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.messages     enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = profiles.id)
    or public.shares_room_with(id)
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "friends_select_own" on public.friends;
create policy "friends_select_own" on public.friends for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "friends_insert_own" on public.friends;
create policy "friends_insert_own" on public.friends for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "friends_delete_own" on public.friends;
create policy "friends_delete_own" on public.friends for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "rooms_select_member" on public.rooms;
create policy "rooms_select_member" on public.rooms for select to authenticated
  using (public.is_room_member(id));

drop policy if exists "room_members_select" on public.room_members;
create policy "room_members_select" on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'image')
    and public.is_room_member(room_id)
  );

-- 권한 (보안 정책이 실제 접근 범위를 제한함)
grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.friends to authenticated;
grant select on public.rooms to authenticated;
grant select on public.room_members to authenticated;
grant select, insert on public.messages to authenticated;

revoke execute on function public.my_friends()                   from public, anon;
revoke execute on function public.find_user(text)                from public, anon;
revoke execute on function public.my_rooms()                     from public, anon;
revoke execute on function public.get_or_create_dm(uuid)         from public, anon;
revoke execute on function public.create_group(text, uuid[])     from public, anon;
revoke execute on function public.invite_to_room(uuid, uuid[])   from public, anon;
revoke execute on function public.leave_room(uuid)               from public, anon;
revoke execute on function public.mark_read(uuid)                from public, anon;
grant execute on function public.my_friends()                    to authenticated;
grant execute on function public.find_user(text)                 to authenticated;
grant execute on function public.my_rooms()                      to authenticated;
grant execute on function public.get_or_create_dm(uuid)          to authenticated;
grant execute on function public.create_group(text, uuid[])      to authenticated;
grant execute on function public.invite_to_room(uuid, uuid[])    to authenticated;
grant execute on function public.leave_room(uuid)                to authenticated;
grant execute on function public.mark_read(uuid)                 to authenticated;
grant execute on function public.is_room_member(uuid)            to authenticated;
grant execute on function public.is_room_member_text(text)       to authenticated;
grant execute on function public.shares_room_with(uuid)          to authenticated;

-- ---------------------------------------------------------------------
-- 7. 사진 저장소 (프로필 사진: 공개 / 채팅 사진: 방 참여자만)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "minitalk_avatar_insert" on storage.objects;
create policy "minitalk_avatar_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "minitalk_avatar_delete" on storage.objects;
create policy "minitalk_avatar_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "minitalk_chat_insert" on storage.objects;
create policy "minitalk_chat_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and public.is_room_member_text((storage.foldername(name))[1]));

drop policy if exists "minitalk_chat_select" on storage.objects;
create policy "minitalk_chat_select" on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and public.is_room_member_text((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------
-- 8. 실시간(Realtime) 전송 대상 등록
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.room_members;
  exception when duplicate_object then null;
  end;
end;
$$;

-- 끝. "Success. No rows returned" 가 나오면 정상입니다.
