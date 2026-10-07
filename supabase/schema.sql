-- =====================================================================
--  미니톡(MiniTalk) v1.14 — Supabase 데이터베이스 설정 스크립트
--  Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 [Run] 하세요.
--  여러 번 실행해도 안전합니다. 이전 버전을 이미 설치했다면 이 파일을
--  다시 실행하면 기존 회원·대화는 그대로 두고 새 기능만 추가됩니다.
--
--  ★ 맨 아래 [관리자 지정] 의 'YOUR_ADMIN_ID' 를 내 아이디로 바꾸고 실행하세요.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

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
-- v1.2 추가: 관리자 여부, 회원 상태(active=사용 중, pending=승인 대기, suspended=정지), 최근 접속
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists last_seen_at timestamptz;
do $$ begin
  alter table public.profiles add constraint profiles_status_check check (status in ('active', 'pending', 'suspended'));
exception when duplicate_object then null;
end $$;

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
-- v1.2 추가: 공지사항 방 (관리자만 글쓰기, 하나만 존재)
alter table public.rooms add column if not exists is_notice boolean not null default false;
create unique index if not exists rooms_single_notice on public.rooms (is_notice) where is_notice;

-- 채팅방 참여자 (last_read_id = 마지막으로 읽은 메시지 번호 → 읽음 표시·안 읽은 수 계산)
create table if not exists public.room_members (
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_id bigint not null default 0,
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members(user_id);
-- v1.12: 이 번호보다 큰 메시지만 보임 (나갔다가 다시 들어오거나 나중에 초대된 사람은 들어온 뒤의 대화만)
--        -1 = 처음부터 전부 (기존 참여자·공지방)
alter table public.room_members add column if not exists history_from bigint not null default -1;

-- 메시지 (kind: text=글, image=사진, sticker=이모티콘, file=파일, contact=연락처, system=입장·퇴장 안내)
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  sender_id  uuid default auth.uid() references public.profiles(id) on delete set null,
  kind       text not null default 'text' check (kind in ('text', 'image', 'sticker', 'file', 'contact', 'system', 'deleted')),
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_room_idx on public.messages(room_id, id desc);
-- v1.6: 회원 삭제·정리 때 빠르게 찾도록 (연결된 데이터 인덱스)
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists friends_friend_idx on public.friends(friend_id);
create index if not exists rooms_created_by_idx on public.rooms(created_by);
-- v1.5 추가: 이모티콘 메시지 (content = 이모티콘 이름)
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'sticker', 'file', 'contact', 'system', 'deleted'));
-- v1.8: 삭제한 메시지 (kind = 'deleted' 로 바뀌고 내용은 지워짐)
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages drop constraint if exists messages_sticker_check;
alter table public.messages add constraint messages_sticker_check check (kind <> 'sticker' or content ~ '^[a-z0-9_]{1,30}$');

-- v1.10: 파일·연락처 메시지 (content = JSON)
--   파일   {"path":"<방ID>/<내ID>-…","name":"원래 파일 이름","size":바이트,"type":"형식"}
--   연락처 {"name":"이름","phones":["01012345678"]}
create or replace function public.valid_file_msg(p_content text, p_room uuid, p_sender uuid)
returns boolean language plpgsql immutable as $$
declare
  j jsonb;
begin
  j := p_content::jsonb;
  return jsonb_typeof(j) = 'object'
     and coalesce(j->>'path', '') ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,80}$'
     and split_part(j->>'path', '/', 1) = p_room::text
     and (p_sender is null or split_part(j->>'path', '/', 2) like p_sender::text || '-%')
     and char_length(coalesce(j->>'name', '')) between 1 and 200
     and jsonb_typeof(j->'size') = 'number';
exception when others then
  return false;
end;
$$;

create or replace function public.valid_contact_msg(p_content text)
returns boolean language plpgsql immutable as $$
declare
  j jsonb;
begin
  j := p_content::jsonb;
  return jsonb_typeof(j) = 'object'
     and char_length(trim(coalesce(j->>'name', ''))) between 1 and 60
     and jsonb_typeof(j->'phones') = 'array'
     and jsonb_array_length(j->'phones') between 1 and 5
     and not exists (select 1 from jsonb_array_elements(j->'phones') e
                      where jsonb_typeof(e) <> 'string' or (e #>> '{}') !~ '^\+?[0-9]{3,20}$');
exception when others then
  return false;
end;
$$;

-- v1.11: 답장 (어느 메시지에 대한 답장인지)
alter table public.messages add column if not exists reply_to bigint references public.messages(id) on delete set null;

-- v1.11: 공감 (메시지마다 한 사람당 하나: 하트·좋아요·웃음·놀람·슬픔·체크)
create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('heart', 'like', 'laugh', 'wow', 'sad', 'check')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_reactions_room_idx on public.message_reactions(room_id, message_id);
create index if not exists message_reactions_user_idx on public.message_reactions(user_id);

alter table public.messages drop constraint if exists messages_file_check;
drop index if exists public.messages_media_idx;
alter table public.messages add constraint messages_file_check check (
  case when kind = 'file' then public.valid_file_msg(content, room_id, sender_id)
       when kind = 'contact' then public.valid_contact_msg(content)
       else true end);
-- v1.12: 사진·파일 권한 확인을 빠르게 (메시지에 담긴 파일 경로로 찾기)
create index if not exists messages_media_idx on public.messages
  (room_id, (case when kind = 'file' then content::jsonb ->> 'path' else content end))
  where kind in ('image', 'file');

-- v1.5 추가: 휴대폰 번호 (본인과 관리자만 볼 수 있음. findable = 번호로 나를 찾을 수 있게 허용)
create table if not exists public.user_phones (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  phone      text not null unique check (phone ~ '^01[016789][0-9]{7,8}$'),
  findable   boolean not null default true,
  updated_at timestamptz not null default now()
);

-- v1.5 추가: 추천 친구 (내 연락처와 번호가 일치한 회원. contact_name = 내 연락처에 저장된 이름)
create table if not exists public.friend_suggestions (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  suggested_id uuid not null references public.profiles(id) on delete cascade,
  contact_name text check (contact_name is null or char_length(contact_name) <= 40),
  dismissed    boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (user_id, suggested_id),
  check (user_id <> suggested_id)
);
create index if not exists friend_suggestions_suggested_idx on public.friend_suggestions(suggested_id);

-- 앱 운영 설정 (사용자에게는 보이지 않는 별도 공간)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_settings (
  id               int primary key default 1 check (id = 1),
  require_approval boolean not null default false   -- true: 새로 가입하면 관리자 승인 후 사용
);
insert into private.app_settings (id) values (1) on conflict (id) do nothing;
revoke all on private.app_settings from public, anon, authenticated;

-- 번호 조회 하루 사용량 (다른 사람 번호를 마구 대입해 보는 것을 막음)
create table if not exists private.lookup_quota (
  user_id uuid not null,
  day     date not null default current_date,
  used    integer not null default 0,
  primary key (user_id, day)
);
revoke all on private.lookup_quota from public, anon, authenticated;

-- v1.7: 친구 요청 알림 기록 (같은 사람에게 하루 한 번만 알림 — 친구 추가·삭제 반복으로 알림 도배 방지)
create table if not exists private.friend_request_log (
  from_id uuid not null,
  to_id   uuid not null,
  sent_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
revoke all on private.friend_request_log from public, anon, authenticated;

-- v1.12: 마지막 사람이 나가 없어진 방의 사진·파일을 그 사람이 지울 수 있게 잠깐(10분) 허락
create table if not exists private.room_cleanup (
  room_id uuid not null,
  user_id uuid not null,
  at      timestamptz not null default now(),
  primary key (room_id, user_id)
);
revoke all on private.room_cleanup from public, anon, authenticated;

-- v1.14: 친구 초대 링크·QR 코드 (회원마다 하나, 새로 만들면 예전 링크는 더 이상 안 됨)
create table if not exists private.invite_codes (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  code       text not null unique check (code ~ '^[a-z0-9]{10,20}$'),
  created_at timestamptz not null default now()
);
revoke all on private.invite_codes from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. 보조 함수 (보안 정책에서 사용)
-- ---------------------------------------------------------------------

-- 내 계정이 사용 가능한 상태인가? (승인 대기·정지면 false)
create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

-- 이 회원이 사용 중인 상태인가?
create or replace function public.is_active_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and status = 'active');
$$;

-- 내가 관리자인가?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin and status = 'active');
$$;

-- 내가 이 방의 참여자인가? (사용 가능한 계정일 때만)
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members m join profiles p on p.id = m.user_id
     where m.room_id = p_room and m.user_id = auth.uid() and p.status = 'active'
  );
$$;

-- 저장소 경로(첫 폴더 = 방 ID) 용: 문자열로 받아 안전하게 비교
create or replace function public.is_room_member_text(p_room text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members m join profiles p on p.id = m.user_id
     where m.room_id::text = p_room and m.user_id = auth.uid() and p.status = 'active'
  );
$$;

-- v1.12: 이 메시지를 볼 수 있나? (참여자이고, 내가 들어온 뒤의 메시지)
create or replace function public.can_see_message(p_room uuid, p_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members m join profiles p on p.id = m.user_id
     where m.room_id = p_room and m.user_id = auth.uid() and p.status = 'active' and p_id > m.history_from
  );
$$;

-- v1.12: 채팅 사진·파일을 볼 수 있나? (내가 볼 수 있는 메시지에 담긴 파일이거나, 내가 올린 파일)
create or replace function public.can_read_chat_object(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members m
      join profiles p on p.id = m.user_id and p.status = 'active'
      join messages g on g.room_id = m.room_id
     where m.user_id = auth.uid()
       and m.room_id::text = split_part(p_name, '/', 1)
       and g.kind in ('image', 'file')
       and (case when g.kind = 'file' then g.content::jsonb ->> 'path' else g.content end) = p_name
       and g.id > m.history_from
  ) or (
    split_part(p_name, '/', 2) like auth.uid()::text || '-%'
    and public.is_room_member_text(split_part(p_name, '/', 1))
  );
$$;

-- v1.12: 내가 방금 비운 방의 파일인가? (마지막으로 나간 사람이 10분 안에 정리)
create or replace function public.can_cleanup_folder(p_folder text)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from private.room_cleanup c
     where c.room_id::text = p_folder and c.user_id = auth.uid() and c.at > now() - interval '10 minutes'
  ) and not exists (select 1 from rooms r where r.id::text = p_folder);
$$;

-- v1.12: 없어진 방에 남은 파일인가? (관리자 정리용)
create or replace function public.is_orphan_folder(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and not exists (select 1 from rooms r where r.id::text = p_folder);
$$;

-- 이 사람과 같은 방에 있는가?
create or replace function public.shares_room_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active() and exists (
    select 1 from room_members a
    join room_members b on a.room_id = b.room_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- 공지 방인가?
create or replace function public.is_notice_room(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_notice from rooms where id = p_room), false);
$$;

-- 서로 친구인가? (둘 다 상대를 친구로 추가한 상태)
create or replace function public.is_mutual_friend(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friends where user_id = p_a and friend_id = p_b)
     and exists (select 1 from friends where user_id = p_b and friend_id = p_a);
$$;

-- 이 방에 글을 쓸 수 있는가? (참여자여야 하고, 1:1 방은 서로 친구일 때만, 공지 방은 불가)
create or replace function public.can_post(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_room_member(p_room) and coalesce((
    select case
             when r.is_notice then false
             when r.dm_key is null then true
             else public.is_mutual_friend(auth.uid(), (
                    select x::uuid from unnest(string_to_array(r.dm_key, ':')) as x
                     where x <> auth.uid()::text limit 1))
           end
      from rooms r where r.id = p_room), false);
$$;

-- 저장소 경로용: 문자열을 안전하게 확인
create or replace function public.can_post_text(p_room text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_room ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then public.can_post(p_room::uuid) else false end;
$$;

-- 휴대폰 번호 정리: 숫자만 남기고 +82 를 0 으로 (휴대폰 번호가 아니면 null)
create or replace function public.norm_phone(p text)
returns text language sql immutable set search_path = public as $$
  select case when d ~ '^01[016789][0-9]{7,8}$' then d end
    from (select case when x like '8201%' then substr(x, 3)
                      when x like '821%'  then '0' || substr(x, 3)
                      else x end as d
            from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as x) a) b;
$$;

-- 번호 조회 사용량 차감 (하루 3000건까지)
create or replace function public.use_lookup_quota(p_n integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_used integer;
begin
  insert into private.lookup_quota (user_id, day, used) values (auth.uid(), current_date, greatest(p_n, 0))
  on conflict (user_id, day) do update set used = private.lookup_quota.used + excluded.used
  returning used into v_used;
  if v_used > 3000 then
    raise exception '오늘은 더 이상 번호를 확인할 수 없어요. 내일 다시 시도해 주세요';
  end if;
  delete from private.lookup_quota where day < current_date - 1;
end;
$$;

-- 공지 방에 회원 추가 (공지 방이 있을 때만, 지난 공지는 읽은 것으로 처리)
create or replace function public.join_notice_room(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room uuid;
begin
  select id into v_room from rooms where is_notice;
  if v_room is null then return; end if;
  insert into room_members (room_id, user_id, last_read_id)
  values (v_room, p_user, (select coalesce(max(id), 0) from messages where room_id = v_room))
  on conflict (room_id, user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. 가입 시 프로필 자동 생성 (승인제가 켜져 있으면 '승인 대기'로)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  v_name     text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), v_username);
  v_status   text := case when coalesce((select require_approval from private.app_settings where id = 1), false)
                          then 'pending' else 'active' end;
begin
  insert into public.profiles (id, username, display_name, status)
  values (new.id, v_username, left(v_name, 20), v_status);
  if v_status = 'active' then perform public.join_notice_room(new.id); end if;
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
     set last_message = case new.kind when 'image' then '사진' when 'sticker' then '이모티콘'
                                      when 'file' then '파일' when 'contact' then '연락처' else left(new.content, 100) end,
         last_message_at = new.created_at
   where id = new.room_id
  returning dm_key into v_dm_key;

  if new.sender_id is not null then
    update room_members
       set last_read_id = greatest(last_read_id, new.id)
     where room_id = new.room_id and user_id = new.sender_id;
  end if;

  if v_dm_key is not null then
    insert into room_members (room_id, user_id, last_read_id, history_from)
    select new.room_id, x::uuid, new.id - 1, new.id - 1   -- 다시 들어온 사람은 이 메시지부터 보임
      from unnest(string_to_array(v_dm_key, ':')) as x
     where exists (select 1 from profiles p where p.id::text = x)
    on conflict (room_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- 친구로 추가하면 추천 목록에서 정리
-- v1.7: 상대가 아직 나를 추가하지 않았으면 → 상대에게 "친구 요청" 알림 (앱 안 + 앱을 닫아도 오는 알림)
create or replace function public.on_friend_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from friend_suggestions where user_id = new.user_id and suggested_id = new.friend_id;
  if not exists (select 1 from friends where user_id = new.friend_id and friend_id = new.user_id) then
    perform public.notify_friend_request(new.user_id, new.friend_id);
  end if;
  return new;
end;
$$;

create or replace function public.notify_friend_request(p_from uuid, p_to uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_user    text;
  v_url     text;
  v_secret  text;
  v_preview boolean;
  v_subs    jsonb;
begin
  -- 하루에 한 번만
  if exists (select 1 from private.friend_request_log
              where from_id = p_from and to_id = p_to and sent_at > now() - interval '1 day') then
    return;
  end if;
  insert into private.friend_request_log (from_id, to_id, sent_at) values (p_from, p_to, now())
  on conflict (from_id, to_id) do update set sent_at = excluded.sent_at;

  select display_name, username into v_name, v_user from profiles where id = p_from;

  -- 앱이 열려 있으면 바로 표시 (실시간)
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    begin
      perform realtime.send(jsonb_build_object('from_id', p_from, 'display_name', v_name, 'username', v_user),
                            'friend', 'user:' || p_to::text, true);
    exception when others then null;
    end;
  end if;

  -- 앱을 닫아도 오는 알림 (push-setup.sql 설정을 마친 경우)
  if to_regclass('private.push_config') is null then return; end if;
  select function_url, secret, show_preview into v_url, v_secret, v_preview from private.push_config where id = 1;
  if v_url is null or v_url like '%YOUR_PROJECT_REF%' then return; end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into v_subs
    from push_subscriptions s join profiles p on p.id = s.user_id and p.status = 'active'
   where s.user_id = p_to;
  if v_subs is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('subs', v_subs, 'title', '친구 요청',
              'body', case when coalesce(v_preview, true)
                           then coalesce(v_name, '누군가') || '님이 나를 친구로 추가했어요. 나도 추가하면 대화할 수 있어요.'
                           else '새 친구 요청이 있어요.' end),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 8000
  );
exception when others then
  raise warning 'notify_friend_request 실패: %', sqlerrm;   -- 알림 문제로 친구 추가가 막히면 안 됨
end;
$$;
drop trigger if exists friends_after_insert on public.friends;
create trigger friends_after_insert
  after insert on public.friends
  for each row execute function public.on_friend_insert();

-- 새 메시지 알림 (앱을 닫아도 오는 알림) — push-setup.sql 로 알림 설정을 마친 경우에만 동작
--   알림 설정 전에는 이 함수가 쓰이지 않아요.
create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url     text;
  v_secret  text;
  v_preview boolean;
  v_subs    jsonb;
  v_name    text;
  v_room    rooms%rowtype;
  v_title   text;
  v_body    text;
begin
  if new.kind = 'system' or new.sender_id is null then return new; end if;
  if to_regclass('private.push_config') is null then return new; end if;

  select function_url, secret, show_preview into v_url, v_secret, v_preview from private.push_config where id = 1;
  if v_url is null or v_url like '%YOUR_PROJECT_REF%' then return new; end if;

  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into v_subs
    from push_subscriptions s
    join room_members m on m.user_id = s.user_id and m.room_id = new.room_id
    join profiles p on p.id = s.user_id and p.status = 'active'
   where s.user_id <> new.sender_id;
  if v_subs is null then return new; end if;

  select display_name into v_name from profiles where id = new.sender_id;
  select * into v_room from rooms where id = new.room_id;

  v_title := coalesce(v_name, '새 메시지');
  if v_room.is_notice then v_title := '미니톡 공지사항';
  elsif v_room.is_group then v_title := v_title || ' · ' || coalesce(v_room.title, '단체방'); end if;

  if not coalesce(v_preview, true) then
    v_title := '미니톡';
    v_body  := '새 메시지가 도착했어요.';
  elsif new.kind = 'image' then
    v_body := '사진을 보냈어요.';
  elsif new.kind = 'sticker' then
    v_body := '이모티콘을 보냈어요.';
  elsif new.kind = 'file' then
    v_body := '파일을 보냈어요.';
  elsif new.kind = 'contact' then
    v_body := '연락처를 보냈어요.';
  else
    v_body := left(new.content, 120);
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'subs', v_subs, 'title', v_title, 'body', v_body,
      'room_id', new.room_id, 'message_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  -- 알림 발송 문제로 메시지 전송이 막히면 안 되므로 오류는 무시
  raise warning 'notify_push 실패: %', sqlerrm;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. 앱에서 호출하는 기능(RPC)
-- ---------------------------------------------------------------------

-- 내 친구 목록 (사용 중인 회원만, mutual = 상대도 나를 친구로 추가했는지)
drop function if exists public.my_friends();
create function public.my_friends()
returns table (id uuid, username text, display_name text, status_message text, avatar_url text, mutual boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.status_message, p.avatar_url,
         exists (select 1 from friends b where b.user_id = p.id and b.friend_id = auth.uid())
    from friends f join profiles p on p.id = f.friend_id
   where f.user_id = auth.uid() and public.is_active() and p.status = 'active'
   order by p.display_name;
$$;

-- 아이디 또는 휴대폰 번호로 사용자 찾기 (정확히 일치하는 1명, 사용 중인 회원만)
--   번호는 '번호로 나를 찾을 수 있게' 를 켜 둔 회원만 찾을 수 있어요.
create or replace function public.find_user(p_username text)
returns table (id uuid, username text, display_name text, status_message text, avatar_url text)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_phone text := public.norm_phone(p_username);
begin
  if not public.is_active() then return; end if;
  if v_phone is not null then
    perform public.use_lookup_quota(1);
    return query
      select p.id, p.username, p.display_name, p.status_message, p.avatar_url
        from user_phones up join profiles p on p.id = up.user_id
       where up.phone = v_phone and (up.findable or up.user_id = auth.uid()) and p.status = 'active'
       limit 1;
  else
    return query
      select p.id, p.username, p.display_name, p.status_message, p.avatar_url
        from profiles p
       where p.status = 'active' and p.username = lower(trim(both '@ ' from p_username))
       limit 1;
  end if;
end;
$$;

-- 내 휴대폰 번호 보기
create or replace function public.get_my_phone()
returns table (phone text, findable boolean)
language sql stable security definer set search_path = public as $$
  select phone, findable from user_phones where user_id = auth.uid();
$$;

-- 내 휴대폰 번호 등록·변경 (빈 값이면 삭제). 승인 대기 중에도 등록 가능
create or replace function public.set_my_phone(p_phone text, p_findable boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_phone text := public.norm_phone(p_phone);
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from profiles where id = v_me and status <> 'suspended') then
    raise exception '사용할 수 없는 계정이에요';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    delete from user_phones where user_id = v_me;
    return null;
  end if;
  if v_phone is null then raise exception '휴대폰 번호를 정확히 입력해 주세요 (예: 010-1234-5678)'; end if;
  perform public.use_lookup_quota(20);
  if exists (select 1 from user_phones where phone = v_phone and user_id <> v_me) then
    raise exception '이미 다른 계정에 등록된 번호예요. 내 번호가 맞다면 관리자에게 문의해 주세요';
  end if;
  insert into user_phones (user_id, phone, findable) values (v_me, v_phone, coalesce(p_findable, true))
  on conflict (user_id) do update set phone = excluded.phone, findable = excluded.findable, updated_at = now();
  return v_phone;
end;
$$;

-- '번호로 나를 찾을 수 있게' 켜기·끄기
create or replace function public.set_phone_findable(p_on boolean)
returns void language sql security definer set search_path = public as $$
  update user_phones set findable = coalesce(p_on, true), updated_at = now() where user_id = auth.uid();
$$;

-- 내 연락처 번호와 일치하는 회원을 추천 친구에 추가 → 일치한 사람 수
--   연락처 번호 자체는 저장하지 않아요 (일치한 회원만 기록)
create or replace function public.match_contacts(p_phones text[], p_names text[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_n  integer;
begin
  if not public.is_active() then raise exception '사용할 수 없는 계정이에요'; end if;
  if coalesce(cardinality(p_phones), 0) = 0 then return 0; end if;
  if cardinality(p_phones) > 1000 then raise exception '연락처는 한 번에 1000개까지 확인할 수 있어요'; end if;
  perform public.use_lookup_quota(cardinality(p_phones));

  with c as (
    select distinct on (public.norm_phone(ph)) public.norm_phone(ph) as phone,
           nullif(left(trim(p_names[i]), 40), '') as nm
      from unnest(p_phones) with ordinality as t(ph, i)
     where public.norm_phone(ph) is not null
     order by public.norm_phone(ph), i
  ), hit as (
    insert into friend_suggestions (user_id, suggested_id, contact_name)
    select v_me, up.user_id, c.nm
      from c join user_phones up on up.phone = c.phone and up.findable
      join profiles p on p.id = up.user_id and p.status = 'active'
     where up.user_id <> v_me
    on conflict (user_id, suggested_id) do update
      set contact_name = coalesce(excluded.contact_name, friend_suggestions.contact_name)
    returning suggested_id
  )
  select count(*)::int into v_n from hit
   where not exists (select 1 from friends f where f.user_id = v_me and f.friend_id = hit.suggested_id);
  return v_n;
end;
$$;

-- v1.9: 연락처 확인 — 고른 번호마다 결과(가입한 회원·이미 친구 여부)를 돌려줌
--        번호를 등록하고 검색을 허용한 활동 중인 회원만 나오고, 나머지 번호는 결과에 없음
create or replace function public.match_contacts_detail(p_phones text[], p_names text[] default null)
returns table (phone text, id uuid, username text, display_name text, status_message text,
               avatar_url text, is_friend boolean, added_me boolean)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
begin
  if not public.is_active() then raise exception '사용할 수 없는 계정이에요'; end if;
  if coalesce(cardinality(p_phones), 0) = 0 then return; end if;
  if cardinality(p_phones) > 1000 then raise exception '연락처는 한 번에 1000개까지 확인할 수 있어요'; end if;
  perform public.use_lookup_quota(cardinality(p_phones));

  -- 아직 친구가 아닌 사람은 추천 친구에도 넣어 둠
  insert into friend_suggestions (user_id, suggested_id, contact_name)
  select distinct on (up.user_id) v_me, up.user_id, nullif(left(trim(p_names[t.i]), 40), '')
    from unnest(p_phones) with ordinality as t(ph, i)
    join user_phones up on up.phone = public.norm_phone(t.ph) and up.findable
    join profiles p on p.id = up.user_id and p.status = 'active'
   where up.user_id <> v_me
     and not exists (select 1 from friends f where f.user_id = v_me and f.friend_id = up.user_id)
   order by up.user_id, t.i
  on conflict (user_id, suggested_id) do update
    set contact_name = coalesce(excluded.contact_name, friend_suggestions.contact_name);

  return query
    select distinct on (up.phone) up.phone, p.id, p.username, p.display_name, p.status_message, p.avatar_url,
           exists (select 1 from friends f where f.user_id = v_me and f.friend_id = p.id),
           exists (select 1 from friends b where b.user_id = p.id and b.friend_id = v_me)
      from unnest(p_phones) as t(ph)
      join user_phones up on up.phone = public.norm_phone(t.ph) and up.findable
      join profiles p on p.id = up.user_id and p.status = 'active'
     where up.user_id <> v_me
     order by up.phone;
end;
$$;

-- 추천 친구 목록 (아직 친구가 아니고, 숨기지 않은 사람. added_me = 상대가 이미 나를 친구로 추가함)
create or replace function public.my_suggestions()
returns table (id uuid, username text, display_name text, status_message text, avatar_url text,
               contact_name text, added_me boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.status_message, p.avatar_url, s.contact_name,
         exists (select 1 from friends b where b.user_id = p.id and b.friend_id = auth.uid())
    from friend_suggestions s join profiles p on p.id = s.suggested_id
   where s.user_id = auth.uid() and not s.dismissed and public.is_active() and p.status = 'active'
     and not exists (select 1 from friends f where f.user_id = auth.uid() and f.friend_id = p.id)
     -- 그 사이 상대가 번호 검색을 막았으면 추천에서도 빠짐
     and exists (select 1 from user_phones up where up.user_id = p.id and up.findable)
   order by s.created_at desc, p.display_name;
$$;

-- 추천 친구 숨기기
create or replace function public.dismiss_suggestion(p_user uuid)
returns void language sql security definer set search_path = public as $$
  update friend_suggestions set dismissed = true where user_id = auth.uid() and suggested_id = p_user;
$$;

-- v1.7: 받은 친구 요청 (나를 친구로 추가했지만 나는 아직 추가하지 않은 사람, 숨긴 요청 제외)
create or replace function public.my_friend_requests()
returns table (id uuid, username text, display_name text, status_message text, avatar_url text, requested_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.status_message, p.avatar_url, f.created_at
    from friends f join profiles p on p.id = f.user_id
   where f.friend_id = auth.uid() and (select public.is_active()) and p.status = 'active'
     and not exists (select 1 from friends m where m.user_id = auth.uid() and m.friend_id = p.id)
     and not exists (select 1 from friend_suggestions s
                      where s.user_id = auth.uid() and s.suggested_id = p.id and s.dismissed)
   order by f.created_at desc
   limit 200;
$$;

-- 친구 요청 숨기기 (상대에게는 알리지 않음)
create or replace function public.dismiss_request(p_user uuid)
returns void language sql security definer set search_path = public as $$
  insert into friend_suggestions (user_id, suggested_id, dismissed)
  select auth.uid(), p_user, true
   where auth.uid() is not null and auth.uid() <> p_user and exists (select 1 from profiles where id = p_user)
  on conflict (user_id, suggested_id) do update set dismissed = true;
$$;

-- 내 채팅방 목록 (안 읽은 수, 참여자 미리보기 4명까지)
--   안 읽은 수는 300까지만 셈 (화면에는 99+ 로 보이므로 그 이상 셀 필요 없음)
drop function if exists public.my_rooms();
create function public.my_rooms()
returns table (
  room_id uuid, is_group boolean, is_notice boolean, title text, last_message text,
  last_message_at timestamptz, unread integer, member_count integer, members jsonb
)
language sql stable security definer set search_path = public as $$
  select r.id, r.is_group, r.is_notice, r.title,
         -- 다시 들어오기 전의 마지막 대화는 미리보기에도 안 보임
         case when me.history_from >= 0 and r.last_message_at < me.joined_at then null else r.last_message end,
         r.last_message_at,
         (select count(*)::int from (
            select 1 from messages m
             where m.room_id = r.id and m.id > me.last_read_id
               and m.kind not in ('system', 'deleted') and m.sender_id is distinct from (select auth.uid())
             limit 300) u),
         (select count(*)::int from room_members x where x.room_id = r.id),
         case when r.is_notice then '[]'::jsonb else
         coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'display_name', q.display_name, 'avatar_url', q.avatar_url)
                                    order by q.display_name)
                     from (select p.id, p.display_name, p.avatar_url
                             from room_members x join profiles p on p.id = x.user_id
                            where x.room_id = r.id and x.user_id <> (select auth.uid())
                            order by p.display_name limit 4) q), '[]'::jsonb) end
    from room_members me
    join rooms r on r.id = me.room_id
   where me.user_id = (select auth.uid()) and (select public.is_active())
     and (r.is_group or r.last_message is not null)
     -- 1:1 방은 내가 친구로 추가한 사람과의 방만 보임 (모르는 사람의 방은 숨김)
     and (r.dm_key is null or exists (
           select 1 from friends f
            where f.user_id = (select auth.uid()) and f.friend_id::text = any (string_to_array(r.dm_key, ':'))))
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
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  if not public.is_active() then raise exception '사용할 수 없는 계정이에요'; end if;
  if p_other = v_me then raise exception '나와의 1:1 대화는 만들 수 없어요'; end if;
  if not exists (select 1 from profiles where id = p_other and status = 'active') then
    raise exception '대화할 수 없는 사용자예요';
  end if;
  if not public.is_mutual_friend(v_me, p_other) then
    raise exception '서로 친구가 되어야 대화할 수 있어요. 상대방도 나를 친구로 추가해야 해요';
  end if;

  v_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);

  insert into rooms (is_group, dm_key, created_by) values (false, v_key, v_me)
  on conflict (dm_key) do nothing
  returning id into v_room;

  if v_room is not null then
    insert into room_members (room_id, user_id) values (v_room, v_me), (v_room, p_other);
  else
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
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  if not public.is_active() then raise exception '사용할 수 없는 계정이에요'; end if;

  insert into rooms (is_group, title, created_by)
  values (true, nullif(left(trim(coalesce(p_title, '')), 30), ''), v_me)
  returning id into v_room;

  insert into room_members (room_id, user_id) values (v_room, v_me);
  insert into room_members (room_id, user_id)
  select v_room, p.id from profiles p
   where p.id = any(p_members) and p.id <> v_me and p.status = 'active'
     and public.is_mutual_friend(v_me, p.id)
  on conflict do nothing;

  if (select count(*) from room_members where room_id = v_room) < 2 then
    raise exception '서로 친구인 사람만 초대할 수 있어요';
  end if;

  select display_name into v_mine from profiles where id = v_me;
  select string_agg(p.display_name, ', ' order by p.display_name) into v_names
    from room_members m join profiles p on p.id = m.user_id
   where m.room_id = v_room and m.user_id <> v_me;

  insert into messages (room_id, sender_id, kind, content)
  values (v_room, null, 'system', left(v_mine || '님이 ' || v_names || '님을 초대했어요.', 2000));

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
  if not public.is_room_member(p_room) then
    raise exception '이 방의 참여자가 아니에요';
  end if;
  if public.is_notice_room(p_room) then
    raise exception '공지사항 방에는 초대할 수 없어요';
  end if;
  if not (select is_group from rooms where id = p_room) then
    raise exception '1:1 대화방에는 초대할 수 없어요. 새 단체방을 만들어 주세요';
  end if;

  select coalesce(max(id), 0) into v_last from messages where room_id = p_room;

  with added as (
    insert into room_members (room_id, user_id, last_read_id)
    select p_room, p.id, v_last from profiles p
     where p.id = any(p_members) and p.status = 'active' and public.is_mutual_friend(v_me, p.id)
    on conflict do nothing
    returning user_id
  )
  select string_agg(p.display_name, ', ' order by p.display_name) into v_names
    from added a join profiles p on p.id = a.user_id;

  if v_names is not null then
    select display_name into v_mine from profiles where id = v_me;
    insert into messages (room_id, sender_id, kind, content)
    values (p_room, null, 'system', left(v_mine || '님이 ' || v_names || '님을 초대했어요.', 2000));
  elsif coalesce(cardinality(p_members), 0) > 0 then
    raise exception '서로 친구인 사람만 초대할 수 있어요';
  end if;
end;
$$;

-- 채팅방 나가기
drop function if exists public.leave_room(uuid);
create function public.leave_room(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_group boolean;
  v_mine  text;
  v_files jsonb := '[]'::jsonb;
begin
  if public.is_notice_room(p_room) then raise exception '공지사항 방은 나갈 수 없어요'; end if;

  delete from room_members where room_id = p_room and user_id = v_me;
  if not found then return jsonb_build_object('left', false); end if;

  if not exists (select 1 from room_members where room_id = p_room) then
    -- 아무도 없으면 방과 메시지·공감 삭제 + 사진·파일 목록을 돌려줘서 앱이 저장 공간에서도 지움
    begin
      select coalesce(jsonb_agg(jsonb_build_object('b', o.bucket_id, 'n', o.name)), '[]'::jsonb) into v_files
        from storage.objects o
       where o.bucket_id in ('chat-images', 'chat-files') and o.name like p_room::text || '/%';
      if jsonb_array_length(v_files) > 0 then
        insert into private.room_cleanup (room_id, user_id, at) values (p_room, v_me, now())
        on conflict (room_id, user_id) do update set at = excluded.at;
      end if;
      delete from private.room_cleanup where at < now() - interval '1 day';
    exception when others then v_files := '[]'::jsonb;
    end;
    delete from rooms where id = p_room;
    return jsonb_build_object('left', true, 'room_deleted', true, 'files', v_files);
  end if;

  select is_group into v_group from rooms where id = p_room;
  if v_group then
    -- 방장이 나가면 가장 먼저 들어온 사람이 방장이 됨
    update rooms set created_by = (select user_id from room_members where room_id = p_room
                                    order by joined_at, user_id limit 1)
     where id = p_room and (created_by = v_me or created_by is null);
    select display_name into v_mine from profiles where id = v_me;
    insert into messages (room_id, sender_id, kind, content)
    values (p_room, null, 'system', v_mine || '님이 나갔어요.');
  end if;
  return jsonb_build_object('left', true, 'room_deleted', false);
end;
$$;

-- v1.7: 단체방에서 내보내기 (방장 또는 관리자만)
create or replace function public.kick_from_room(p_room uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_room  rooms%rowtype;
  v_mine  text;
  v_name  text;
begin
  if not public.is_room_member(p_room) then raise exception '이 방의 참여자가 아니에요'; end if;
  select * into v_room from rooms where id = p_room;
  if v_room.is_notice then raise exception '공지사항 방에서는 내보낼 수 없어요'; end if;
  if not v_room.is_group then raise exception '1:1 대화방에서는 내보낼 수 없어요'; end if;
  if v_room.created_by is distinct from v_me and not public.is_admin() then
    raise exception '방장만 내보낼 수 있어요';
  end if;
  if p_user = v_me then raise exception '나 자신은 내보낼 수 없어요. 채팅방 나가기를 이용해 주세요'; end if;

  delete from room_members where room_id = p_room and user_id = p_user;
  if not found then raise exception '이미 이 방에 없는 사람이에요'; end if;

  select display_name into v_mine from profiles where id = v_me;
  select display_name into v_name from profiles where id = p_user;
  insert into messages (room_id, sender_id, kind, content)
  values (p_room, null, 'system', left(coalesce(v_mine, '방장') || '님이 ' || coalesce(v_name, '(알 수 없음)') || '님을 내보냈어요.', 2000));

  -- 내보낸 사람의 앱에 바로 알림 (열려 있으면 그 방을 닫음)
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    begin
      perform realtime.send(jsonb_build_object('room_id', p_room, 'title', v_room.title), 'kicked', 'user:' || p_user::text, true);
    exception when others then null;
    end;
  end if;
end;
$$;

-- 읽음 처리 (방에 들어와 있을 때 호출)
--   이미 다 읽었으면 아무것도 쓰지 않음 (불필요한 쓰기·실시간 전송 방지)
create or replace function public.mark_read(p_room uuid)
returns void language sql security definer set search_path = public as $$
  update room_members m
     set last_read_id = v.mx
    from (select coalesce(max(id), 0) as mx from messages where room_id = p_room) v
   where m.room_id = p_room and m.user_id = auth.uid() and m.last_read_id < v.mx;
$$;

-- v1.8: 내가 보낸 메시지 삭제 → 모든 사람 화면에 "삭제된 메시지예요" 로 남음
-- v1.12: 이미 대화가 있는 방에 들어오면(다시 들어오기·나중에 초대) 그 뒤의 대화만 보이게
--        공지방은 지난 공지도 모두 보임. 값을 직접 넣은 경우(1:1 방 자동 복귀)는 그대로 둠
create or replace function public.set_history_from()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.history_from < 0 and not public.is_notice_room(new.room_id) then
    select coalesce(max(id), 0) into new.history_from from messages where room_id = new.room_id;
  end if;
  return new;
end;
$$;
drop trigger if exists room_members_history on public.room_members;
create trigger room_members_history before insert on public.room_members
  for each row execute function public.set_history_from();

-- v1.11: 답장은 같은 방의 글에만 (다른 방 메시지를 가리키면 답장 표시 없이 저장)
create or replace function public.check_reply_to()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reply_to is not null and (new.kind <> 'text' or not exists (
       select 1 from messages g join room_members m on m.room_id = g.room_id and m.user_id = new.sender_id
        where g.id = new.reply_to and g.room_id = new.room_id and g.kind <> 'system' and g.id > m.history_from)) then
    new.reply_to := null;
  end if;
  return new;
end;
$$;
drop trigger if exists messages_reply_check on public.messages;
create trigger messages_reply_check before insert on public.messages
  for each row execute function public.check_reply_to();

-- v1.11: 공감 누르기 (같은 걸 다시 누르거나 p_emoji 가 null 이면 취소, 다른 걸 누르면 바꿈)
create or replace function public.react_message(p_id bigint, p_emoji text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_m   messages%rowtype;
  v_cur text;
  v_new text;
begin
  if not public.is_active() then raise exception '사용할 수 없는 계정이에요'; end if;
  if p_emoji is not null and p_emoji not in ('heart', 'like', 'laugh', 'wow', 'sad', 'check') then
    raise exception '지원하지 않는 공감이에요';
  end if;
  select * into v_m from messages where id = p_id;
  if not found or not public.can_see_message(v_m.room_id, p_id) then raise exception '메시지를 찾을 수 없어요'; end if;
  if v_m.kind in ('system', 'deleted') then raise exception '공감할 수 없는 메시지예요'; end if;
  if not public.is_notice_room(v_m.room_id) and not public.can_post(v_m.room_id) then
    raise exception '서로 친구여야 공감할 수 있어요';
  end if;

  select emoji into v_cur from message_reactions where message_id = p_id and user_id = auth.uid();
  if p_emoji is null or p_emoji = v_cur then
    delete from message_reactions where message_id = p_id and user_id = auth.uid();
    v_new := null;
  else
    insert into message_reactions (message_id, room_id, user_id, emoji)
    values (p_id, v_m.room_id, auth.uid(), p_emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
    v_new := p_emoji;
  end if;

  -- 참여자 화면에 바로 반영 (회원이 아주 많은 공지방은 화면을 열 때 불러옴)
  if v_new is distinct from v_cur and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null
     and not (public.is_notice_room(v_m.room_id)
              and (select count(*) from (select 1 from room_members where room_id = v_m.room_id limit 101) x) > 100) then
    begin
      perform realtime.send(jsonb_build_object('message_id', p_id, 'room_id', v_m.room_id, 'user_id', auth.uid(), 'emoji', v_new),
                            'reaction', 'user:' || m.user_id::text, true)
         from room_members m where m.room_id = v_m.room_id;
    exception when others then null;
    end;
  end if;
  return v_new;
end;
$$;

create or replace function public.delete_message(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m    messages%rowtype;
  v_last bigint;
begin
  select * into v_m from messages where id = p_id;
  if not found then raise exception '메시지를 찾을 수 없어요'; end if;
  if v_m.sender_id is distinct from auth.uid() then raise exception '내가 보낸 메시지만 삭제할 수 있어요'; end if;
  if not public.is_room_member(v_m.room_id) then raise exception '이 방의 참여자가 아니에요'; end if;
  if not public.can_see_message(v_m.room_id, p_id) then raise exception '메시지를 찾을 수 없어요'; end if;
  if v_m.kind = 'deleted' then return; end if;

  update messages set kind = 'deleted', content = '-', deleted_at = now() where id = p_id;
  delete from message_reactions where message_id = p_id;

  -- 방의 마지막 메시지였다면 목록 미리보기도 바꿈
  select max(id) into v_last from messages where room_id = v_m.room_id and kind <> 'system';
  if v_last = p_id then
    update rooms set last_message = '삭제된 메시지예요' where id = v_m.room_id;
  end if;

  -- 참여자 화면에 바로 반영 (실시간)
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    begin
      perform realtime.send(jsonb_build_object('id', p_id, 'room_id', v_m.room_id), 'deleted', 'user:' || m.user_id::text, true)
         from room_members m where m.room_id = v_m.room_id;
    exception when others then null;
    end;
  end if;
end;
$$;

-- 최근 접속 시각 기록 (앱을 열 때 호출)
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now() where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 6. 관리자 전용 기능 (관리자가 아니면 모두 거부)
-- ---------------------------------------------------------------------
create or replace function public.admin_guard()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있어요'; end if;
  return auth.uid();
end;
$$;

-- 회원 목록 (검색: 아이디·이름·휴대폰 번호 일부)
drop function if exists public.admin_list_users(text);
create function public.admin_list_users(p_query text default null)
returns table (
  id uuid, username text, display_name text, avatar_url text, status text, is_admin boolean,
  created_at timestamptz, last_seen_at timestamptz, friend_count integer, room_count integer, phone text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.status, p.is_admin,
         p.created_at, p.last_seen_at,
         (select count(*)::int from friends f where f.user_id = p.id),
         (select count(*)::int from room_members m join rooms r on r.id = m.room_id
           where m.user_id = p.id and not r.is_notice),
         up.phone
    from profiles p left join user_phones up on up.user_id = p.id
   where p_query is null or p_query = ''
      or p.username ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%'
      or (regexp_replace(p_query, '[^0-9]', '', 'g') <> '' and up.phone like '%' || regexp_replace(p_query, '[^0-9]', '', 'g') || '%')
   order by (p.status = 'pending') desc, p.created_at desc;
end;
$$;

-- 회원 상태 변경: active(승인·정지 해제) / suspended(정지)
create or replace function public.admin_set_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.admin_guard();
begin
  if p_status not in ('active', 'suspended') then raise exception '잘못된 상태예요'; end if;
  if p_user = v_me then raise exception '내 계정의 상태는 바꿀 수 없어요'; end if;
  update profiles set status = p_status where id = p_user;
  if not found then raise exception '회원을 찾을 수 없어요'; end if;

  if p_status = 'suspended' then
    update auth.users set banned_until = 'infinity'::timestamptz where id = p_user;  -- 로그인 차단
    if to_regclass('public.push_subscriptions') is not null then
      execute 'delete from public.push_subscriptions where user_id = $1' using p_user;
    end if;
  else
    update auth.users set banned_until = null where id = p_user;
    perform public.join_notice_room(p_user);
  end if;
end;
$$;

-- 회원의 휴대폰 번호 지우기 (남의 번호를 잘못 등록한 경우 등)
create or replace function public.admin_clear_phone(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  delete from user_phones where user_id = p_user;
  delete from friend_suggestions where suggested_id = p_user;
end;
$$;

-- 관리자 지정 / 해제
create or replace function public.admin_set_admin(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.admin_guard();
begin
  if p_user = v_me and not p_on then raise exception '내 관리자 권한은 해제할 수 없어요'; end if;
  update profiles set is_admin = p_on where id = p_user and status = 'active';
  if not found then raise exception '사용 중인 회원만 관리자로 지정할 수 있어요'; end if;
end;
$$;

-- 비밀번호 초기화 → 임시 비밀번호를 돌려줌 (관리자가 회원에게 전달)
create or replace function public.admin_reset_password(p_user uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_chars text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_pw    text := '';
  v_bytes bytea := extensions.gen_random_bytes(8);
begin
  perform public.admin_guard();
  for i in 0..7 loop
    v_pw := v_pw || substr(v_chars, 1 + (get_byte(v_bytes, i) % length(v_chars)), 1);
  end loop;
  update auth.users
     set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')), updated_at = now()
   where id = p_user;
  if not found then raise exception '회원을 찾을 수 없어요'; end if;
  return v_pw;
end;
$$;

-- 강제 탈퇴 (계정·친구·참여 정보 삭제, 보낸 메시지는 "(알 수 없음)"으로 남음)
-- v1.13: 관리자가 연결해 준 친구 알림 (앱 화면 + 앱을 닫아도 오는 알림)
drop function if exists public.notify_connected(uuid, uuid);
create or replace function public.notify_connected(p_to uuid, p_friend uuid, p_via text default 'admin')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name    text;
  v_user    text;
  v_url     text;
  v_secret  text;
  v_preview boolean;
  v_subs    jsonb;
begin
  select display_name, username into v_name, v_user from profiles where id = p_friend;
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    begin
      perform realtime.send(jsonb_build_object('friend_id', p_friend, 'display_name', v_name, 'username', v_user, 'via', p_via),
                            'connected', 'user:' || p_to::text, true);
    exception when others then null;
    end;
  end if;
  if to_regclass('private.push_config') is null then return; end if;
  select function_url, secret, show_preview into v_url, v_secret, v_preview from private.push_config where id = 1;
  if v_url is null or v_url like '%YOUR_PROJECT_REF%' then return; end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into v_subs
    from push_subscriptions s join profiles p on p.id = s.user_id and p.status = 'active'
   where s.user_id = p_to;
  if v_subs is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('subs', v_subs, 'title', case when p_via = 'invite' then '새 친구' else '친구 연결' end,
              'body', case when not coalesce(v_preview, true) then '새 친구가 생겼어요.'
                           when p_via = 'invite' then coalesce(v_name, '회원') || '님이 내 초대 링크로 친구가 됐어요. 이제 대화할 수 있어요.'
                           else '관리자가 ' || coalesce(v_name, '회원') || '님과 친구로 연결해 줬어요. 이제 대화할 수 있어요.' end),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 8000
  );
exception when others then
  raise warning 'notify_connected 실패: %', sqlerrm;   -- 알림 문제로 연결이 막히면 안 됨
end;
$$;

-- v1.14: 내 초대 코드 (없으면 만듦)
create or replace function public.my_invite_code()
returns text language plpgsql security definer set search_path = public, private as $$
declare
  v_code text;
begin
  if not public.is_active() then raise exception '사용할 수 없는 계정이에요'; end if;
  select code into v_code from private.invite_codes where user_id = auth.uid();
  if v_code is null then
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into private.invite_codes (user_id, code) values (auth.uid(), v_code)
    on conflict (user_id) do nothing;
    select code into v_code from private.invite_codes where user_id = auth.uid();
  end if;
  return v_code;
end;
$$;

-- v1.14: 초대 링크 새로 만들기 (예전 링크·QR 은 더 이상 안 됨)
create or replace function public.reset_invite_code()
returns text language plpgsql security definer set search_path = public, private as $$
declare
  v_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  if not public.is_active() then raise exception '사용할 수 없는 계정이에요'; end if;
  insert into private.invite_codes (user_id, code, created_at) values (auth.uid(), v_code, now())
  on conflict (user_id) do update set code = excluded.code, created_at = excluded.created_at;
  return v_code;
end;
$$;

-- v1.14: 초대 링크 주인 보기 (로그인 전에도 "○○님이 초대했어요" 를 보여 주려고)
create or replace function public.invite_preview(p_code text)
returns table (id uuid, username text, display_name text, avatar_url text, status_message text)
language sql stable security definer set search_path = public, private as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.status_message
    from private.invite_codes c join profiles p on p.id = c.user_id
   where c.code = lower(trim(p_code)) and p.status = 'active';
$$;

-- v1.14: 초대 링크로 친구 되기 (바로 서로 친구 + 초대한 사람에게 알림)
create or replace function public.accept_invite(p_code text)
returns table (id uuid, username text, display_name text, avatar_url text, status_message text, already boolean)
language plpgsql security definer set search_path = public, private as $$
#variable_conflict use_column
declare
  v_me    uuid := auth.uid();
  v_owner uuid;
  v_new   boolean;
begin
  if v_me is null then raise exception '로그인이 필요해요'; end if;
  if not public.is_active() then raise exception '가입 승인 후에 친구를 추가할 수 있어요'; end if;
  perform public.use_lookup_quota(1);   -- 코드를 마구 대입해 보는 것을 막음
  select c.user_id into v_owner from private.invite_codes c join profiles p on p.id = c.user_id
   where c.code = lower(trim(p_code)) and p.status = 'active';
  if v_owner is null then raise exception '초대 링크가 바뀌었거나 사용할 수 없어요. 새 링크를 받아 주세요'; end if;
  if v_owner = v_me then raise exception '내 초대 링크예요. 친구에게 보내 주세요'; end if;
  v_new := not public.is_mutual_friend(v_me, v_owner);
  -- 두 줄을 한 번에 넣어야 '친구 요청' 알림이 따로 가지 않음
  insert into friends (user_id, friend_id) values (v_me, v_owner), (v_owner, v_me) on conflict do nothing;
  if v_new then
    delete from friend_suggestions
     where (user_id = v_me and suggested_id = v_owner) or (user_id = v_owner and suggested_id = v_me);
    perform public.notify_connected(v_owner, v_me, 'invite');
  end if;
  return query select p.id, p.username, p.display_name, p.avatar_url, p.status_message, not v_new
                 from profiles p where p.id = v_owner;
end;
$$;

-- v1.13: 관리자가 한 회원과 여러 회원을 서로 친구로 연결 (새로 연결된 수를 돌려줌)
create or replace function public.admin_connect_friends(p_user uuid, p_others uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_me  uuid := public.admin_guard();
  v_o   uuid;
  v_n   integer := 0;
  v_new boolean;
begin
  if not exists (select 1 from profiles where id = p_user and status = 'active') then
    raise exception '이용 중인 회원만 친구로 연결할 수 있어요';
  end if;
  if coalesce(cardinality(p_others), 0) = 0 then return 0; end if;
  if cardinality(p_others) > 200 then raise exception '한 번에 200명까지 연결할 수 있어요'; end if;
  for v_o in select distinct x from unnest(p_others) as x loop
    continue when v_o is null or v_o = p_user
               or not exists (select 1 from profiles where id = v_o and status = 'active');
    v_new := not public.is_mutual_friend(p_user, v_o);
    -- 두 줄을 한 번에 넣어야 '친구 요청' 알림이 따로 가지 않음
    insert into friends (user_id, friend_id) values (p_user, v_o), (v_o, p_user)
    on conflict do nothing;
    if v_new then
      v_n := v_n + 1;
      delete from friend_suggestions
       where (user_id = p_user and suggested_id = v_o) or (user_id = v_o and suggested_id = p_user);
      perform public.notify_connected(p_user, v_o);
      perform public.notify_connected(v_o, p_user);
    end if;
  end loop;
  return v_n;
end;
$$;

-- v1.13: 회원의 친구 관계 (관리자 친구 연결 화면용: 내가 추가함 / 상대가 추가함)
create or replace function public.admin_user_friends(p_user uuid)
returns table (id uuid, added boolean, added_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query
    select x.id, bool_or(x.a), bool_or(x.b) from (
      select f.friend_id as id, true as a, false as b from friends f where f.user_id = p_user
      union all
      select f.user_id, false, true from friends f where f.friend_id = p_user
    ) x group by x.id;
end;
$$;

-- v1.12: 없어진 방에 남은 사진·파일 목록 (관리자 화면의 '저장 공간 정리')
create or replace function public.admin_orphan_media()
returns table (bucket text, name text, size bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query
    select o.bucket_id::text, o.name::text, coalesce((o.metadata ->> 'size')::bigint, 0)
      from storage.objects o
     where o.bucket_id in ('chat-images', 'chat-files')
       and not exists (select 1 from rooms r where r.id::text = split_part(o.name, '/', 1))
     order by o.name
     limit 3000;
end;
$$;

create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.admin_guard();
begin
  if p_user = v_me then raise exception '내 계정은 삭제할 수 없어요'; end if;
  begin  -- 올린 사진 파일의 소유자 표시 해제 (파일은 남음)
    execute 'update storage.objects set owner = null where owner = $1' using p_user;
  exception when others then null;
  end;
  delete from auth.users where id = p_user;
  if not found then raise exception '회원을 찾을 수 없어요'; end if;
  delete from rooms r where not exists (select 1 from room_members m where m.room_id = r.id) and not r.is_notice;
end;
$$;

-- 운영 설정 읽기 / 바꾸기
create or replace function public.admin_get_settings()
returns table (require_approval boolean, total integer, pending integer, suspended integer)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query
  select s.require_approval,
         (select count(*)::int from profiles),
         (select count(*)::int from profiles where status = 'pending'),
         (select count(*)::int from profiles where status = 'suspended')
    from private.app_settings s where s.id = 1;
end;
$$;

create or replace function public.admin_set_settings(p_require_approval boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update private.app_settings set require_approval = p_require_approval where id = 1;
end;
$$;

-- 전체 공지 보내기 (공지사항 방에 글을 올리고 모든 회원을 참여시킴)
create or replace function public.admin_broadcast(p_text text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me   uuid := public.admin_guard();
  v_room uuid;
  v_last bigint;
begin
  if coalesce(trim(p_text), '') = '' then raise exception '공지 내용을 입력해 주세요'; end if;
  select id into v_room from rooms where is_notice;
  if v_room is null then
    insert into rooms (is_group, is_notice, title, created_by)
    values (true, true, '공지사항', v_me)
    on conflict do nothing
    returning id into v_room;
    if v_room is null then select id into v_room from rooms where is_notice; end if;
  end if;
  select coalesce(max(id), 0) into v_last from messages where room_id = v_room;
  insert into room_members (room_id, user_id, last_read_id)
  select v_room, p.id, v_last from profiles p where p.status = 'active'
  on conflict (room_id, user_id) do nothing;
  insert into messages (room_id, sender_id, kind, content)
  values (v_room, v_me, 'text', left(trim(p_text), 2000));
  return v_room;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. 보안 정책 (Row Level Security) — 본인·참여자만 볼 수 있게
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.friends      enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.messages     enable row level security;
alter table public.user_phones  enable row level security;   -- 정책 없음 = 앱에서 직접 접근 불가 (기능 함수로만)
alter table public.friend_suggestions enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or ((select public.is_active()) and (
          exists (select 1 from public.friends f where f.user_id = (select auth.uid()) and f.friend_id = profiles.id)
          or public.shares_room_with(id)))
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "friends_select_own" on public.friends;
create policy "friends_select_own" on public.friends for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "friends_insert_own" on public.friends;
create policy "friends_insert_own" on public.friends for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active())
              and public.is_active_user(friend_id));

drop policy if exists "friends_delete_own" on public.friends;
create policy "friends_delete_own" on public.friends for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "rooms_select_member" on public.rooms;
create policy "rooms_select_member" on public.rooms for select to authenticated
  using (public.is_room_member(id));

drop policy if exists "room_members_select" on public.room_members;
create policy "room_members_select" on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages for select to authenticated
  using (public.can_see_message(room_id, id));

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'image', 'sticker', 'file', 'contact')
    and public.can_post(room_id)
  );

-- 권한 (보안 정책이 실제 접근 범위를 제한함)
grant usage on schema public to anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, status_message, avatar_url) on public.profiles to authenticated;  -- 관리자·상태 항목은 직접 못 바꿈
grant select, insert, delete on public.friends to authenticated;
grant select on public.rooms to authenticated;
grant select on public.room_members to authenticated;
grant select, insert on public.messages to authenticated;
-- v1.11: 공감은 보기만 직접, 누르기는 react_message() 로만
alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;
drop policy if exists "reactions_select_member" on public.message_reactions;
create policy "reactions_select_member" on public.message_reactions for select to authenticated
  using (public.can_see_message(room_id, message_id));
revoke all on public.user_phones, public.friend_suggestions from anon, authenticated;

do $$
declare
  f text;
  user_fns text[] := array[
    'my_friends()', 'find_user(text)', 'my_rooms()', 'get_or_create_dm(uuid)',
    'create_group(text, uuid[])', 'invite_to_room(uuid, uuid[])', 'leave_room(uuid)',
    'mark_read(uuid)', 'touch_last_seen()',
    'get_my_phone()', 'set_my_phone(text, boolean)', 'set_phone_findable(boolean)',
    'match_contacts(text[], text[])', 'match_contacts_detail(text[], text[])', 'my_suggestions()', 'dismiss_suggestion(uuid)', 'admin_clear_phone(uuid)',
    'my_friend_requests()', 'dismiss_request(uuid)', 'kick_from_room(uuid, uuid)', 'delete_message(bigint)', 'react_message(bigint, text)',
    'my_invite_code()', 'reset_invite_code()', 'invite_preview(text)', 'accept_invite(text)',
    'admin_list_users(text)', 'admin_set_status(uuid, text)', 'admin_set_admin(uuid, boolean)',
    'admin_reset_password(uuid)', 'admin_delete_user(uuid)', 'admin_get_settings()',
    'admin_set_settings(boolean)', 'admin_broadcast(text)', 'admin_orphan_media()',
    'admin_connect_friends(uuid, uuid[])', 'admin_user_friends(uuid)'];
  helper_fns text[] := array[
    'is_active()', 'is_active_user(uuid)', 'is_admin()', 'is_room_member(uuid)', 'is_room_member_text(text)',
    'shares_room_with(uuid)', 'is_notice_room(uuid)', 'admin_guard()',
    'is_mutual_friend(uuid, uuid)', 'can_post(uuid)', 'can_post_text(text)',
    'valid_file_msg(text, uuid, uuid)', 'valid_contact_msg(text)',
    'can_see_message(uuid, bigint)', 'can_read_chat_object(text)', 'can_cleanup_folder(text)', 'is_orphan_folder(text)'];
begin
  foreach f in array user_fns || helper_fns loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- 내부용 함수는 앱에서 직접 부를 수 없게
  execute 'revoke execute on function public.join_notice_room(uuid) from public, anon, authenticated';
  execute 'revoke execute on function public.use_lookup_quota(integer) from public, anon, authenticated';
  execute 'revoke execute on function public.notify_friend_request(uuid, uuid) from public, anon, authenticated';
  execute 'revoke execute on function public.notify_connected(uuid, uuid, text) from public, anon, authenticated';
  execute 'grant execute on function public.invite_preview(text) to anon';   -- 로그인 전 초대 화면용
end;
$$;

-- ---------------------------------------------------------------------
-- 8. 사진 저장소 (프로필 사진: 공개 / 채팅 사진: 방 참여자만)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- v1.10: 채팅 파일 (방 참여자만, 한 파일 20MB까지)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 20971520, null)
on conflict (id) do nothing;

drop policy if exists "minitalk_avatar_insert" on storage.objects;
create policy "minitalk_avatar_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "minitalk_avatar_delete" on storage.objects;
create policy "minitalk_avatar_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "minitalk_chat_insert" on storage.objects;
create policy "minitalk_chat_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('chat-images', 'chat-files') and public.is_room_member_text((storage.foldername(name))[1])
              and public.can_post_text((storage.foldername(name))[1])
              and split_part(name, '/', 2) like (select auth.uid())::text || '-%');

-- v1.8: 내가 올린 채팅 사진·파일은 삭제 가능 (파일 이름이 내 회원ID로 시작)
drop policy if exists "minitalk_chat_delete" on storage.objects;
create policy "minitalk_chat_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('chat-images', 'chat-files') and (
    split_part(name, '/', 2) like (select auth.uid())::text || '-%'
    or public.can_cleanup_folder(split_part(name, '/', 1))     -- v1.12: 마지막으로 나간 사람의 정리
    or public.is_orphan_folder(split_part(name, '/', 1))));    -- v1.12: 관리자의 남은 파일 정리

drop policy if exists "minitalk_chat_select" on storage.objects;
create policy "minitalk_chat_select" on storage.objects for select to authenticated
  using (bucket_id in ('chat-images', 'chat-files') and (
    public.can_read_chat_object(name)                          -- v1.12: 내가 볼 수 있는 메시지의 파일만
    or public.can_cleanup_folder(split_part(name, '/', 1))
    or public.is_orphan_folder(split_part(name, '/', 1))));

-- ---------------------------------------------------------------------
-- 9. 실시간(Realtime) 전달 — v1.6: Broadcast 방식
--    새 메시지를 그 방 참여자 각자의 비공개 채널(user:<회원ID>)로만 보냄.
--    (예전 방식은 메시지 1건마다 접속자 전원의 권한을 하나씩 확인해서, 접속자가 많으면 느려졌음)
-- ---------------------------------------------------------------------
create or replace function public.rt_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return new; end if;
  -- 회원이 아주 많은 공지방은 실시간으로 한꺼번에 보내지 않음 (알림 + 앱 화면 갱신으로 전달)
  if public.is_notice_room(new.room_id)
     and (select count(*) from (select 1 from room_members where room_id = new.room_id limit 101) x) > 100 then
    return new;
  end if;
  v_payload := jsonb_build_object('id', new.id, 'room_id', new.room_id, 'sender_id', new.sender_id,
                                  'kind', new.kind, 'content', new.content, 'created_at', new.created_at,
                                  'reply_to', new.reply_to);
  perform realtime.send(v_payload, 'message', 'user:' || m.user_id::text, true)
     from room_members m where m.room_id = new.room_id;
  return new;
exception when others then
  raise warning 'rt_on_message 실패: %', sqlerrm;   -- 실시간 전달 문제로 메시지 저장이 막히면 안 됨
  return new;
end;
$$;

drop trigger if exists messages_broadcast on public.messages;
create trigger messages_broadcast
  after insert on public.messages
  for each row execute function public.rt_on_message();

-- 읽음 표시: 20명 이하 방만 실시간으로 (그 방을 보고 있는 사람에게만, room:<방ID> 채널)
--   21명 이상 방은 앱이 5초마다 확인 (실시간 전송량이 인원 수의 제곱으로 늘어나는 것을 막음)
create or replace function public.rt_on_read()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return new; end if;
  if public.is_notice_room(new.room_id) then return new; end if;
  if (select count(*) from (select 1 from room_members where room_id = new.room_id limit 21) x) > 20 then
    return new;
  end if;
  perform realtime.send(
    jsonb_build_object('room_id', new.room_id, 'user_id', new.user_id, 'last_read_id', new.last_read_id),
    'read', 'room:' || new.room_id::text, true);
  return new;
exception when others then
  raise warning 'rt_on_read 실패: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists room_members_read on public.room_members;
create trigger room_members_read
  after update of last_read_id on public.room_members
  for each row when (new.last_read_id > old.last_read_id)
  execute function public.rt_on_read();

-- 비공개 채널 권한: 내 채널(user:<내ID>)과 내가 속한 방 채널(room:<방ID>)만 받을 수 있음.
--   앱에서 이 채널로 직접 보내는 것은 허용하지 않음 (서버만 보냄)
do $do$
begin
  if to_regclass('realtime.messages') is null then return; end if;
  execute 'drop policy if exists "minitalk_receive" on realtime.messages';
  execute $p$
    create policy "minitalk_receive" on realtime.messages for select to authenticated
    using (
      realtime.messages.extension = 'broadcast'
      and (
        (select realtime.topic()) = 'user:' || (select auth.uid())::text
        or ((select realtime.topic()) like 'room:%'
            and public.is_room_member_text(substr((select realtime.topic()), 6)))
      )
    )$p$;
exception when others then
  raise notice '실시간 채널 권한을 만들지 못했어요(예전 방식으로 동작): %', sqlerrm;
end
$do$;

-- 예전 방식(Postgres Changes) 대비용 등록 — 위 설정이 안 될 때 앱이 자동으로 이 방식을 씀
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

-- ---------------------------------------------------------------------
-- 10. [관리자 지정] 'YOUR_ADMIN_ID' 를 내 아이디(앱에서 가입한 아이디)로 바꾸세요.
--     먼저 앱에서 회원가입을 한 다음 실행해야 합니다. 여러 명이면 이 줄을 복사해 추가.
-- ---------------------------------------------------------------------
update public.profiles set is_admin = true, status = 'active' where username = lower('YOUR_ADMIN_ID');

-- 끝. "Success. No rows returned" 가 나오면 정상입니다.
