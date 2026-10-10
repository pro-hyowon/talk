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
