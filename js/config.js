// =====================================================================
//  미니톡 설정 파일 — 설치할 때 이 파일만 수정하면 됩니다.
//  Supabase 대시보드 > Project Settings > API (또는 Data API) 에서 복사하세요.
// =====================================================================

export const CONFIG = {
  // 예) 'https://abcdefghijklmn.supabase.co'
  SUPABASE_URL: 'https://djqrwushizofwjhshixl.supabase.co',

  // 예) 'eyJhbGciOi...' (anon public 키) 또는 'sb_publishable_...' (Publishable 키)
  //  ※ service_role / secret 키는 절대 넣지 마세요.
  SUPABASE_ANON_KEY: 'sb_publishable_5BWMz_Dcb2i_SmN__qQuQA_DutMv-Bt',

  // 화면에 표시될 앱 이름
  APP_NAME: '미니톡',

  // 아이디 로그인을 위한 내부용 주소 (실제 메일은 발송되지 않음). 바꿀 필요 없습니다.
  //  ※ 이미 가입자가 있는 상태에서 바꾸면 기존 회원이 로그인할 수 없습니다.
  LOGIN_DOMAIN: 'minitalk.app',

  // 앱을 닫아도 오는 알림(Web Push)용 공개 키 — tools/push-setup.html 에서 만든 값을 넣으세요.
  //  비워 두면 알림은 앱이 열려 있을 때만 옵니다.
  VAPID_PUBLIC_KEY: 'BAd4LSr8s4380YJD9l4K6zZGDM89mu0Y2b0saM8wq4Om83u2mOKP216S6Z3HPdZpPGIPtqKZYhxdFsPdXbN_98k',
};
