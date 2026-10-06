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
    [/Invalid login credentials/i, '아이디 또는 비밀번호가 올바르지 않습니다.'],
    [/already registered|already exists/i, '이미 사용 중인 아이디입니다.'],
    [/Database error saving new user/i, '가입할 수 없는 아이디입니다. 영문 소문자·숫자·밑줄(_) 3~20자로 입력하세요.'],
    [/Password should be at least/i, '비밀번호는 6자 이상이어야 합니다.'],
    [/weak/i, '비밀번호가 너무 쉽습니다. 다른 비밀번호를 사용하세요.'],
    [/rate limit|too many/i, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.'],
    [/Email not confirmed/i, '관리자 설정 필요: Supabase에서 "Confirm email"을 꺼야 합니다.'],
    [/Signups not allowed|signup is disabled/i, '현재 신규 가입이 막혀 있습니다. 관리자에게 문의하세요.'],
    [/Failed to fetch|NetworkError|Load failed/i, '인터넷 연결을 확인하세요.'],
    [/JWT expired/i, '로그인이 만료되었습니다. 다시 로그인하세요.'],
    [/Payload too large|exceeded the maximum allowed size/i, '파일이 너무 큽니다. (최대 5MB)'],
    [/row-level security/i, '권한이 없습니다.'],
    [/(save|delete)_push_subscription/i, '알림 서버 설정(push-setup.sql)이 아직 되어 있지 않습니다. 관리자에게 문의하세요.'],
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
        throw new Error('관리자 설정 필요: Supabase > Authentication > Sign In / Providers > Email 에서 "Confirm email"을 꺼 주세요.');
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
    async changePassword(password) { must(await sb.auth.updateUser({ password })); },

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
    async findUser(username) {
      const rows = must(await sb.rpc('find_user', { p_username: username }));
      return rows[0] || null;
    },
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
    async leaveRoom(roomId) { must(await sb.rpc('leave_room', { p_room: roomId })); },
    async markRead(roomId) { must(await sb.rpc('mark_read', { p_room: roomId })); },
    async getRoom(roomId) {
      return must(await sb.from('rooms').select('id,is_group,title').eq('id', roomId).maybeSingle());
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
    async sendText(roomId, text) {
      return must(await sb.from('messages').insert({ room_id: roomId, kind: 'text', content: text }).select().single());
    },
    async sendImage(roomId, blob, ext) {
      const path = `${roomId}/${uid}-${Date.now()}.${ext}`;
      must(await sb.storage.from('chat-images').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' }));
      return must(await sb.from('messages').insert({ room_id: roomId, kind: 'image', content: path }).select().single());
    },
    async imageUrls(paths) {
      if (!paths.length) return {};
      const rows = must(await sb.storage.from('chat-images').createSignedUrls(paths, 60 * 60 * 6));
      const out = {};
      for (const r of rows) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
      return out;
    },

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
    subscribe({ onMessage, onMemberUpdate, onStatus }) {
      const ch = sb.channel('minitalk-' + uid)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onMessage(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_members' }, (p) => onMemberUpdate(p.new))
        .subscribe((status) => onStatus && onStatus(status));
      return () => sb.removeChannel(ch);
    },

    get uid() { return uid; },
  };
  return api;
}
