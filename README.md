# 미니톡 설치 가이드

카카오톡처럼 쓰는 간단한 메신저 웹앱(PWA)입니다. 휴대폰 홈 화면에 설치해서 앱처럼 쓸 수 있고, 서버는 Supabase 무료 플랜, 호스팅은 GitHub Pages(무료)를 사용합니다.

## 주요 기능

- 아이디·비밀번호 회원가입 / 로그인, 비밀번호 변경
- 친구 추가(아이디 검색), 친구 삭제, 프로필 사진·이름·상태메시지
- 1:1 채팅, 단체 채팅(방 이름, 초대, 나가기)
- 실시간 메시지 수신, 읽지 않은 사람 수 표시(카카오톡의 숫자 1), 안 읽은 메시지 배지
- 사진 전송(자동으로 용량 줄여서 전송), 사진 크게 보기
- 링크 자동 연결, 날짜 구분선, 이전 대화 불러오기
- 전송 실패 시 다시 보내기, 인터넷 끊김 표시, 재연결 시 놓친 메시지 자동 수신
- 홈 화면 설치(PWA), **앱을 닫아도 오는 새 메시지 알림(Web Push)** — 7단계 설정 시

## 설치 순서 (약 15분)

### 1단계. Supabase 프로젝트 만들기

1. https://supabase.com 에 가입하고 **New project** 를 누릅니다.
2. 프로젝트 이름과 DB 비밀번호를 입력하고, Region은 **Northeast Asia (Seoul)** 을 선택합니다.
3. 프로젝트가 만들어질 때까지 1~2분 기다립니다.

### 2단계. 데이터베이스 설정 (SQL 한 번 실행)

1. 왼쪽 메뉴 **SQL Editor** → **New query** 를 엽니다.
2. `supabase/schema.sql` 파일 내용을 전부 복사해서 붙여넣고 **Run** 을 누릅니다.
3. `Success. No rows returned` 가 나오면 완료입니다. (여러 번 실행해도 안전합니다.)

### 3단계. 로그인 설정 — 꼭 해야 합니다

1. 왼쪽 메뉴 **Authentication** → **Sign In / Providers**(또는 Providers) → **Email** 을 엽니다.
2. **Confirm email** 을 **끕니다(OFF)** 하고 저장합니다.
   - 이 앱은 아이디로 로그인하기 때문에 확인 메일을 보내지 않습니다. 켜져 있으면 회원가입이 되지 않습니다.
3. 같은 화면에서 **Allow new users to sign up** 이 켜져 있는지 확인합니다.

### 4단계. 연결 정보를 앱에 입력

1. **Project Settings** → **API Keys**(또는 Data API) 에서 다음 두 값을 복사합니다.
   - **Project URL** (예: `https://abcdefghij.supabase.co`)
   - **Publishable key**(`sb_publishable_…`) 또는 **anon public** 키(`eyJ…`)
2. `js/config.js` 파일을 메모장으로 열어 아래 두 줄을 바꾸고 저장합니다.

```js
SUPABASE_URL: 'https://abcdefghij.supabase.co',
SUPABASE_ANON_KEY: 'sb_publishable_xxxxxxxx',
```

> ⚠️ `service_role` 또는 `secret` 키는 절대 넣지 마세요. 공개 키(anon/publishable)는 웹에 노출되어도 괜찮도록 데이터베이스에 보안 정책(RLS)이 걸려 있어, 본인이 참여한 대화만 볼 수 있습니다.

### 5단계. GitHub Pages로 배포

1. GitHub에서 **New repository** → 이름 예: `minitalk` → **Public** 으로 만듭니다.
2. **Add file → Upload files** 로 이 폴더 안의 파일과 폴더를 **전부** 끌어다 놓고 **Commit changes** 를 누릅니다.
   - `index.html` 이 저장소 맨 위(루트)에 있어야 합니다.
3. 저장소 **Settings → Pages** → Source: **Deploy from a branch**, Branch: **main / (root)** → **Save**.
4. 1~2분 뒤 `https://내아이디.github.io/minitalk/` 주소로 접속하면 앱이 열립니다.

> 저장소를 비공개로 두고 싶다면 GitHub Pages 대신 **Vercel**(무료)을 쓰면 됩니다. vercel.com 에서 GitHub로 로그인 → Add New → Project → 저장소 선택 → Deploy. 설정은 바꿀 필요 없습니다.

### 6단계. 휴대폰에 설치

- **안드로이드(크롬)**: 주소로 접속 → 오른쪽 위 메뉴(⋮) → **앱 설치** 또는 **홈 화면에 추가**
- **아이폰(사파리)**: 주소로 접속 → 아래 공유 버튼 → **홈 화면에 추가**
- 설치 후 **더보기 → 새 메시지 알림** 을 눌러 알림을 허용하세요. (아이폰은 홈 화면에 추가한 앱에서만 알림이 가능합니다.)

### 7단계. 앱을 닫아도 오는 알림 켜기 (약 10분)

이 단계를 건너뛰어도 앱은 정상 동작하며, 그때는 앱이 열려 있을 때만 알림이 옵니다.

1. `tools/push-setup.html` 파일을 크롬(또는 엣지)으로 엽니다. (파일을 더블클릭하면 됩니다.)
2. Supabase Project URL과 관리자 이메일을 넣고 **설정값 만들기**를 누릅니다. 화면에 나오는 순서대로 진행합니다.
   1. 만들어진 **SQL**을 복사해 SQL Editor에서 실행합니다.
   2. **Edge Functions → Deploy a new function → Via Editor** 에서 이름을 `send-push` 로 하고, 도구가 보여 주는 **함수 코드**를 붙여넣어 배포합니다. 배포 후 함수 설정에서 **Verify JWT**(JWT 검증)를 **끕니다.**
   3. **Edge Functions → Secrets** 에 도구가 만든 비밀값 4개(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET`)를 등록합니다.
   4. `js/config.js` 의 `VAPID_PUBLIC_KEY: '',` 줄을 도구가 만든 줄로 바꿔 GitHub에 다시 올립니다.
3. 각 사용자가 앱에서 **더보기 → 새 메시지 알림**을 눌러 허용하면 끝입니다. 한 번 허용하면 이후 로그인할 때마다 자동으로 다시 등록됩니다.

알아둘 점
- 같은 사람이 휴대폰과 PC에서 각각 켜면 두 기기 모두 알림을 받습니다. 로그아웃하면 그 기기로는 알림이 오지 않습니다.
- 앱 화면을 보고 있을 때는 시스템 알림 대신 앱 위쪽에 알림이 뜹니다. (아이폰은 규정상 시스템 알림도 함께 뜹니다.)
- 알림 내용은 기기에서만 풀 수 있게 암호화되어 전송됩니다. 내용을 아예 숨기고 싶으면 도구에서 "메시지 내용 보여 주기"를 끄고 만든 SQL을 다시 실행하세요.
- 알림이 오지 않으면: Supabase → Edge Functions → send-push → **Logs** 에서 오류를 확인하고, 휴대폰 설정에서 브라우저/앱 알림이 허용되어 있는지 확인하세요. 아이폰은 iOS 16.4 이상, 홈 화면에 추가한 앱에서만 됩니다.
- `tools` 폴더는 설정용이라 GitHub에 올리지 않아도 됩니다.

## 사용 방법

1. 회원가입: 아이디(영문 소문자·숫자·_ 3~20자), 이름, 비밀번호(6자 이상)
2. 친구 탭 오른쪽 위 버튼 → 친구 아이디 검색 → 추가
3. 친구를 누르고 **1:1 채팅**, 또는 채팅 탭 오른쪽 위 버튼으로 여러 명을 골라 단체방 만들기
4. 채팅방 오른쪽 위 메뉴: 대화상대 보기, 초대(단체방), 채팅방 나가기

## 관리자용 작업 (Supabase 대시보드)

**회원 비밀번호 초기화** — 확인 메일이 없으므로 관리자가 SQL로 바꿔 줍니다. SQL Editor에서 아이디와 새 비밀번호만 바꿔 실행하세요.

```sql
update auth.users
   set encrypted_password = extensions.crypt('새비밀번호123', extensions.gen_salt('bf'))
 where email = '아이디@minitalk.app';
```

**회원 삭제** — Authentication → Users → 해당 사용자 → Delete user (프로필·친구 관계도 함께 삭제됨)

**신규 가입 막기(지인만 쓰게 운영)** — 필요한 사람이 다 가입한 뒤 Authentication → Sign In / Providers → **Allow new users to sign up** 을 끕니다.

**회원 목록 보기** — Table Editor → `profiles` 테이블

## 무료 플랜에서 알아둘 점

- 데이터베이스 500MB, 사진 저장 공간 1GB, 동시 접속 약 200명 수준까지 무료입니다. 텍스트 위주라면 소규모 팀이 오래 쓸 수 있는 용량이고, 사진은 자동으로 줄여서(장당 약 200~500KB) 올라갑니다.
- **7일 동안 아무도 쓰지 않으면 프로젝트가 일시정지**됩니다. Supabase 대시보드에서 프로젝트를 열고 **Restore** 를 누르면 다시 켜집니다. 꾸준히 쓰면 정지되지 않습니다.
- 무료 플랜은 조직당 활성 프로젝트 2개까지 만들 수 있습니다.

## 현재 버전의 한계

- 7단계(알림 설정)를 하지 않으면 앱이 열려 있을 때만 알림이 옵니다.
- 휴대폰의 절전 모드·방해 금지 설정에 따라 알림이 늦거나 묶여서 올 수 있습니다.
- 음성·영상 통화, 메시지 삭제·수정, 파일(문서) 전송은 포함되어 있지 않습니다.
- 비밀번호 찾기는 메일 발송이 없으므로 위의 관리자 초기화 방법을 사용합니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 시작 페이지 |
| `css/style.css` | 화면 디자인 (흑백, G마켓 산스) |
| `js/config.js` | **서버 연결 정보 — 설치 시 이 파일만 수정** |
| `js/api.js` | 서버(Supabase) 통신 |
| `js/app.js` | 화면과 동작 |
| `sw.js`, `manifest.webmanifest`, `icons/` | 홈 화면 설치·오프라인 실행·알림 |
| `supabase/schema.sql` | 데이터베이스·보안 정책·사진 저장소 설정 |
| `supabase/push-setup.sql` | 앱을 닫아도 오는 알림용 설정 (도구가 값을 채워 줌) |
| `supabase/functions/send-push/index.ts` | 알림 발송 함수 (도구 화면에서도 복사 가능) |
| `tools/push-setup.html` | 알림용 키·설정값 생성 도구 (내 컴퓨터에서만 동작) |

## 수정·업데이트할 때

- 앱 이름: `js/config.js` 의 `APP_NAME`, 그리고 `index.html` 의 `<title>` 과 `manifest.webmanifest` 의 `name`
- 파일을 고쳐 GitHub에 다시 올리면 접속자에게 자동 반영됩니다. 설치된 앱에 바로 반영되지 않으면 `sw.js` 둘째 줄의 `minitalk-v1.1.0` 숫자를 올려서 함께 올리세요.
