-- =====================================================================
--  미니톡 — 앱을 닫아도 오는 알림(Web Push) 설정
--  ※ schema.sql 을 먼저 실행한 뒤에 실행하세요.
--  ※ 맨 아래 [설정값] 부분은 tools/push-setup.html 도구가 자동으로 채워 줍니다.
--     도구가 만들어 준 SQL 전체를 그대로 붙여넣고 Run 하면 됩니다.
--  여러 번 실행해도 안전합니다.
-- =====================================================================

-- 1. 서버에서 다른 서버로 요청을 보내는 확장 기능 켜기
create extension if not exists pg_net with schema extensions;

-- 2. 기기별 알림 구독 정보
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

grant select on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- 이 기기로 알림 받기 (같은 기기에서 다른 아이디로 로그인하면 새 아이디로 넘어감)
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if p_endpoint !~ '^https://' then raise exception '잘못된 알림 주소입니다'; end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_user_agent, 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

-- 이 기기 알림 끄기 (로그아웃할 때도 호출)
create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- 3. 발송 설정 (앱 사용자에게는 보이지 않는 별도 공간에 보관)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.push_config (
  id           int primary key default 1 check (id = 1),
  function_url text not null,
  secret       text not null,
  show_preview boolean not null default true   -- false 로 바꾸면 알림에 메시지 내용 대신 "새 메시지"만 표시
);
revoke all on private.push_config from public, anon, authenticated;

-- 4. 새 메시지가 저장되면 → 받는 사람들의 기기 목록을 모아 발송 함수 호출
create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cfg    private.push_config%rowtype;
  v_subs   jsonb;
  v_name   text;
  v_room   rooms%rowtype;
  v_title  text;
  v_body   text;
begin
  if new.kind = 'system' or new.sender_id is null then return new; end if;

  select * into v_cfg from private.push_config where id = 1;
  if not found or v_cfg.function_url like '%YOUR_PROJECT_REF%' then return new; end if;

  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into v_subs
    from push_subscriptions s
    join room_members m on m.user_id = s.user_id and m.room_id = new.room_id
   where s.user_id <> new.sender_id;
  if v_subs is null then return new; end if;

  select display_name into v_name from profiles where id = new.sender_id;
  select * into v_room from rooms where id = new.room_id;

  v_title := coalesce(v_name, '새 메시지');
  if v_room.is_group then v_title := v_title || ' · ' || coalesce(v_room.title, '단체방'); end if;

  if not v_cfg.show_preview then
    v_title := '미니톡';
    v_body  := '새 메시지가 도착했습니다.';
  elsif new.kind = 'image' then
    v_body := '사진을 보냈습니다.';
  else
    v_body := left(new.content, 120);
  end if;

  perform net.http_post(
    url := v_cfg.function_url,
    body := jsonb_build_object(
      'subs', v_subs, 'title', v_title, 'body', v_body,
      'room_id', new.room_id, 'message_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_cfg.secret),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  -- 알림 발송 문제로 메시지 전송이 막히면 안 되므로 오류는 무시
  raise warning 'notify_push 실패: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists messages_push on public.messages;
create trigger messages_push
  after insert on public.messages
  for each row execute function public.notify_push();

-- =====================================================================
-- [설정값] — tools/push-setup.html 이 채워 줍니다. 직접 쓸 경우:
--   function_url : https://프로젝트ID.supabase.co/functions/v1/send-push
--   secret       : Edge Function 비밀값 PUSH_WEBHOOK_SECRET 과 똑같은 값
-- =====================================================================
insert into private.push_config (id, function_url, secret, show_preview)
values (1, 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push', 'YOUR_PUSH_SECRET', true)
on conflict (id) do update
  set function_url = excluded.function_url, secret = excluded.secret, show_preview = excluded.show_preview;
