# Google Ads 전환 측정 설계

- 작성일: 2026-09-24
- 브랜치: `feat/google-ads-conversion`
- 배경: Google Ads 검색 캠페인 기획(siglens.io·ai.siglens.io). 두 사이트 모두 Google 태그가 없어 전환을 측정할 수 없고, ai.siglens.io 루트는 SSO 핸드오프 리다이렉트에서 광고 클릭 ID를 버린다.
- 결정: 태그 ID·전환 라벨은 코드 상수로 둔다(방식 A). Cloudflare Web Analytics 토큰(`shared/lib/cloudflareAnalytics.ts`)과 같은 선례 — HTML에 그대로 노출되는 공개 식별자라 비밀이 아니다.

## 1. 목표와 범위

목표: 광고 클릭 → 사이트 행동을 Google Ads 전환으로 기록한다.

전환 3종:

| 키 | 의미 | 발생 지점 |
|---|---|---|
| `signUp` | 회원가입 완료(이메일·OAuth) | 가입 서버 액션이 남긴 플래그 쿠키를 다음 페이지에서 읽을 때 |
| `chatQuestion` | SiglensAI에 질문 전송 | `useAgentStream.send` |
| `tickerSelect` | 종목 검색에서 종목 선택 | `useRecentSearches.addSearch` |

하지 않는 것:
- 리마케팅·맞춤형 광고. `allow_ad_personalization_signals: false`로 끈다. 측정만 한다.
- GA4, GTM, 향상된 전환(이메일 해시 전송).
- 동의 배너. 한국 대상이며 EEA 동의 모드 대상이 아니다. 고지는 개인정보처리방침으로 한다.
- 광고 캠페인 자체의 설정(계정에서 사람이 한다).

## 2. 구성 단위

### 2.1 `src/shared/config/googleAds.ts` — 설정 상수
- `GOOGLE_ADS_ID: string` — `AW-…`. 빈 문자열이면 태그 전체가 꺼진다. 운영 빌드(`NODE_ENV === 'production'`)가 아니거나 `E2E_TEST === '1'`이면 항상 빈 문자열이다. 개발 서버의 질문·가입이 광고 전환으로 잡히면 안 되고, E2E는 외부 호스트 요청을 금지한다(CF 비콘과 같은 이유).
- `E2E_TEST`는 `NEXT_PUBLIC_`이 아니라 클라이언트 번들에서는 항상 undefined다. 그래서 스크립트 로딩 여부는 **서버 컴포넌트인 레이아웃**이 `GOOGLE_ADS_ID`로 판단한다. 클라이언트의 `trackAdsConversion`은 E2E에서도 dataLayer에 쌓을 수 있지만, gtag.js가 로드되지 않으니 요청은 나가지 않는다.
- `SIGNUP_CONVERSION_COOKIE_DOMAIN = 'siglens.io'` — 운영 도메인 상수. 태그가 운영 빌드에서만 켜지므로 다른 환경의 도메인은 필요 없다. 개발 환경에서는 브라우저가 이 쿠키를 거부하는데, 그곳에서는 측정도 꺼져 있어 영향이 없다.
- `GOOGLE_ADS_CONVERSION_LABELS: Record<AdsConversion, string>` — 전환별 라벨. 빈 문자열인 전환은 보내지 않는다.
- `type AdsConversion = 'signUp' | 'chatQuestion' | 'tickerSelect'`.
- 값은 Google Ads에서 전환 액션을 만든 뒤 채운다. 그 전에는 전부 빈 문자열로 병합해도 동작 변화가 없다.

### 2.2 `src/shared/lib/googleAds.ts` — 전송 헬퍼 (쿠키 이름 `SIGNUP_CONVERSION_COOKIE_NAME = 'siglens_signup_conversion'`은 `shared/config/cookieNames.ts`)
- `trackAdsConversion(key: AdsConversion): void`
  - ID 또는 라벨이 비었거나 서버 환경(`typeof window === 'undefined'`)이면 아무것도 안 한다.
  - `window.dataLayer`에 `['event', 'conversion', { send_to: 'AW-…/label' }]`를 **`arguments` 객체로** 넣는다. gtag.js는 배열이 아니라 Arguments 객체만 명령으로 처리한다. `window.gtag`에 의존하지 않으므로 gtag.js 로드 전에 호출돼도 큐에 쌓였다가 로드 후 전송된다.
  - 예외를 던지지 않는다. 광고 측정 실패가 가입·질문·검색을 깨면 안 된다.
- `createSignupConversionCookie({ secure })` / `SIGNUP_CONVERSION_COOKIE_NAME`
  - 값 `'1'`, `maxAge` 600초, `path: '/'`, `sameSite: 'lax'`, `httpOnly: false`(클라이언트가 읽고 지워야 한다).
  - `domain`: `SIGNUP_CONVERSION_COOKIE_DOMAIN`(`siglens.io`). ai에서 시작한 가입은 메인 호스트에서 끝나고 핸드오프를 거쳐 ai 페이지로 돌아가므로, 메인 호스트 전용 쿠키로는 ai 쪽에서 읽을 수 없다. 값이 `'1'`뿐인 플래그라 형제 서브도메인에 보여도 새는 정보가 없다(인증 쿠키 도메인 확장을 폐기한 이유 — 토큰 노출 — 가 여기엔 없다).

### 2.3 `src/app/_components/GoogleAdsTag.tsx` — 클라이언트 컴포넌트
- props `{ id: string }`. 레이아웃이 `{GOOGLE_ADS_ID && <GoogleAdsTag id={GOOGLE_ADS_ID} />}`로 렌더한다.
- `next/script`(`afterInteractive`)로 `https://www.googletagmanager.com/gtag/js?id=…`를 로드하고, 인라인 초기화 스크립트로 `gtag('js', new Date()); gtag('config', ID, { allow_ad_personalization_signals: false })`.
- `consumeSignupConversionFlag()`(`shared/lib/googleAds`): `document.cookie`에서 플래그를 찾고, 있으면 같은 `Domain`·`Path`로 만료시킨 뒤 `true`.
- `usePathname()` 효과: 경로가 바뀔 때마다 `consumeSignupConversionFlag()`가 참이면 `trackAdsConversion('signUp')`. 경로마다 확인하는 이유: 가입 서버 액션의 `redirect`는 클라이언트 내비게이션이라 레이아웃이 다시 마운트되지 않는다.
- 두 레이아웃(`app/[locale]/layout.tsx`, `app/ai/[locale]/layout.tsx`)의 `<body>` 끝에 마운트한다. 메인 레이아웃은 CF 비콘 옆.

### 2.4 가입 서버 액션 2곳
- `features/auth-signup/actions/registerAction.ts`, `features/auth-oauth-consent/actions/finalizeOAuthSignupAction.ts`
- 인증 쿠키·힌트 쿠키를 설정하는 자리 바로 뒤에 `cookieStore.set(createSignupConversionCookie({ secure }))` 한 줄. 두 곳 모두 신규 계정 생성이 확정된 뒤에만 도달한다(기존 회원 로그인 경로는 이 액션을 지나지 않는다).

### 2.5 질문 전송
- `features/agent-chat/hooks/useAgentStream.ts`의 `send`에서 `trackAdsConversion('chatQuestion')`. `edit`·`regenerate`·`retry`는 새 질문이 아니므로 제외. Google Ads 전환 액션의 카운트를 "1회"로 설정해 클릭당 한 번만 세게 한다(계정 설정).

### 2.6 종목 선택
- `features/ticker-search/hooks/useRecentSearches.ts`의 `addSearch`에서 `trackAdsConversion('tickerSelect')`. 검색 오버레이, 검색 패널 자동완성, 최근 검색 클릭이 모두 `addSearch`를 거친다 — 호출부 3곳 대신 한 곳.

### 2.7 SSO 핸드오프에서 광고 파라미터 보존
- `app/ai/[locale]/handoffRedirect.ts`의 `maybeHandoffRedirect`는 지금 `q`만 `next`에 싣는다. 허용 목록으로 확장한다: `q`, `gclid`, `gbraid`, `wbraid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`. 목록 밖 파라미터는 지금처럼 버린다.
- 뒤 단계(`resolveHandoffNext` → `sanitizeNextPath`/`toSameOriginPath`, fallback `?sso=none`, consume 성공)는 이미 `next`의 쿼리를 보존한다. `/` 와 `/c/[id]` 두 페이지가 같은 함수를 쓰므로 둘 다 고쳐진다.

### 2.8 ai 호스트 CSP
- `src/proxy.ts`의 `AI_CSP`는 `img-src 'self' data:`다. 모델 출력의 이미지로 데이터를 빼내는 경로를 막는 장치라 유지하고, Google 태그 공식 CSP 가이드의 Google Ads 이미지 호스트만 더한다: `https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.co.kr`.
- 다른 지시어(script-src, connect-src)는 지금 정의돼 있지 않아 제한이 없다. 메인 호스트 CSP는 `frame-ancestors`뿐이라 변경 없음.
- 국가 도메인은 와일드카드가 안 되므로 광고 대상인 한국(`google.co.kr`)만 넣는다. 다른 국가로 광고를 넓히면 그 TLD를 추가한다.

### 2.9 개인정보처리방침 v5 (ko·en·ja·zh)
- `db/seeds/terms/privacy/v5*.md` 4개. v4를 복사해 두 절만 바꾼다.
  - 6절(위탁·국외 이전): **Google LLC(미국) — 광고 전환 측정(Google Ads)**. 이전 항목: 광고 클릭 식별자(gclid 등), 광고 쿠키 식별자, IP 주소, 브라우저 정보, 방문 페이지 주소, 전환 종류·시각. 이전 방법: 페이지 방문·전환 발생 시 암호화 통신으로 전송. 보유 기간: Google 정책에 따름.
  - 7절(쿠키): Google 광고 전환 쿠키(`_gcl_`로 시작, 최대 90일), 가입 직후 전환 측정용 임시 쿠키(10분). 맞춤형 광고(리마케팅)에는 쓰지 않는다는 문장. 거부 방법: 브라우저 쿠키 차단, Google 광고 설정.
- ~~`effectiveDate: 2026-10-05T00:00:00+09:00`~~ → **2026-09-24 사용자 결정으로 `2026-09-24T00:00:00+09:00`(즉시 시행)**, 공지 팝업은 배포 당일. 아래 원래 근거는 기록으로 남긴다. 현행 방침 11절이 "변경 사항의 시행 전 서비스 공지 또는 본 페이지를 통해 고지"를 약속하므로, 배포 후 시행일까지 공지 팝업(notices)으로 알린다. `findActive`는 시행일이 지난 버전만 보여 주므로 그 전까지 `/privacy`는 v4다.
- 태그 ID는 같은 PR에 채운다(즉시 시행 결정). 배포 직후 `yarn db:seed:terms`로 v5를 적재해 고지가 수집보다 늦지 않게 한다.
- 2·3·4절에도 한 줄씩 추가한다: 자동 수집 항목(광고 성과 측정), 이용 목적(광고 성과 측정, 맞춤형 광고 미사용), 보유 기간(`_gcl_` 쿠키 최대 90일, 가입 플래그 10분).
- 문장 ↔ 코드 대조표:

| 방침 문장 | 코드 |
|---|---|
| 리마케팅에 쓰지 않음 | `gtag('config', …, { allow_ad_personalization_signals: false })` |
| 이메일 등 식별 정보는 보내지 않음 | 향상된 전환 미사용, `trackAdsConversion`은 `send_to`만 보냄 |
| 가입 플래그 10분 | `createSignupConversionCookie` `maxAge: 600` |
| `_gcl_` 쿠키 최대 90일 | gtag 기본 `cookie_expires`(7776000초), 코드에서 바꾸지 않음 |

## 3. 데이터 흐름

```
광고 클릭 → siglens.io/…?gclid=X
  → GoogleAdsTag가 gtag 로드 → _gcl_aw 쿠키(Domain=siglens.io) 저장
  → 종목 검색 선택 → addSearch → trackAdsConversion('tickerSelect')

광고 클릭 → ai.siglens.io/about?gclid=X (또는 /?gclid=X)
  → [루트면] handoff start → siglens.io/api/auth/handoff → ai.siglens.io/?gclid=X&sso=none
  → gtag가 gclid 저장 → 질문 전송 → trackAdsConversion('chatQuestion')

가입 → registerAction / finalizeOAuthSignupAction
  → Set-Cookie siglens_signup_conversion=1; Domain=siglens.io; Max-Age=600
  → 다음 페이지(메인 또는 ai) GoogleAdsTag 효과 → trackAdsConversion('signUp') → 쿠키 삭제
```

## 4. 실패와 안전
- ID·라벨이 비면 전부 no-op. 병합만으로는 동작이 바뀌지 않는다.
- `trackAdsConversion`은 던지지 않는다. gtag.js가 광고 차단기로 막혀도 dataLayer에 쌓이기만 한다.
- CSP 확장은 이미지 호스트 6개. 스크립트 실행 권한은 넓어지지 않는다(원래 제한이 없었다).
- 핸드오프 허용 목록 밖 파라미터는 버린다. `next` 검증 경로는 그대로라 오픈 리다이렉트 방어는 바뀌지 않는다.

## 5. 테스트
- `shared/lib/googleAds`: ID·라벨이 비면 no-op, 채워지면 dataLayer에 Arguments 객체로 `send_to` 전송, window 없으면 no-op. 쿠키 도메인 계산(서브도메인 관계일 때만 domain).
- `GoogleAdsTag`: ID 없으면 렌더 없음, 플래그 쿠키가 있으면 전환 1회 + 쿠키 삭제, 없으면 전송 없음.
- 가입 액션 2곳: 성공 시 전환 쿠키 설정, 실패 경로에는 없음.
- `useAgentStream`: `send`만 전환, `regenerate`·`edit`는 아님.
- `useRecentSearches`: `addSearch` 호출 시 전환.
- `maybeHandoffRedirect`: gclid·utm이 `next`에 실리고, 목록 밖 파라미터는 빠짐.
- proxy: ai 응답 CSP에 Google 이미지 호스트 포함, `'self' data:` 유지.
- 개인정보처리방침 시드: 기존 `seedTerms.test.ts`는 가짜 픽스처만 쓴다. 실제 `db/seeds/terms` 파일 전체를 `parseSeedFile` → `validateSeedFiles`로 통과시키는 테스트를 하나 추가해 v5 frontmatter 오타(버전 건너뜀·로케일 오타)를 배포 전에 잡는다.

## 6. 배포 순서
1. (사람) Google Ads에서 전환 액션 3개 생성(웹사이트, 수동 코드 설치, 카운트 "1회"). AW-ID와 라벨 3개를 받는다.
2. 이 PR에 값을 채운다. 값이 아직 없으면 빈 채로 병합하고 후속 PR로 채운다.
3. 배포 직후 `yarn db:seed:terms`로 v5 적재(즉시 시행). 공지 팝업(notices)으로 방침 변경을 알린다.
4. Google Ads 전환 진단 또는 Tag Assistant로 세 전환이 기록되는지 확인한다.

## 7. 위험
- 개인정보 국외 이전의 동의 필요 여부는 법률 판단이다. 이 설계는 처리방침 공개로 고지한다. 법률 검토는 범위 밖이다.
- `tickerSelect`는 ai 호스트 검색에서도 발생한다. 두 캠페인이 같은 전환을 공유하므로 캠페인별 성과는 전환 액션이 아니라 캠페인 보고서로 나눠 본다.
