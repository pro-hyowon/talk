// 끼리톡 — 약관·방침 페이지에 앱 이름·운영자·문의 이메일을 설정 파일(js/config.js)에서 채워 넣음
import { CONFIG } from './config.js';

const OLD = '미니톡';   // 예전 이름이 설정에 남아 있으면 새 이름으로
const APP = !CONFIG.APP_NAME || CONFIG.APP_NAME === OLD ? '끼리톡' : CONFIG.APP_NAME;
const EMAIL = String(CONFIG.CONTACT_EMAIL || '').trim();
const OWNER = String(CONFIG.OPERATOR_NAME || '').trim();
const REGION = String(CONFIG.SERVER_REGION || '').trim();
const missing = (t) => `<span class="missing">${t}</span>`;
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.querySelectorAll('[data-app]').forEach((el) => { el.textContent = APP; });
document.querySelectorAll('[data-contact]').forEach((el) => {
  el.innerHTML = EMAIL ? `<a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a>` : missing('(운영자 이메일 미등록 — js/config.js 의 CONTACT_EMAIL)');
});
document.querySelectorAll('[data-owner]').forEach((el) => {
  el.innerHTML = OWNER ? esc(OWNER) : missing('(운영자 이름 미등록 — js/config.js 의 OPERATOR_NAME)');
});
document.querySelectorAll('[data-region]').forEach((el) => {
  el.innerHTML = REGION ? esc(REGION) : missing('(서버 지역 미등록 — js/config.js 의 SERVER_REGION)');
});
document.title = document.title.replace('{APP}', APP);

// v1.21: 대화·사진 보관 기간을 실제 설정값으로 보여 줌 (관리자가 바꾸면 약관 문구도 같이 바뀜. 못 불러오면 기본 문구 그대로)
const URL_ = String(CONFIG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const KEY = String(CONFIG.SUPABASE_ANON_KEY || '').trim();
const KEEP_TEXT = {
  msg: (n) => (n > 0 ? `보낸 날부터 <b>${n}일</b>이 지나면 서버에서 자동으로 삭제합니다` : '지금은 보관 기간을 따로 정하지 않았지만, 보관 기간을 정하면 미리 알린 뒤 그 기간이 지난 글을 서버에서 삭제합니다'),
  media: (n) => (n > 0 ? `사진·파일은 보낸 날부터 <b>${n}일</b> 동안만 보관하고 그 뒤에는 자동으로 삭제합니다` : '사진·파일은 지금은 보관 기간을 따로 정하지 않았지만, 보관 기간을 정하면 미리 알린 뒤 그 기간이 지난 파일을 삭제합니다'),
};
const KEEP_TEXT_PRIVACY = {
  msg: (n) => (n > 0 ? `보낸 날부터 <b>${n}일</b>이 지나면 서버에서 차례로 자동 삭제합니다` : '지금은 보관 기간을 따로 정하지 않았으며, 정하면 미리 알린 뒤 그 기간이 지난 글을 서버에서 삭제합니다'),
  media: (n) => (n > 0 ? `보낸 날부터 <b>${n}일</b>이 지나면 서버 저장 공간에서 차례로 자동 삭제합니다` : '지금은 보관 기간을 따로 정하지 않았으며, 정하면 미리 알린 뒤 그 기간이 지난 파일을 삭제합니다'),
};
if (URL_ && KEY && !/YOUR_/.test(URL_ + KEY) && document.querySelector('[data-keep-sentence]')) {
  fetch(`${URL_}/rest/v1/rpc/app_info`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' })
    .then((r) => (r.ok ? r.json() : null))
    .then((info) => {
      if (!info || typeof info !== 'object') return;
      const T = /privacy/.test(location.pathname) ? KEEP_TEXT_PRIVACY : KEEP_TEXT;
      document.querySelectorAll('[data-keep-sentence]').forEach((el) => {
        const kind = el.dataset.keepSentence;
        const n = Number(kind === 'msg' ? info.msg_keep_days : info.media_keep_days);
        if (T[kind] && Number.isFinite(n)) el.innerHTML = T[kind](Math.max(0, Math.round(n)));
      });
    })
    .catch(() => { /* 기본 문구 그대로 */ });
}
