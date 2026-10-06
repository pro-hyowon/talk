// =====================================================================
//  미니톡 — 화면과 동작
// =====================================================================
import { CONFIG } from './config.js';

const VERSION = '1.1.0';
const app = document.getElementById('app');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isNum = (v) => typeof v === 'number';

let api = null;
try {
  api = window.__MINITALK_API__ || (await import('./api.js')).createApi();
} catch (e) {
  console.error(e);
}

// ---------------------------------------------------------------------
// 아이콘
// ---------------------------------------------------------------------
const I = {
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.2" r="4.3"/><path d="M3.3 21.5c.9-4.6 4.4-7.3 8.7-7.3s7.8 2.7 8.7 7.3z"/></svg>',
  friends: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.6 8-6.6s7.2 2.4 8 6.6"/></svg>',
  chats: '<svg viewBox="0 0 24 24"><path d="M12 3.5c5 0 9 3.2 9 7.3s-4 7.3-9 7.3c-.9 0-1.8-.1-2.6-.3L5 20.3l1-3.6C4.2 15.4 3 13.2 3 10.8 3 6.7 7 3.5 12 3.5z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  addFriend: '<svg viewBox="0 0 24 24"><circle cx="10" cy="8" r="4"/><path d="M2.5 21c.8-4.2 3.8-6.6 7.5-6.6 1.6 0 3 .4 4.2 1.2M18.5 13v7M15 16.5h7"/></svg>',
  newChat: '<svg viewBox="0 0 24 24"><path d="M12 3.5c5 0 9 3.2 9 7.3s-4 7.3-9 7.3c-.9 0-1.8-.1-2.6-.3L5 20.3l1-3.6C4.2 15.4 3 13.2 3 10.8 3 6.7 7 3.5 12 3.5zM12 7.5v6.6M8.7 10.8h6.6"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 4.5 7.5 12l7.5 7.5"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
  logo: '<svg viewBox="0 0 24 24"><path d="M12 3.5c5 0 9 3.2 9 7.3s-4 7.3-9 7.3c-.9 0-1.8-.1-2.6-.3L5 20.3l1-3.6C4.2 15.4 3 13.2 3 10.8 3 6.7 7 3.5 12 3.5z"/></svg>',
};

// ---------------------------------------------------------------------
// 상태
// ---------------------------------------------------------------------
const S = {
  uid: null,
  entered: false,
  me: null,
  tab: 'friends',
  friends: [],
  rooms: [],
  roomsLoaded: false,
  room: null,
  roomToken: 0,
  fromList: false,
  profiles: new Map(),
  imgUrls: new Map(),
  unsub: null,
  wasSubscribed: false,
  installEvt: null,
  tmpSeq: 0,
  pushOn: false,
};

function cacheProfile(p) {
  if (p && p.id) S.profiles.set(p.id, { ...(S.profiles.get(p.id) || {}), ...p });
}
const profileOf = (id) => S.profiles.get(id) || null;

// ---------------------------------------------------------------------
// 날짜·시간 표시
// ---------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
function fmtTime(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`;
}
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const minuteKey = (iso) => { const d = new Date(iso); return `${dayKey(iso)}-${d.getHours()}-${d.getMinutes()}`; };
function fmtDate(iso) {
  const d = new Date(iso);
  const w = '일월화수목금토'[d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${w}요일`;
}
function fmtListTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(iso) === dayKey(now.toISOString())) return fmtTime(iso);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(iso) === dayKey(y.toISOString())) return '어제';
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

// ---------------------------------------------------------------------
// 공통 UI 조각
// ---------------------------------------------------------------------
function avatarHtml(p, cls = '') {
  const url = p && p.avatar_url;
  return `<div class="avatar ${cls}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : I.person}</div>`;
}
function roomAvatarHtml(r) {
  const ms = r.members || [];
  if (!r.is_group || ms.length <= 1) return avatarHtml(ms[0]);
  const four = ms.slice(0, 4);
  return `<div class="avatar avatar-group n${four.length}">${four.map((m) => avatarHtml(m)).join('')}</div>`;
}
function roomName(isGroup, title, others) {
  if (title) return title;
  if (!others.length) return '대화 상대 없음';
  return others.map((p) => p.display_name || '(알 수 없음)').join(', ');
}
function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+[^\s<.,!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function toast(text, { title = '', onClick = null, ms = 3200 } = {}) {
  const old = $('.toast'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="t-body">${title ? `<div class="t-title">${esc(title)}</div>` : ''}<div class="t-text">${esc(text)}</div></div>`;
  if (onClick) { el.style.cursor = 'pointer'; el.addEventListener('click', () => { el.remove(); onClick(); }); }
  app.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
const showErr = (e) => toast(e && e.message ? e.message : '오류가 발생했습니다.');

// 아래에서 올라오는 시트
function openSheet({ title, body, foot = '', onMount }) {
  const layer = $('#layer') || app;
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}">
    <div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="닫기">${I.close}</button></div>
    <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  layer.appendChild(back);
  const sheet = $('.sheet', back);
  if (onMount) onMount(sheet, close);
  return { el: sheet, close };
}
const closeAllSheets = () => $$('.sheet-back').forEach((x) => x.remove());

function ask(title, message, okLabel = '확인') {
  return new Promise((resolve) => {
    let done = false;
    const { close } = openSheet({
      title,
      body: `<p style="margin:4px 0 6px;color:var(--sub)">${esc(message)}</p>`,
      foot: `<div class="actions"><button class="btn ghost" data-no>취소</button><button class="btn" data-yes>${esc(okLabel)}</button></div>`,
      onMount(sheet, closeFn) {
        sheet.querySelector('[data-yes]').onclick = () => { done = true; closeFn(); resolve(true); };
        sheet.querySelector('[data-no]').onclick = () => { done = true; closeFn(); resolve(false); };
        new MutationObserver((_, obs) => { if (!sheet.isConnected) { obs.disconnect(); if (!done) resolve(false); } })
          .observe($('#layer') || app, { childList: true });
      },
    });
    void close;
  });
}

// 이미지 줄이기 (용량 절약)
async function loadBitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('사진을 읽을 수 없습니다.'));
      img.src = URL.createObjectURL(file);
    });
  }
}
async function resizeImage(file, max, square = false) {
  const src = await loadBitmap(file);
  const w0 = src.width; const h0 = src.height;
  let sx = 0; let sy = 0; let sw = w0; let sh = h0;
  if (square) { const s = Math.min(w0, h0); sx = (w0 - s) / 2; sy = (h0 - s) / 2; sw = sh = s; }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('사진 변환 실패'))), 'image/jpeg', 0.85));
}
async function prepareChatImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 보낼 수 있습니다.');
  if (file.type === 'image/gif') {
    if (file.size > 5 * 1024 * 1024) throw new Error('GIF는 5MB 이하만 보낼 수 있습니다.');
    return { blob: file, ext: 'gif' };
  }
  return { blob: await resizeImage(file, 1600), ext: 'jpg' };
}

// ---------------------------------------------------------------------
// 앱을 닫아도 오는 알림 (Web Push)
// ---------------------------------------------------------------------
const PUSH_KEY = (CONFIG.VAPID_PUBLIC_KEY || '').trim();
function b64urlToBytes(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('알림 기능을 준비하지 못했습니다. 새로고침 후 다시 시도하세요.')), ms))]);
const swReady = () => withTimeout(navigator.serviceWorker.ready, 10000);
const push = window.__MINITALK_PUSH__ || {
  supported: () => !!PUSH_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  async current() { return (await swReady()).pushManager.getSubscription(); },
  async subscribe() {
    return (await swReady()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(PUSH_KEY) });
  },
};
function sameServerKey(sub) {
  try {
    const k = sub.options && sub.options.applicationServerKey;
    if (!k) return true;
    const a = new Uint8Array(k); const b = b64urlToBytes(PUSH_KEY);
    return a.length === b.length && a.every((v, i) => v === b[i]);
  } catch { return true; }
}
// 이 기기를 알림 받는 기기로 등록 (키가 바뀌었으면 다시 등록)
async function enablePush({ silent = false } = {}) {
  if (!push.supported()) return false;
  if (Notification.permission !== 'granted') {
    if (silent) return false;
    if ((await Notification.requestPermission()) !== 'granted') return false;
  }
  let sub = await push.current();
  if (sub && !sameServerKey(sub)) { try { await sub.unsubscribe(); } catch { /* 무시 */ } sub = null; }
  if (!sub) sub = await push.subscribe();
  await api.savePush(sub);
  S.pushOn = true;
  return true;
}
async function disablePush() {
  const sub = await push.current();
  if (sub) {
    try { await api.deletePush(sub.endpoint); } catch (e) { console.warn(e); }
    try { await sub.unsubscribe(); } catch { /* 무시 */ }
  }
  S.pushOn = false;
}
// 로그아웃 전: 이 기기로 내 알림이 더 오지 않게
async function detachPush() {
  if (!push.supported()) return;
  try { const sub = await push.current(); if (sub) await api.deletePush(sub.endpoint); } catch (e) { console.warn(e); }
  S.pushOn = false;
}

// ---------------------------------------------------------------------
// 시작
// ---------------------------------------------------------------------
async function boot() {
  document.title = CONFIG.APP_NAME;
  if (!api) return renderFatal('서버 연결 모듈을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침하세요.');
  if (!api.configured) return renderSetup();
  api.onAuthChange((id) => { if (id) enterApp(id); else leaveApp(); });
  let id = null;
  try { id = await api.getSession(); } catch (e) { console.warn(e); }
  if (id) await enterApp(id); else renderAuth();
}

function renderFatal(msg) {
  app.innerHTML = `<div class="screen"><div class="auth-wrap"><div class="logo"><div class="logo-mark">${I.logo}</div><div><h2>${esc(CONFIG.APP_NAME)}</h2></div></div>
  <div class="setup-box">${esc(msg)}</div><div style="height:16px"></div><button class="btn" onclick="location.reload()">새로고침</button></div></div>`;
}

function renderSetup() {
  app.innerHTML = `<div class="screen"><div class="auth-wrap">
    <div class="logo"><div class="logo-mark">${I.logo}</div><div><h2>${esc(CONFIG.APP_NAME)}</h2><p>설치가 거의 끝났어요</p></div></div>
    <div class="setup-box"><b>서버 연결 정보가 아직 입력되지 않았습니다.</b>
      <ol>
        <li>Supabase 프로젝트를 만들고 <code>supabase/schema.sql</code>을 SQL Editor에서 실행합니다.</li>
        <li><code>js/config.js</code> 파일을 열어 <code>SUPABASE_URL</code>과 <code>SUPABASE_ANON_KEY</code>를 입력합니다.</li>
        <li>파일을 다시 올린 뒤 이 페이지를 새로고침합니다.</li>
      </ol>
      <p style="margin:12px 0 0;color:var(--muted);font-size:13px">자세한 순서는 함께 드린 설치 가이드(README.md)를 참고하세요.</p>
    </div></div></div>`;
}

function renderAuth(mode = 'login') {
  app.innerHTML = `<div class="screen"><div class="auth-wrap">
    <div class="logo"><div class="logo-mark">${I.logo}</div><div><h2>${esc(CONFIG.APP_NAME)}</h2><p>가볍고 간단한 메신저</p></div></div>
    <div class="seg"><button data-mode="login" class="${mode === 'login' ? 'on' : ''}">로그인</button><button data-mode="signup" class="${mode === 'signup' ? 'on' : ''}">회원가입</button></div>
    <form id="authForm" novalidate>
      <label class="field"><span>아이디</span><input class="input" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" inputmode="email" placeholder="영문 소문자·숫자·_ (3~20자)"></label>
      ${mode === 'signup' ? '<label class="field"><span>이름 (친구에게 보이는 이름)</span><input class="input" name="displayName" maxlength="20" placeholder="예) 홍길동"></label>' : ''}
      <label class="field"><span>비밀번호</span><input class="input" name="password" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" placeholder="6자 이상"></label>
      ${mode === 'signup' ? '<label class="field"><span>비밀번호 확인</span><input class="input" name="password2" type="password" autocomplete="new-password"></label><p class="hint">아이디는 가입 후 바꿀 수 없어요. 비밀번호를 잊으면 관리자에게 초기화를 요청해야 하니 꼭 기억해 두세요.</p>' : ''}
      <div class="error" id="authErr"></div>
      <button class="btn" type="submit" id="authBtn">${mode === 'signup' ? '가입하고 시작하기' : '로그인'}</button>
    </form></div></div>`;

  $$('.seg button').forEach((b) => (b.onclick = () => renderAuth(b.dataset.mode)));
  const form = $('#authForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const err = $('#authErr');
    const username = (f.username || '').trim().toLowerCase();
    err.textContent = '';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { err.textContent = '아이디는 영문 소문자·숫자·밑줄(_) 3~20자로 입력하세요.'; return; }
    if ((f.password || '').length < 6) { err.textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }
    if (mode === 'signup') {
      const name = (f.displayName || '').trim();
      if (!name) { err.textContent = '이름을 입력하세요.'; return; }
      if (f.password !== f.password2) { err.textContent = '비밀번호가 서로 다릅니다.'; return; }
    }
    const btn = $('#authBtn'); btn.disabled = true; btn.textContent = '잠시만요…';
    try {
      const id = mode === 'signup'
        ? await api.signUp({ username, password: f.password, displayName: f.displayName })
        : await api.signIn({ username, password: f.password });
      await enterApp(id);
    } catch (ex) {
      err.textContent = ex.message || '오류가 발생했습니다.';
      btn.disabled = false; btn.textContent = mode === 'signup' ? '가입하고 시작하기' : '로그인';
    }
  };
}

async function enterApp(id) {
  if (S.entered && S.uid === id) return;
  S.uid = id; S.entered = true;
  app.innerHTML = '<div class="spinner" style="margin-top:45vh"></div>';
  try {
    S.me = await api.getMyProfile();
  } catch (e) {
    S.entered = false; S.uid = null;
    renderAuth();
    showErr(e);
    return;
  }
  cacheProfile(S.me);
  buildShell();
  S.unsub = api.subscribe({ onMessage, onMemberUpdate, onStatus });
  await Promise.all([loadFriends(), loadRooms()]).catch(showErr);
  route();
  enablePush({ silent: true }).catch((e) => console.warn('push', e));
}

function leaveApp() {
  if (!S.entered) return;
  if (S.unsub) { try { S.unsub(); } catch { /* 무시 */ } }
  Object.assign(S, {
    uid: null, entered: false, me: null, friends: [], rooms: [], roomsLoaded: false, room: null,
    fromList: false, unsub: null, wasSubscribed: false, tab: 'friends', pushOn: false,
  });
  S.profiles.clear(); S.imgUrls.clear();
  setBadge(0);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  renderAuth();
}

function buildShell() {
  app.innerHTML = `
  <div id="main" class="screen">
    <div class="offline-bar" id="offline" ${navigator.onLine ? 'hidden' : ''}>인터넷 연결이 끊겼습니다</div>
    <div class="header" id="mainHeader"></div>
    <div class="scroll" id="mainBody"></div>
    <nav class="tabbar">
      <button data-act="tab" data-tab="friends" aria-label="친구">${I.friends}<span>친구</span></button>
      <button data-act="tab" data-tab="chats" aria-label="채팅">${I.chats}<span>채팅</span><span class="tab-badge" id="chatBadge"></span></button>
      <button data-act="tab" data-tab="more" aria-label="더보기">${I.more}<span>더보기</span></button>
    </nav>
  </div>
  <div id="room" class="screen room" hidden></div>
  <div id="layer"></div>`;
}

// ---------------------------------------------------------------------
// 화면 이동 (주소 #/friends, #/chats, #/more, #/room/<id>)
// ---------------------------------------------------------------------
function route() {
  if (!S.entered || !$('#main')) return;
  const h = location.hash;
  const m = h.match(/^#\/room\/([0-9a-f-]{36})$/i);
  if (m) {
    if (!S.room || S.room.id !== m[1]) openRoom(m[1]);
    return;
  }
  if (S.room) closeRoom();
  const t = (h.match(/^#\/(friends|chats|more)$/) || [])[1];
  if (t) S.tab = t;
  renderMain();
}
window.addEventListener('hashchange', route);
function go(hash) { if (location.hash !== hash) location.hash = hash; else route(); }
function goRoom(id) { closeAllSheets(); S.fromList = !(S.room); go('#/room/' + id); }
function backFromRoom() {
  if (S.fromList) { S.fromList = false; history.back(); }
  else location.replace('#/' + (S.tab || 'chats'));
}

// ---------------------------------------------------------------------
// 데이터 불러오기
// ---------------------------------------------------------------------
async function loadFriends() {
  S.friends = await api.listFriends();
  S.friends.forEach(cacheProfile);
  if (S.tab === 'friends' && !S.room) renderMain();
}
async function loadRooms() {
  S.rooms = await api.listRooms();
  S.roomsLoaded = true;
  S.rooms.forEach((r) => (r.members || []).forEach(cacheProfile));
  updateBadges();
  if (S.tab === 'chats' && $('#main')) renderMain();
}
let roomsPromise = null;
function refreshRoomsSoon() {
  if (!roomsPromise) {
    roomsPromise = new Promise((res) => setTimeout(async () => {
      roomsPromise = null;
      try { await loadRooms(); } catch (e) { console.warn(e); }
      res();
    }, 250));
  }
  return roomsPromise;
}
function updateBadges() {
  const total = S.rooms.reduce((s, r) => s + (r.unread || 0), 0);
  const b = $('#chatBadge');
  if (b) b.innerHTML = total ? `<span class="badge">${total > 999 ? '999+' : total}</span>` : '';
  setBadge(total);
}
function setBadge(n) {
  document.title = n ? `(${n}) ${CONFIG.APP_NAME}` : CONFIG.APP_NAME;
  try { if (n) navigator.setAppBadge?.(n); else navigator.clearAppBadge?.(); } catch { /* 지원 안 함 */ }
}

// ---------------------------------------------------------------------
// 메인 탭 화면
// ---------------------------------------------------------------------
function renderMain() {
  const head = $('#mainHeader'); const body = $('#mainBody');
  if (!head) return;
  $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  if (S.tab === 'friends') {
    head.innerHTML = `<h1>친구</h1><button class="icon-btn" data-act="add-friend" aria-label="친구 추가">${I.addFriend}</button>`;
    const me = S.me;
    body.innerHTML = `
      <button class="row me" data-act="profile" data-id="${esc(me.id)}">${avatarHtml(me)}
        <div class="meta"><div class="name">${esc(me.display_name)}</div><div class="desc">${esc(me.status_message || '상태메시지를 입력해 보세요')}</div></div></button>
      <div class="section-title">친구 ${S.friends.length}</div>
      ${S.friends.length ? S.friends.map((f) => `
        <button class="row" data-act="profile" data-id="${esc(f.id)}">${avatarHtml(f)}
          <div class="meta"><div class="name">${esc(f.display_name)}</div></div>
          ${f.status_message ? `<span class="status-chip">${esc(f.status_message)}</span>` : ''}</button>`).join('')
        : `<div class="empty"><b>아직 친구가 없어요</b>친구의 아이디로 검색해서 추가해 보세요.<div style="height:16px"></div><button class="btn sm" data-act="add-friend">친구 추가</button></div>`}`;
  } else if (S.tab === 'chats') {
    head.innerHTML = `<h1>채팅</h1><button class="icon-btn" data-act="new-chat" aria-label="새 채팅">${I.newChat}</button>`;
    if (!S.roomsLoaded) { body.innerHTML = '<div class="spinner"></div>'; return; }
    body.innerHTML = S.rooms.length ? S.rooms.map((r) => {
      const name = roomName(r.is_group, r.title, r.members || []);
      return `<button class="row" data-act="open-room" data-id="${esc(r.room_id)}">${roomAvatarHtml(r)}
        <div class="meta"><div class="name">${esc(name)}${r.is_group ? `<small>${r.member_count}</small>` : ''}</div>
        <div class="desc">${esc(r.last_message || '')}</div></div>
        <div class="side"><span>${esc(fmtListTime(r.last_message_at))}</span>${r.unread ? `<span class="badge">${r.unread > 999 ? '999+' : r.unread}</span>` : '<span style="height:20px"></span>'}</div></button>`;
    }).join('') : `<div class="empty"><b>대화가 없어요</b>친구 목록에서 친구를 눌러 대화를 시작하거나<br>오른쪽 위 버튼으로 새 채팅을 만들어 보세요.</div>`;
  } else {
    renderMore(head, body);
  }
}

function renderMore(head, body) {
  head.innerHTML = '<h1>더보기</h1>';
  const me = S.me;
  const notifState = !('Notification' in window) ? 'unsupported' : Notification.permission;
  const pushCapable = push.supported();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const notifLabel = notifState === 'granted' ? (pushCapable ? (S.pushOn ? '켜짐' : '꺼짐') : '켜짐 (앱이 열려 있을 때만)') : notifState === 'denied' ? '차단됨 (브라우저 설정에서 허용)' : notifState === 'unsupported' ? (ios && !standalone ? '홈 화면에 추가 후 사용 가능' : '지원하지 않는 브라우저') : '꺼짐';
  const installLabel = standalone ? '설치됨' : S.installEvt ? '설치하기' : ios ? '공유 버튼 → 홈 화면에 추가' : '브라우저 메뉴 → 앱 설치';

  body.innerHTML = `
    <div class="profile-card" style="padding-top:18px">
      <button data-act="change-avatar" aria-label="프로필 사진 변경" style="display:block;margin:0 auto">${avatarHtml(me, 'lg')}</button>
      <div style="font-size:12px;color:var(--muted);margin-top:-4px">사진을 눌러 변경</div>
      <input type="file" id="avatarInput" accept="image/*" hidden>
    </div>
    <div class="settings-group">
      <label class="field"><span>이름</span><input class="input" id="pfName" maxlength="20" value="${esc(me.display_name)}"></label>
      <label class="field"><span>상태메시지</span><input class="input" id="pfStatus" maxlength="60" value="${esc(me.status_message || '')}" placeholder="상태메시지 입력"></label>
      <button class="btn" data-act="save-profile">프로필 저장</button>

      <h4>계정</h4>
      <div class="settings-item"><span>내 아이디</span><small>${esc(me.username)}</small></div>
      <button class="settings-item" data-act="change-password"><span>비밀번호 변경</span><small>›</small></button>

      <h4>앱</h4>
      <button class="settings-item" data-act="notif"><span>새 메시지 알림</span><small>${esc(notifLabel)}</small></button>
      <button class="settings-item" data-act="install"><span>홈 화면에 앱 설치</span><small>${esc(installLabel)}</small></button>
      <button class="settings-item" data-act="logout"><span>로그아웃</span><small>›</small></button>
      <div class="settings-item" style="border:0"><span style="color:var(--muted)">버전</span><small>${VERSION}</small></div>
    </div>`;

  $('#avatarInput').onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      toast('프로필 사진을 올리는 중…');
      const blob = await resizeImage(file, 400, true);
      const url = await api.uploadAvatar(blob);
      S.me = await api.updateProfile({ avatar_url: url });
      cacheProfile(S.me); renderMain(); toast('프로필 사진을 바꿨어요.');
    } catch (ex) { showErr(ex); }
  };
}

// ---------------------------------------------------------------------
// 채팅방
// ---------------------------------------------------------------------
async function openRoom(id) {
  closeAllSheets();
  const token = ++S.roomToken;
  S.room = { id, info: null, members: [], msgs: [], hasMore: true, loadingOlder: false, atBottom: true };
  const el = $('#room');
  el.hidden = false;
  el.innerHTML = `
    <div class="header"><button class="icon-btn" data-act="room-back" aria-label="뒤로">${I.back}</button><h1 id="roomTitle"></h1>
      <button class="icon-btn" data-act="room-menu" aria-label="채팅방 메뉴">${I.menu}</button></div>
    <div class="msgs" id="msgs"><div class="spinner"></div></div>
    <button class="new-pill" id="newPill" data-act="to-bottom" hidden>새 메시지 ↓</button>
    <div class="composer">
      <button class="icon-btn" data-act="pick-photo" aria-label="사진 보내기">${I.plus}</button>
      <textarea id="msgInput" rows="1" maxlength="2000" placeholder="메시지 입력" aria-label="메시지 입력"></textarea>
      <button class="send-btn" id="sendBtn" data-act="send" disabled aria-label="보내기">${I.send}</button>
      <input type="file" id="photoInput" accept="image/*" multiple hidden>
    </div>`;
  wireComposer();

  try {
    const [info, members, msgs] = await Promise.all([api.getRoom(id), api.getMembers(id), api.getMessages(id)]);
    if (token !== S.roomToken) return;
    if (!info) { toast('대화방을 찾을 수 없습니다.'); closeRoom(); location.replace('#/chats'); return; }
    S.room.info = info;
    setMembers(members);
    S.room.msgs = msgs;
    S.room.hasMore = msgs.length >= 50;
    renderRoomHeader();
    renderMsgs();
    scrollBottom();
    markReadSoon();
  } catch (e) {
    if (token !== S.roomToken) return;
    $('#msgs').innerHTML = `<div class="empty"><b>불러오지 못했어요</b>${esc(e.message || '')}</div>`;
  }
}

function closeRoom() {
  S.roomToken++;
  S.room = null;
  const el = $('#room');
  if (el) { el.hidden = true; el.innerHTML = ''; }
  closeAllSheets();
}

function setMembers(rows) {
  S.room.members = rows.map((r) => {
    if (r.profiles) cacheProfile(r.profiles);
    return { id: r.user_id, last_read_id: r.last_read_id };
  });
}
const roomOthers = () => S.room.members.filter((m) => m.id !== S.uid).map((m) => profileOf(m.id) || { id: m.id, display_name: '(알 수 없음)' });

function renderRoomHeader() {
  const info = S.room.info;
  const name = roomName(info.is_group, info.title, roomOthers());
  $('#roomTitle').innerHTML = `${esc(name)}${info.is_group ? `<small>${S.room.members.length}</small>` : ''}`;
}

function unreadCount(m) {
  if (!isNum(m.id)) return 0;
  return S.room.members.filter((mb) => mb.last_read_id < m.id).length;
}

function sameGroup(a, b) {
  return a && b && a.kind !== 'system' && b.kind !== 'system' && a.sender_id === b.sender_id && minuteKey(a.created_at) === minuteKey(b.created_at);
}

function msgHtml(m, prev, next) {
  let out = '';
  if (!prev || dayKey(prev.created_at) !== dayKey(m.created_at)) out += `<div class="date-sep"><span>${fmtDate(m.created_at)}</span></div>`;
  if (m.kind === 'system') return out + `<div class="sys"><span>${esc(m.content)}</span></div>`;

  const mine = m.sender_id === S.uid;
  const first = !sameGroup(prev, m);
  const last = !sameGroup(m, next);
  const p = profileOf(m.sender_id);
  const n = unreadCount(m);
  const content = m.kind === 'image'
    ? `<div class="bubble photo"><img alt="사진" data-act="view-img" ${m.localUrl ? `src="${esc(m.localUrl)}"` : ''} data-path="${esc(m.content)}"></div>`
    : `<div class="bubble">${linkify(m.content)}</div>`;
  const info = `<div class="info"><span class="unread" data-unread="${esc(m.id)}">${n || ''}</span>${last && !m.pending && !m.failed ? `<span>${fmtTime(m.created_at)}</span>` : ''}${m.failed ? '<span>전송 실패</span>' : ''}</div>`;
  const cls = `msg ${mine ? 'mine' : ''} ${first ? 'first' : ''} ${m.pending ? 'pending' : ''} ${m.failed ? 'failed' : ''}`;
  const retry = m.failed ? ` data-act="retry" data-id="${esc(m.id)}"` : '';

  if (mine) return out + `<div class="${cls}"${retry}><div class="body"><div class="line">${content}${info}</div></div></div>`;
  return out + `<div class="${cls}">
    <div class="avatar-slot">${first ? `<button data-act="profile" data-id="${esc(m.sender_id || '')}">${avatarHtml(p, 'sm')}</button>` : ''}</div>
    <div class="body">${first ? `<div class="sender">${esc(p ? p.display_name : '(알 수 없음)')}</div>` : ''}<div class="line">${content}${info}</div></div></div>`;
}

function renderMsgs() {
  const box = $('#msgs'); if (!box || !S.room) return;
  const ms = S.room.msgs;
  if (!ms.length) {
    box.innerHTML = '<div class="empty" style="padding-top:30%"><b>대화를 시작해 보세요</b>첫 메시지를 보내면 상대방 채팅 목록에 나타나요.</div>';
    return;
  }
  let html = S.room.hasMore ? '<div class="load-more">위로 올리면 이전 대화를 불러옵니다</div>' : '';
  for (let i = 0; i < ms.length; i++) html += msgHtml(ms[i], ms[i - 1], ms[i + 1]);
  box.innerHTML = html;
  hydrateImages();
}

function updateReadCounts() {
  if (!S.room) return;
  const byId = new Map(S.room.msgs.map((m) => [String(m.id), m]));
  $$('#msgs [data-unread]').forEach((el) => {
    const m = byId.get(el.dataset.unread);
    if (m) { const n = unreadCount(m); el.textContent = n || ''; }
  });
}

async function hydrateImages() {
  const imgs = $$('#msgs img[data-path]').filter((i) => !i.getAttribute('src'));
  if (!imgs.length) return;
  const now = Date.now();
  const need = [...new Set(imgs.map((i) => i.dataset.path))].filter((p) => {
    const c = S.imgUrls.get(p); return !c || now - c.t > 5 * 3600 * 1000;
  });
  if (need.length) {
    try {
      const urls = await api.imageUrls(need);
      for (const [p, u] of Object.entries(urls)) S.imgUrls.set(p, { url: u, t: now });
    } catch (e) { console.warn(e); }
  }
  imgs.forEach((img) => { const c = S.imgUrls.get(img.dataset.path); if (c && img.isConnected) img.src = c.url; });
}

function scrollBottom() {
  const box = $('#msgs'); if (!box) return;
  box.scrollTop = box.scrollHeight;
  if (S.room) S.room.atBottom = true;
  const pill = $('#newPill'); if (pill) pill.hidden = true;
}

function addMessages(list, { forceBottom = false } = {}) {
  if (!S.room || !list.length) return;
  const wasBottom = S.room.atBottom;
  const have = new Set(S.room.msgs.filter((m) => isNum(m.id)).map((m) => m.id));
  const fresh = list.filter((m) => !have.has(m.id));
  if (!fresh.length) return;
  const real = S.room.msgs.filter((m) => isNum(m.id)).concat(fresh).sort((a, b) => a.id - b.id);
  const pending = S.room.msgs.filter((m) => !isNum(m.id));
  S.room.msgs = real.concat(pending);
  if (fresh.some((m) => m.kind === 'system')) refreshMembers();
  renderMsgs();
  if (forceBottom || wasBottom) scrollBottom();
  else { const pill = $('#newPill'); if (pill) pill.hidden = false; }
}

async function refreshMembers() {
  if (!S.room) return;
  const id = S.room.id;
  try {
    const rows = await api.getMembers(id);
    if (!S.room || S.room.id !== id) return;
    setMembers(rows);
    renderRoomHeader();
    renderMsgs();
  } catch (e) { console.warn(e); }
}

async function loadOlder() {
  const R = S.room;
  if (!R || !R.hasMore || R.loadingOlder) return;
  const firstReal = R.msgs.find((m) => isNum(m.id));
  if (!firstReal) return;
  R.loadingOlder = true;
  try {
    const older = await api.getMessages(R.id, firstReal.id);
    if (S.room !== R) return;
    R.hasMore = older.length >= 50;
    const box = $('#msgs');
    const prevH = box.scrollHeight; const prevTop = box.scrollTop;
    const have = new Set(R.msgs.map((m) => m.id));
    R.msgs = older.filter((m) => !have.has(m.id)).concat(R.msgs);
    renderMsgs();
    box.scrollTop = box.scrollHeight - prevH + prevTop;
  } catch (e) { showErr(e); }
  finally { R.loadingOlder = false; }
}

let readTimer = null;
function markReadSoon() {
  clearTimeout(readTimer);
  readTimer = setTimeout(async () => {
    if (!S.room || document.hidden) return;
    const id = S.room.id;
    try { await api.markRead(id); } catch (e) { console.warn(e); }
    const r = S.rooms.find((x) => x.room_id === id);
    if (r && r.unread) { r.unread = 0; updateBadges(); if (S.tab === 'chats') renderMain(); }
  }, 300);
}

function wireComposer() {
  const ta = $('#msgInput'); const btn = $('#sendBtn'); const box = $('#msgs');
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; btn.disabled = !ta.value.trim(); };
  ta.addEventListener('input', fit);
  ta.addEventListener('keydown', (e) => {
    const touch = matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !touch && !e.isComposing) { e.preventDefault(); sendText(); }
  });
  box.addEventListener('scroll', () => {
    if (!S.room) return;
    S.room.atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (S.room.atBottom) { const p = $('#newPill'); if (p) p.hidden = true; }
    if (box.scrollTop < 80) loadOlder();
  }, { passive: true });
  box.addEventListener('load', (e) => { if (e.target.tagName === 'IMG' && S.room && S.room.atBottom) box.scrollTop = box.scrollHeight; }, true);
  $('#photoInput').onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    for (const f of files.slice(0, 10)) await sendPhoto(f);
  };
}

async function sendText(retryMsg) {
  if (!S.room) return;
  const ta = $('#msgInput');
  const text = retryMsg ? retryMsg.content : ta.value.trim();
  if (!text) return;
  if (!retryMsg) { ta.value = ''; ta.style.height = 'auto'; $('#sendBtn').disabled = true; ta.focus(); }
  const R = S.room;
  const tmp = retryMsg || { id: 'tmp-' + (++S.tmpSeq), room_id: R.id, sender_id: S.uid, kind: 'text', content: text, created_at: new Date().toISOString() };
  tmp.pending = true; tmp.failed = false;
  if (!retryMsg) R.msgs.push(tmp);
  renderMsgs(); scrollBottom();
  try {
    const real = await api.sendText(R.id, text);
    R.msgs = R.msgs.filter((m) => m !== tmp);
    if (S.room === R) { addMessages([real], { forceBottom: true }); renderMsgs(); scrollBottom(); }
  } catch (e) {
    tmp.pending = false; tmp.failed = true;
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

async function sendPhoto(file, retryMsg) {
  if (!S.room) return;
  const R = S.room;
  let prepared;
  try { prepared = retryMsg ? retryMsg.prepared : await prepareChatImage(file); }
  catch (e) { showErr(e); return; }
  const localUrl = retryMsg ? retryMsg.localUrl : URL.createObjectURL(prepared.blob);
  const tmp = retryMsg || { id: 'tmp-' + (++S.tmpSeq), room_id: R.id, sender_id: S.uid, kind: 'image', content: '', localUrl, prepared, created_at: new Date().toISOString() };
  tmp.pending = true; tmp.failed = false;
  if (!retryMsg) R.msgs.push(tmp);
  renderMsgs(); scrollBottom();
  try {
    const real = await api.sendImage(R.id, prepared.blob, prepared.ext);
    S.imgUrls.set(real.content, { url: localUrl, t: Date.now() + 1e12 });
    R.msgs = R.msgs.filter((m) => m !== tmp);
    if (S.room === R) { addMessages([real], { forceBottom: true }); renderMsgs(); scrollBottom(); }
  } catch (e) {
    tmp.pending = false; tmp.failed = true;
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

// ---------------------------------------------------------------------
// 실시간 이벤트
// ---------------------------------------------------------------------
function onMessage(m) {
  if (S.room && m.room_id === S.room.id) {
    addMessages([m], { forceBottom: m.sender_id === S.uid });
    if (!document.hidden) markReadSoon();
  }
  refreshRoomsSoon().then(() => maybeNotify(m));
}

function onMemberUpdate(row) {
  if (S.room && row.room_id === S.room.id) {
    const mb = S.room.members.find((x) => x.id === row.user_id);
    if (mb) { mb.last_read_id = row.last_read_id; updateReadCounts(); }
    else refreshMembers();
  }
  if (row.user_id === S.uid) refreshRoomsSoon();
}

function onStatus(status) {
  if (status === 'SUBSCRIBED') {
    if (S.wasSubscribed) catchUp();
    S.wasSubscribed = true;
  }
}

async function catchUp() {
  if (!S.entered) return;
  refreshRoomsSoon();
  if (S.room) {
    const R = S.room;
    const lastReal = [...R.msgs].reverse().find((m) => isNum(m.id));
    try {
      const fresh = await api.getMessagesAfter(R.id, lastReal ? lastReal.id : 0);
      if (S.room === R) { addMessages(fresh); refreshMembers(); markReadSoon(); }
    } catch (e) { console.warn(e); }
  }
}

function maybeNotify(m) {
  if (!S.entered || m.sender_id === S.uid || m.kind === 'system') return;
  const inRoom = S.room && S.room.id === m.room_id;
  if (inRoom && !document.hidden) return;
  const sender = profileOf(m.sender_id);
  const r = S.rooms.find((x) => x.room_id === m.room_id);
  const name = sender ? sender.display_name : '새 메시지';
  const title = r && r.is_group ? `${name} · ${roomName(true, r.title, r.members || [])}` : name;
  const text = m.kind === 'image' ? '사진을 보냈습니다.' : m.content;

  if (document.hidden) {
    if (S.pushOn) return; // 서버 알림(Web Push)이 대신 보여 줌
    if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, {
        body: text.slice(0, 120), tag: m.room_id, renotify: true,
        icon: './icons/icon-192.png', badge: './icons/badge-72.png',
        data: { url: './#/room/' + m.room_id },
      })).catch(() => {});
    }
  } else {
    toast(text, { title, onClick: () => goRoom(m.room_id) });
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !S.entered) return;
  catchUp();
  if (S.room) markReadSoon();
});
window.addEventListener('online', () => { const o = $('#offline'); if (o) o.hidden = true; catchUp(); });
window.addEventListener('offline', () => { const o = $('#offline'); if (o) o.hidden = false; });

// ---------------------------------------------------------------------
// 시트들: 프로필, 친구 추가, 새 채팅, 방 메뉴 등
// ---------------------------------------------------------------------
function showProfile(id) {
  const p = profileOf(id);
  if (!p) { toast('알 수 없는 사용자입니다.'); return; }
  const isMe = id === S.uid;
  const isFriend = S.friends.some((f) => f.id === id);
  openSheet({
    title: '프로필',
    body: `<div class="profile-card">${avatarHtml(p, 'lg')}<div class="pname">${esc(p.display_name)}</div>
      ${p.username ? `<div class="pid">@${esc(p.username)}</div>` : ''}
      ${p.status_message ? `<div class="pstatus">${esc(p.status_message)}</div>` : ''}</div>`,
    foot: isMe
      ? '<button class="btn" data-x="edit">프로필 편집</button>'
      : `<div class="actions"><button class="btn" data-x="chat">1:1 채팅</button>${isFriend ? '<button class="btn line" data-x="unfriend">친구 삭제</button>' : '<button class="btn line" data-x="befriend">친구 추가</button>'}</div>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        const act = x.dataset.x;
        try {
          if (act === 'edit') { close(); S.fromList = false; S.tab = 'more'; if (S.room) location.replace('#/more'); else go('#/more'); }
          if (act === 'chat') { x.disabled = true; const rid = await api.openDM(id); close(); goRoom(rid); }
          if (act === 'befriend') { await api.addFriend(id); await loadFriends(); close(); toast(`${p.display_name}님을 친구로 추가했어요.`); }
          if (act === 'unfriend') {
            if (!(await ask('친구 삭제', `${p.display_name}님을 친구 목록에서 삭제할까요? 대화방은 그대로 남아요.`, '삭제'))) return;
            await api.removeFriend(id); await loadFriends(); close();
          }
        } catch (ex) { x.disabled = false; showErr(ex); }
      });
    },
  });
}

function showAddFriend() {
  openSheet({
    title: '친구 추가',
    body: `<p style="margin:0 0 12px;color:var(--sub);font-size:14px">친구의 아이디를 입력하세요. 내 아이디는 <b style="font-weight:500;color:var(--fg)">${esc(S.me.username)}</b> 입니다.</p>
      <form id="findForm" style="display:flex;gap:8px"><input class="input" name="q" autocapitalize="off" spellcheck="false" placeholder="친구 아이디" style="flex:1">
      <button class="btn" style="width:84px" type="submit">검색</button></form>
      <div id="findResult" style="margin-top:14px"></div>`,
    onMount(sheet, close) {
      const form = $('#findForm', sheet); const out = $('#findResult', sheet);
      setTimeout(() => form.q.focus(), 50);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const q = form.q.value.trim().toLowerCase();
        if (!q) return;
        out.innerHTML = '<div class="spinner" style="margin:16px auto"></div>';
        try {
          const u = await api.findUser(q);
          if (!u) { out.innerHTML = '<div class="empty" style="padding:20px">해당 아이디를 찾을 수 없어요.</div>'; return; }
          cacheProfile(u);
          const isMe = u.id === S.uid; const isFriend = S.friends.some((f) => f.id === u.id);
          out.innerHTML = `<div class="row" style="padding:10px 0">${avatarHtml(u)}<div class="meta"><div class="name">${esc(u.display_name)}</div><div class="desc">@${esc(u.username)}</div></div>
            ${isMe ? '<small style="color:var(--muted)">나</small>' : isFriend ? '<small style="color:var(--muted)">이미 친구</small>' : '<button class="btn sm" data-add>추가</button>'}</div>`;
          const add = $('[data-add]', out);
          if (add) add.onclick = async () => {
            add.disabled = true;
            try { await api.addFriend(u.id); await loadFriends(); close(); toast(`${u.display_name}님을 친구로 추가했어요.`); }
            catch (ex) { add.disabled = false; showErr(ex); }
          };
        } catch (ex) { out.innerHTML = ''; showErr(ex); }
      };
    },
  });
}

// 친구 고르기 (새 채팅·초대 공용)
function pickFriends({ title, exclude = [], confirmLabel, allowTitle }) {
  return new Promise((resolve) => {
    const list = S.friends.filter((f) => !exclude.includes(f.id));
    const sel = new Set();
    let finished = false;
    openSheet({
      title,
      body: list.length ? list.map((f) => `<button class="check-row" data-pick="${esc(f.id)}"><span class="check"></span>${avatarHtml(f, 'sm')}<span>${esc(f.display_name)}</span></button>`).join('')
        : `<div class="empty" style="padding:30px 0">${S.friends.length ? '초대할 수 있는 친구가 없어요.' : '먼저 친구를 추가해 주세요.'}</div>`,
      foot: list.length ? `${allowTitle ? '<input class="input" id="groupTitle" maxlength="30" placeholder="단체방 이름 (선택)" hidden style="margin-bottom:10px">' : ''}<button class="btn" id="pickOk" disabled>${esc(confirmLabel)}</button>` : '',
      onMount(sheet, close) {
        const ok = $('#pickOk', sheet); const gt = $('#groupTitle', sheet);
        sheet.addEventListener('click', (e) => {
          const b = e.target.closest('[data-pick]'); if (!b) return;
          const id = b.dataset.pick;
          if (sel.has(id)) sel.delete(id); else sel.add(id);
          $('.check', b).classList.toggle('on', sel.has(id));
          ok.disabled = !sel.size;
          ok.textContent = sel.size ? `${confirmLabel} (${sel.size})` : confirmLabel;
          if (gt) gt.hidden = sel.size < 2;
        });
        if (ok) ok.onclick = () => { finished = true; close(); resolve({ ids: [...sel], title: gt ? gt.value.trim() : '' }); };
        new MutationObserver((_, obs) => { if (!sheet.isConnected) { obs.disconnect(); if (!finished) resolve(null); } })
          .observe($('#layer') || app, { childList: true });
      },
    });
  });
}

async function newChat() {
  const r = await pickFriends({ title: '새 채팅', confirmLabel: '대화 시작', allowTitle: true });
  if (!r) return;
  try {
    const rid = r.ids.length === 1 ? await api.openDM(r.ids[0]) : await api.createGroup(r.title, r.ids);
    goRoom(rid);
    refreshRoomsSoon();
  } catch (e) { showErr(e); }
}

function showRoomMenu() {
  if (!S.room || !S.room.info) return;
  const R = S.room;
  const members = R.members.map((m) => profileOf(m.id) || { id: m.id, display_name: '(알 수 없음)' })
    .sort((a, b) => (a.id === S.uid ? -1 : b.id === S.uid ? 1 : 0));
  openSheet({
    title: `대화상대 ${members.length}`,
    body: `${R.info.is_group ? `<button class="check-row" data-x="invite"><span class="avatar sm" style="display:flex">${I.plus.replace('<svg', '<svg style="width:22px;height:22px;fill:none;stroke:#111;stroke-width:2"')}</span><span>대화상대 초대</span></button>` : ''}
      ${members.map((p) => `<button class="check-row" data-x="profile" data-id="${esc(p.id)}">${avatarHtml(p, 'sm')}<span>${esc(p.display_name)}${p.id === S.uid ? ' <small style="color:var(--muted)">(나)</small>' : ''}</span></button>`).join('')}`,
    foot: '<button class="btn line" data-x="leave">채팅방 나가기</button>',
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'profile') { close(); showProfile(x.dataset.id); }
        if (x.dataset.x === 'invite') {
          close();
          const r = await pickFriends({ title: '대화상대 초대', exclude: R.members.map((m) => m.id), confirmLabel: '초대하기' });
          if (r && r.ids.length) { try { await api.inviteToRoom(R.id, r.ids); } catch (ex) { showErr(ex); } }
        }
        if (x.dataset.x === 'leave') {
          close();
          const ok = await ask('채팅방 나가기', R.info.is_group ? '나가면 대화 내용이 목록에서 사라지고, 다시 초대받기 전까지 들어올 수 없어요.' : '나가면 이 대화방이 목록에서 사라져요. 상대가 새 메시지를 보내면 다시 나타나요.', '나가기');
          if (!ok) return;
          try {
            await api.leaveRoom(R.id);
            S.rooms = S.rooms.filter((x2) => x2.room_id !== R.id);
            updateBadges();
            S.fromList = false;
            S.tab = 'chats';
            location.replace('#/chats');
          } catch (ex) { showErr(ex); }
        }
      });
    },
  });
}

function showImage(img) {
  if (!img.src) return;
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `<img src="${esc(img.src)}" alt="사진"><a class="icon-btn save" href="${esc(img.src)}" download target="_blank" rel="noopener" aria-label="저장">${I.download}</a><button class="icon-btn close" aria-label="닫기">${I.close}</button>`;
  v.addEventListener('click', (e) => { if (!e.target.closest('.save')) v.remove(); });
  app.appendChild(v);
}

function showChangePassword() {
  openSheet({
    title: '비밀번호 변경',
    body: `<label class="field"><span>새 비밀번호</span><input class="input" id="pw1" type="password" autocomplete="new-password" placeholder="6자 이상"></label>
      <label class="field"><span>새 비밀번호 확인</span><input class="input" id="pw2" type="password" autocomplete="new-password"></label><div class="error" id="pwErr"></div>`,
    foot: '<button class="btn" id="pwOk">변경하기</button>',
    onMount(sheet, close) {
      $('#pwOk', sheet).onclick = async () => {
        const a = $('#pw1', sheet).value; const b = $('#pw2', sheet).value; const err = $('#pwErr', sheet);
        if (a.length < 6) { err.textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }
        if (a !== b) { err.textContent = '비밀번호가 서로 다릅니다.'; return; }
        try { await api.changePassword(a); close(); toast('비밀번호를 변경했어요.'); }
        catch (e) { err.textContent = e.message; }
      };
    },
  });
}

// ---------------------------------------------------------------------
// 클릭 처리 (한 곳에서)
// ---------------------------------------------------------------------
app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !app.contains(el)) return;
  const act = el.dataset.act;
  switch (act) {
    case 'tab': go('#/' + el.dataset.tab); break;
    case 'profile': if (el.dataset.id) showProfile(el.dataset.id); break;
    case 'add-friend': showAddFriend(); break;
    case 'new-chat': newChat(); break;
    case 'open-room': goRoom(el.dataset.id); break;
    case 'room-back': backFromRoom(); break;
    case 'room-menu': showRoomMenu(); break;
    case 'to-bottom': scrollBottom(); break;
    case 'send': sendText(); break;
    case 'pick-photo': $('#photoInput').click(); break;
    case 'view-img': showImage(el); break;
    case 'retry': {
      const m = S.room && S.room.msgs.find((x) => String(x.id) === el.dataset.id);
      if (!m) break;
      if (await ask('다시 보내기', '전송에 실패한 메시지를 다시 보낼까요?', '다시 보내기')) {
        if (m.kind === 'image') sendPhoto(null, m); else sendText(m);
      }
      break;
    }
    case 'change-avatar': $('#avatarInput').click(); break;
    case 'save-profile': {
      const name = $('#pfName').value.trim(); const status = $('#pfStatus').value.trim();
      if (!name) { toast('이름을 입력하세요.'); break; }
      el.disabled = true;
      try { S.me = await api.updateProfile({ display_name: name, status_message: status }); cacheProfile(S.me); toast('프로필을 저장했어요.'); }
      catch (ex) { showErr(ex); }
      el.disabled = false;
      break;
    }
    case 'change-password': showChangePassword(); break;
    case 'notif': {
      if (!('Notification' in window)) { toast('이 브라우저는 알림을 지원하지 않아요. 아이폰은 홈 화면에 추가한 뒤 사용할 수 있어요.'); break; }
      if (Notification.permission === 'denied') { toast('알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.', { ms: 5000 }); break; }
      if (push.supported()) {
        try {
          if (S.pushOn) {
            if (!(await ask('알림 끄기', '이 기기에서 새 메시지 알림을 받지 않을까요?', '끄기'))) break;
            await disablePush(); toast('이 기기의 알림을 껐어요.');
          } else {
            toast('알림을 설정하는 중…');
            toast((await enablePush()) ? '알림을 켰어요. 앱을 닫아도 새 메시지 알림이 와요.' : '알림 권한이 허용되지 않았어요.');
          }
        } catch (ex) { showErr(ex); }
      } else {
        const p = await Notification.requestPermission();
        toast(p === 'granted' ? '알림을 켰어요. (앱이 열려 있을 때만 와요)' : '알림이 꺼져 있어요.');
      }
      renderMain();
      break;
    }
    case 'install': {
      if (S.installEvt) { S.installEvt.prompt(); try { await S.installEvt.userChoice; } catch { /* 무시 */ } S.installEvt = null; renderMain(); }
      else toast('아이폰: 사파리 공유 버튼 → "홈 화면에 추가" / 안드로이드: 크롬 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"', { ms: 6000 });
      break;
    }
    case 'logout':
      if (await ask('로그아웃', '로그아웃할까요? 이 기기로는 알림이 오지 않게 됩니다.', '로그아웃')) { await detachPush(); await api.signOut(); leaveApp(); }
      break;
    default: break;
  }
});

// ---------------------------------------------------------------------
// 설치(PWA)·알림 클릭 연결
// ---------------------------------------------------------------------
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; if (S.tab === 'more' && S.entered) renderMain(); });
if ('serviceWorker' in navigator && !window.__MINITALK_API__) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 등록 실패', e));
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'open' && e.data.hash) go(e.data.hash);
    if (e.data && e.data.type === 'resubscribed' && S.entered) enablePush({ silent: true }).catch(() => {});
  });
}

boot();
