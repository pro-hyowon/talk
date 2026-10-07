// 미니톡 — 서버(Supabase) 통신 모듈
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

const PAGE = 50;

function isConfigured() {
  return /^https:\/\/.+/.test(CONFIG.SUPABASE_URL) && !CONFIG.SUPABASE_ANON_KEY.startsWith('YOUR_');
}

// Supabase 오류를 사용자용 한국어 문구로 변환
function friendly(error) {
  const msg = (error && (error.message || error.error_description)) || String(error);
  const map = [
    [/Invalid login credentials/i, '아이디 또는 비밀번호가 맞지 않아요'],
    [/banned/i, '이용이 정지된 계정이에요. 관리자에게 문의해 주세요'],
    [/Could not find the function public\.(admin_|touch_last_seen|get_my_phone|set_my_phone|set_phone_findable|match_contacts|my_suggestions|dismiss_suggestion|my_friend_requests|dismiss_request|kick_from_room|delete_message|react_message|admin_orphan_media)/i, '데이터베이스 업데이트가 필요해요 (schema.sql 다시 실행)'],
    [/messages_kind_check|messages_sticker_check|messages_file_check|Bucket not found|'reply_to' column/i, '데이터베이스 업데이트가 필요해요 (schema.sql 다시 실행)'],
    [/already registered|already exists/i, '이미 사용 중인 아이디예요'],
    [/Database error saving new user/i, '가입할 수 없는 아이디예요. 영문 소문자·숫자·밑줄(_) 3~20자로 입력해 주세요'],
    [/Password should be at least/i, '비밀번호는 6자 이상이어야 해요'],
    [/weak/i, '비밀번호가 너무 쉬워요. 다른 비밀번호를 써 주세요'],
    [/rate limit|too many/i, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요'],
    [/Email not confirmed/i, '관리자 설정이 필요해요: Supabase에서 "Confirm email"을 꺼 주세요'],
    [/Signups not allowed|signup is disabled/i, '지금은 신규 가입이 막혀 있어요. 관리자에게 문의해 주세요'],
    [/Failed to fetch|NetworkError|Load failed/i, '인터넷 연결을 확인해 주세요'],
    [/JWT expired/i, '로그인이 만료됐어요. 다시 로그인해 주세요'],
    [/Payload too large|exceeded the maximum allowed size/i, '파일이 너무 커요 (사진 5MB, 파일 20MB까지)'],
    [/row-level security/i, '권한이 없어요'],
    [/(save|delete)_push_subscription/i, '알림 서버 설정(push-setup.sql)이 아직 안 되어 있어요. 관리자에게 문의해 주세요'],
  ];
  for (const [re, ko] of map) if (re.test(msg)) return new Error(ko);
  return new Error(msg);
}
const must = ({ data, error }) => { if (error) throw friendly(error); return data; };

export function createApi() {
  if (!isConfigured()) return { configured: false };

  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const toEmail = (u) => `${u.trim().toLowerCase()}@${CONFIG.LOGIN_DOMAIN}`;
  let uid = null;
  let rtMode = 'broadcast';

  const api = {
    configured: true,

    // ---------- 로그인 ----------
    async getSession() {
      const { data } = await sb.auth.getSession();
      uid = data.session?.user?.id || null;
      return uid;
    },
    onAuthChange(cb) {
      sb.auth.onAuthStateChange((_evt, session) => {
        const next = session?.user?.id || null;
        if (next !== uid) { uid = next; cb(uid); }
      });
    },
    async signUp({ username, password, displayName }) {
      const data = must(await sb.auth.signUp({
        email: toEmail(username),
        password,
        options: { data: { username: username.trim().toLowerCase(), display_name: displayName.trim() } },
      }));
      if (!data.session) {
        throw new Error('관리자 설정이 필요해요: Supabase > Authentication > Email 에서 "Confirm email"을 꺼 주세요');
      }
      uid = data.session.user.id;
      return uid;
    },
    async signIn({ username, password }) {
      const data = must(await sb.auth.signInWithPassword({ email: toEmail(username), password }));
      uid = data.session.user.id;
      return uid;
    },
    async signOut() { await sb.auth.signOut(); uid = null; },
    async changePassword(current, password) {
      const { data } = await sb.auth.getUser();
      const email = data && data.user && data.user.email;
      const check = await sb.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new Error('현재 비밀번호가 맞지 않아요');
      must(await sb.auth.updateUser({ password }));
    },

    // ---------- 프로필 ----------
    async getMyProfile() {
      return must(await sb.from('profiles').select('*').eq('id', uid).single());
    },
    async updateProfile(patch) {
      return must(await sb.from('profiles').update(patch).eq('id', uid).select().single());
    },
    async uploadAvatar(blob) {
      const path = `${uid}/${Date.now()}.jpg`;
      must(await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
      return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    },

    // ---------- 친구 ----------
    async findUser(query) {   // 아이디 또는 휴대폰 번호
      const rows = must(await sb.rpc('find_user', { p_username: query }));
      return rows[0] || null;
    },
    async getMyPhone() { return must(await sb.rpc('get_my_phone'))[0] || null; },
    async setMyPhone(phone, findable = true) { return must(await sb.rpc('set_my_phone', { p_phone: phone || '', p_findable: findable })); },
    async setPhoneFindable(on) { must(await sb.rpc('set_phone_findable', { p_on: on })); },
    async matchContacts(phones, names) { return must(await sb.rpc('match_contacts', { p_phones: phones, p_names: names })); },
    // v1.9: 번호마다 결과를 받음. 데이터베이스가 아직 예전 버전이면 예전 방식(찾은 수만)으로
    async matchContactsDetail(phones, names) {
      const { data, error } = await sb.rpc('match_contacts_detail', { p_phones: phones, p_names: names });
      if (!error) return { rows: data || [] };
      if (error.code === 'PGRST202' || /Could not find the function public\.match_contacts_detail/i.test(error.message || '')) {
        return { count: must(await sb.rpc('match_contacts', { p_phones: phones, p_names: names })) || 0 };
      }
      throw friendly(error);
    },
    async listSuggestions() { return must(await sb.rpc('my_suggestions')); },
    async dismissSuggestion(id) { must(await sb.rpc('dismiss_suggestion', { p_user: id })); },
    async listRequests() { return must(await sb.rpc('my_friend_requests')); },
    async dismissRequest(id) { must(await sb.rpc('dismiss_request', { p_user: id })); },
    async listFriends() { return must(await sb.rpc('my_friends')); },
    async addFriend(id) {
      const { error } = await sb.from('friends').insert({ friend_id: id });
      if (error && error.code !== '23505') throw friendly(error); // 23505 = 이미 친구
    },
    async removeFriend(id) {
      must(await sb.from('friends').delete().eq('user_id', uid).eq('friend_id', id));
    },

    // ---------- 채팅방 ----------
    async listRooms() { return must(await sb.rpc('my_rooms')); },
    async openDM(otherId) { return must(await sb.rpc('get_or_create_dm', { p_other: otherId })); },
    async createGroup(title, ids) { return must(await sb.rpc('create_group', { p_title: title, p_members: ids })); },
    async inviteToRoom(roomId, ids) { must(await sb.rpc('invite_to_room', { p_room: roomId, p_members: ids })); },
    // v1.12: 마지막으로 나가면 서버가 그 방의 사진·파일 목록을 돌려줌 → 저장 공간에서도 지움
    async leaveRoom(roomId) {
      const r = must(await sb.rpc('leave_room', { p_room: roomId })) || {};
      if (Array.isArray(r.files) && r.files.length) r.removed = await api.removeMedia(r.files.map((f) => ({ bucket: f.b, name: f.n })));
      return r;
    },
    async removeMedia(list) {
      let removed = 0;
      for (const b of ['chat-images', 'chat-files']) {
        const names = list.filter((x) => x.bucket === b).map((x) => x.name);
        for (let i = 0; i < names.length; i += 100) {
          try {
            const { data, error } = await sb.storage.from(b).remove(names.slice(i, i + 100));
            if (!error) removed += (data || []).length;
          } catch { /* 남은 파일은 관리자 화면에서 정리 */ }
        }
      }
      return removed;
    },
    async kickFromRoom(roomId, userId) { must(await sb.rpc('kick_from_room', { p_room: roomId, p_user: userId })); },
    async markRead(roomId) { must(await sb.rpc('mark_read', { p_room: roomId })); },
    async getRoom(roomId) {
      return must(await sb.from('rooms').select('id,is_group,is_notice,title,created_by').eq('id', roomId).maybeSingle());
    },
    async getMembers(roomId) {
      return must(await sb.from('room_members')
        .select('user_id,last_read_id,profiles(id,username,display_name,status_message,avatar_url)')
        .eq('room_id', roomId));
    },

    // ---------- 메시지 ----------
    async getMessages(roomId, beforeId) {
      let q = sb.from('messages').select('*').eq('room_id', roomId).order('id', { ascending: false }).limit(PAGE);
      if (beforeId) q = q.lt('id', beforeId);
      return must(await q).reverse();
    },
    async getMessagesAfter(roomId, afterId) {
      return must(await sb.from('messages').select('*').eq('room_id', roomId)
        .gt('id', afterId || 0).order('id', { ascending: true }).limit(200));
    },
    async sendText(roomId, text, replyTo) {
      const row = { room_id: roomId, kind: 'text', content: text };
      if (replyTo) row.reply_to = replyTo;   // v1.11: 답장
      return must(await sb.from('messages').insert(row).select().single());
    },
    // 답장의 원본처럼 화면에 없는 메시지 몇 개 불러오기
    async getMessagesByIds(roomId, ids) {
      if (!ids.length) return [];
      return must(await sb.from('messages').select('*').eq('room_id', roomId).in('id', ids));
    },
    // v1.11: 공감
    async getReactions(roomId, fromId) {
      let q = sb.from('message_reactions').select('message_id,user_id,emoji').eq('room_id', roomId);
      if (fromId) q = q.gte('message_id', fromId);
      const { data, error } = await q.limit(5000);
      if (error) { console.warn('reactions', error.message); return []; }   // 데이터베이스가 예전 버전이면 공감 없이
      return data || [];
    },
    async react(messageId, emoji) { return must(await sb.rpc('react_message', { p_id: messageId, p_emoji: emoji || null })); },
    // 내 메시지 삭제 (사진이면 파일도 지움)
    async deleteMessage(m) {
      must(await sb.rpc('delete_message', { p_id: m.id }));
      if (m.kind === 'image' && m.content && m.content !== '-') {
        try { await sb.storage.from('chat-images').remove([m.content]); } catch { /* 파일 삭제 실패는 무시 */ }
      }
      if (m.kind === 'file') {
        try { const f = JSON.parse(m.content); if (f && f.path) await sb.storage.from('chat-files').remove([f.path]); } catch { /* 무시 */ }
      }
    },
    async sendSticker(roomId, id) {
      return must(await sb.from('messages').insert({ room_id: roomId, kind: 'sticker', content: id }).select().single());
    },
    async sendImage(roomId, blob, ext) {
      const path = `${roomId}/${uid}-${Date.now()}.${ext}`;
      must(await sb.storage.from('chat-images').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' }));
      return must(await sb.from('messages').insert({ room_id: roomId, kind: 'image', content: path }).select().single());
    },
    // v1.10: 파일 보내기 (원래 이름은 메시지에, 저장소에는 영문 이름으로)
    async sendFile(roomId, file) {
      const ext = ((String(file.name || '').match(/\.([A-Za-z0-9]{1,8})$/) || [])[1] || '').toLowerCase();
      const path = `${roomId}/${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? '.' + ext : ''}`;
      must(await sb.storage.from('chat-files').upload(path, file, { contentType: file.type || 'application/octet-stream', cacheControl: '3600' }));
      const content = JSON.stringify({ path, name: String(file.name || '파일').slice(0, 200), size: file.size, type: String(file.type || '').slice(0, 100) });
      const { data, error } = await sb.from('messages').insert({ room_id: roomId, kind: 'file', content }).select().single();
      if (error) { sb.storage.from('chat-files').remove([path]).catch(() => {}); throw friendly(error); }
      return data;
    },
    // 내려받기 주소 (원래 파일 이름으로 저장되게)
    async fileUrl(path, name) {
      return must(await sb.storage.from('chat-files').createSignedUrl(path, 60 * 60 * 6, { download: name || true })).signedUrl;
    },
    async sendContact(roomId, c) {
      const content = JSON.stringify({ name: c.name, phones: c.phones });
      return must(await sb.from('messages').insert({ room_id: roomId, kind: 'contact', content }).select().single());
    },
    async imageUrls(paths) {
      if (!paths.length) return {};
      const rows = must(await sb.storage.from('chat-images').createSignedUrls(paths, 60 * 60 * 6));
      const out = {};
      for (const r of rows) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
      return out;
    },

    async touchLastSeen() { must(await sb.rpc('touch_last_seen')); },

    // ---------- 관리자 ----------
    async adminOrphanMedia() { return must(await sb.rpc('admin_orphan_media')) || []; },
    async adminSettings() { return must(await sb.rpc('admin_get_settings'))[0]; },
    async adminSetApproval(on) { must(await sb.rpc('admin_set_settings', { p_require_approval: on })); },
    async adminListUsers(q) { return must(await sb.rpc('admin_list_users', { p_query: q || '' })); },
    async adminSetStatus(id, status) { must(await sb.rpc('admin_set_status', { p_user: id, p_status: status })); },
    async adminSetAdmin(id, on) { must(await sb.rpc('admin_set_admin', { p_user: id, p_on: on })); },
    async adminResetPassword(id) { return must(await sb.rpc('admin_reset_password', { p_user: id })); },
    async adminDeleteUser(id) { must(await sb.rpc('admin_delete_user', { p_user: id })); },
    async adminClearPhone(id) { must(await sb.rpc('admin_clear_phone', { p_user: id })); },
    async adminBroadcast(text) { return must(await sb.rpc('admin_broadcast', { p_text: text })); },

    // ---------- 푸시 알림 구독 ----------
    async savePush(sub) {
      const j = sub.toJSON();
      must(await sb.rpc('save_push_subscription', {
        p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: navigator.userAgent,
      }));
    },
    async deletePush(endpoint) {
      must(await sb.rpc('delete_push_subscription', { p_endpoint: endpoint }));
    },

    // ---------- 실시간 ----------
    // 기본: 내 전용 비공개 채널(user:<내 ID>)로 내가 속한 방의 새 메시지만 받음 (Broadcast).
    //   → 접속자가 많아도 메시지 1건당 그 방 참여자에게만 전달돼 빠름.
    // 데이터베이스가 아직 v1.6 이 아니면(채널 권한 없음) 예전 방식(Postgres Changes)으로 자동 전환.
    subscribe({ onMessage, onMemberUpdate, onStatus, onFriend, onKicked, onDeleted, onReaction }) {
      let closed = false; let ch = null; let joined = false;
      const legacy = () => {
        rtMode = 'legacy';
        ch = sb.channel('minitalk-' + uid)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onMessage(p.new))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_members' }, (p) => onMemberUpdate(p.new))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => { if (p.new && p.new.kind === 'deleted' && onDeleted) onDeleted({ id: p.new.id, room_id: p.new.room_id }); })
          .subscribe((status) => onStatus && onStatus(status));
      };
      (async () => {
        try { await sb.realtime.setAuth(); } catch { /* 토큰은 자동으로도 설정됨 */ }
        if (closed) return;
        rtMode = 'broadcast';
        ch = sb.channel('user:' + uid, { config: { private: true } })
          .on('broadcast', { event: 'message' }, ({ payload }) => payload && onMessage(payload))
          .on('broadcast', { event: 'read' }, ({ payload }) => payload && onMemberUpdate(payload))
          .on('broadcast', { event: 'friend' }, ({ payload }) => payload && onFriend && onFriend(payload))
          .on('broadcast', { event: 'kicked' }, ({ payload }) => payload && onKicked && onKicked(payload))
          .on('broadcast', { event: 'deleted' }, ({ payload }) => payload && onDeleted && onDeleted(payload))
          .on('broadcast', { event: 'reaction' }, ({ payload }) => payload && onReaction && onReaction(payload))
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') joined = true;
            if (!joined && status === 'CHANNEL_ERROR' && !closed) {
              const old = ch; ch = null; sb.removeChannel(old); legacy(); return;
            }
            if (onStatus) onStatus(status);
          });
      })();
      return () => { closed = true; if (ch) sb.removeChannel(ch); };
    },
    realtimeMode() { return rtMode; },
    // 보고 있는 방의 읽음 표시 받기 (작은 방만 서버가 보내 줌)
    watchRoom(roomId, onRead) {
      if (rtMode !== 'broadcast') return () => {};
      const ch = sb.channel('room:' + roomId, { config: { private: true } })
        .on('broadcast', { event: 'read' }, ({ payload }) => payload && onRead(payload))
        .subscribe();
      return () => sb.removeChannel(ch);
    },

    get uid() { return uid; },
  };
  return api;
}
