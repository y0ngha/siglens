# Siglens

<div align="center">

**미국 주식·한국 주식·암호화폐 AI 기술적 분석 — 티커만 넣으면 해석까지.**

![Status](https://img.shields.io/badge/status-production-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue)
![OXC](https://img.shields.io/badge/lint%2Fformat-OXC-c96198)
![Node.js](https://img.shields.io/badge/node-25.2.1-green)

[![Website](https://img.shields.io/badge/Website-siglens.io-blue?style=for-the-badge)](https://siglens.io)
[![English](https://img.shields.io/badge/README-English-white?style=for-the-badge)](https://github.com/y0ngha/siglens/blob/master/README.md)
[![Docs](https://img.shields.io/badge/Docs-Read%20Docs-green?style=for-the-badge)](https://github.com/y0ngha/siglens/tree/master/docs)
[![Issues](https://img.shields.io/badge/Issues-Report%20Bug-red?style=for-the-badge)](https://github.com/y0ngha/siglens/issues)

</div>

---

차트를 본다는 건 보조지표를 하나씩 올리고, 거래량을 확인하고, 패턴을 찾아본 다음 그 전부를 한 번에 판단하는 일입니다. Siglens는 그 해석을 대신합니다.

```text
기존 방식    보조지표 수동 추가 → 거래량 분석 → 패턴 해석 → 종합 판단
Siglens     티커 입력 → 차트·지표 자동 렌더 → AI 종합 리포트 확인
```

`AAPL`, `005930.KS`, `BTCUSD` 중 무엇을 입력하든 지표가 얹힌 캔들, 패턴 스캔, AI 분석 리포트, 뉴스 다이제스트, 공포탐욕 지수, 종합 시나리오가 한 페이지에 나옵니다. 주식은 펀더멘털·재무제표까지, 미국 주식은 의회 거래·옵션 시장까지 확장되고, 암호화폐는 24/7 시장에 맞는 축(차트·뉴스·공포탐욕·종합)에 집중합니다.

**Siglens는 주문을 넣지 않습니다.** 분석만 제공하며, 투자 판단은 읽는 사람 본인의 책임입니다.

현재 **[siglens.io](https://siglens.io)**에서 정식 운영 중입니다. 서비스 UI와 AI 리포트는 모두 한국어이고, 소스 코드와 기본 README는 영어, `docs/` 문서는 한국어로 작성합니다. 이 문서는 [영어 기본 README](./README.md)의 한국어판입니다.

### 목차

[기능](#기능) · [지원 시장](#지원-시장) · [페이지](#페이지) · [시작하기](#시작하기) · [아키텍처](#아키텍처) · [Skills](#skills-시스템) · [운영](#운영) · [문서](#문서) · [테스트](#테스트) · [명령어](#명령어)

---

## 기능

**분석 그 자체**

- **한국어 AI 리포트** — 기술적 신호, 뉴스, 공포탐욕을 통합하고 주식은 펀더멘털·재무제표까지, 미국 주식은 옵션·의회 거래까지 확장
- **패턴 감지** — Skills 기반으로 단일/멀티 캔들, 헤드앤숄더, 쐐기, 이중천장·바닥, 삼각수렴, 플래그, 컵앤핸들 판정
- **차트** — Lightweight Charts v5 기반 캔들·거래량·지표 오버레이, 시장별로 달라지는 타임프레임
- **폴링이 아니라 스트리밍** — 분석은 앱 안에서 SSE(`/api/analysis/stream`)로 진행됩니다. 마감 10분, 하트비트 25초. 외부 워커도 Redis Job 큐도 없습니다
- **잘린 본문 인지** — 문장 중간에서 끊긴 피드 본문을 판정해 프롬프트에 표시합니다. 모델이 사라진 수치를 지어내는 대신 덜 말하도록 유도합니다

**어떻게 사고할지 고르기**

- **페이지별 모델 선택** — DeepSeek(기본), Claude, Gemini, ChatGPT
- **추론 토글** — 회원은 분석마다 확장 추론을 켜고 끔. 무료 티어는 추론 OFF로 동작
- **BYOK** — Anthropic·Google·OpenAI·DeepSeek 키를 암호화 저장해 본인 쿼터로 호출
- **후속 대화** — 지금 보고 있는 분석 결과를 컨텍스트로 이어서 질문

**내 위치**

- **보유종목** — 심볼·수량·평단을 등록하면 가격대별 거래량 분포에서 내 평단이 어디에 있는지 확인
- **회원가입은 선택** — 핵심 기능은 비회원도 전부 사용. 로그인하면 tier 기반 모델·한도·BYOK가 열림

**시장 전체**

- **섹터 대시보드** — 11개 섹터 대형주 81종목에서 골든크로스·RSI 다이버전스·볼린저 스퀴즈 스캔
- **시장 공포탐욕 지수** `/fear-greed` — S&P500 모멘텀, VIX, 장기국채, 회사채, 동일가중 지수를 묶어 0~100 점수로 환산
- **뉴스 허브** — 미국 일반·주식·암호화폐·외환·마켓 아티클 카테고리별 AI 다이제스트
- **거시경제 대시보드** — 기준금리, CPI, 고용, GDP, 국채금리, 경제 캘린더, AI 브리핑
- **백테스팅** — 2024.11~2026.03 진입 기준 AI 분석 100건의 실제 수익률

<details>
<summary><b>지원 보조지표 전체</b></summary>

RSI · MACD · 볼린저 밴드 · ADX · DMI · Stochastic · StochRSI · CCI · VWAP · MA · EMA · Volume Profile · Ichimoku Cloud · ATR · Donchian Channel · Keltner Channel · SuperTrend · OBV · CMF · MFI · Parabolic SAR · Williams %R · Squeeze Momentum · Smart Money Concepts 등.

계산 명세는 [DOMAIN.md](./docs/product/DOMAIN.md)에 있습니다.

</details>

## 지원 시장

모든 심볼은 하나의 **market profile**로 귀결되고, 그 프로필이 통화·장 세션·타임프레임·데이터 소스·탭 구성을 결정합니다. 프로필 정의는 `src/shared/config/marketProfile/`에 있습니다.

| | 미국 주식 | 한국 주식 | 암호화폐 |
|---|---|---|---|
| 심볼 | `AAPL` | `005930.KS`(KOSPI) · `247540.KQ`(KOSDAQ) | `BTCUSD` |
| 가격 | USD, 소수점 2자리 | KRW, 정수 | USD, 자릿수 적응 |
| 장 세션 | NYSE/NASDAQ (ET) | KRX (KST) | 24/7 |
| 시세 지연 | 실시간 | 20분 | 실시간 |
| 타임프레임 | 5분·15분·30분·1시간·4시간·1일 | 5분·15분·30분·1시간·1일 | 5분·1시간·1일 |
| 시세·펀더멘털 | FMP | yahoo-finance2 | FMP |
| 뉴스 | FMP | 네이버 검색 API | FMP |
| 탭 | 9개 | 7개 | 5개 |

**한국 주식**(`kr-equity`)은 2026-08에 추가됐습니다. 코드를 읽기 전에 알아 둘 것:

- 거래소 접미사가 canonical 심볼의 일부라, `/^\d{6}\.K[SQ]$/` 정규식 하나로 DB 조회 없이 판정이 끝납니다. 미들웨어·ISR cold-gen·탭 가드가 전부 순수 함수로 유지됩니다.
- `4시간봉`이 없는 이유는 yahoo chart interval enum에 그 구간이 없기 때문입니다. OHLCV가 `null`인 봉은 지표 계산 전에 걸러냅니다.
- PER/PBR은 시가총액 기준 파생 계산입니다. yahoo는 KRX 종목의 `trailingPE`·`priceToBook`·`epsTrailingTwelveMonths`를 전부 `undefined`로 돌려줍니다.
- 한국 뉴스는 미국 경로가 거치는 번역 단계를 건너뜁니다 — 원문이 이미 한국어입니다.
- 한글 종목명 검색은 `yarn db:seed:kr-names`로 적재하는 `korean_tickers` 마스터가 필요합니다. yahoo `search`는 한글 쿼리 자체를 거부합니다.
- 옵션 탭 없음(국내 개별주식옵션은 유동성이 사실상 없음), 의회 거래 탭 없음(공직자 백지신탁은 관보 PDF로만 공개되어 API가 존재하지 않음).

소스별 대체 가능성과 탈락 근거는 [FMP_INVENTORY_KR.md](./docs/architecture/FMP_INVENTORY_KR.md)에 정리돼 있습니다.

## 페이지

### 심볼 페이지

| 경로 | 미국 | 한국 | 암호화폐 | 내용 |
|---|:---:|:---:|:---:|---|
| `/[symbol]` | ✓ | ✓ | ✓ | 차트, 기술적 분석, AI 리포트 |
| `/[symbol]/news` | ✓ | ✓ | ✓ | 심볼별 뉴스와 AI sentiment |
| `/[symbol]/fear-greed` | ✓ | ✓ | ✓ | 심볼별 공포탐욕 지수 |
| `/[symbol]/overall` | ✓ | ✓ | ✓ | 해당 시장이 지원하는 모든 축을 합친 종합 분석 |
| `/[symbol]/position` | ✓ | ✓ | ✓ | 가격대별 거래량 분포에서 내 평단 위치 |
| `/[symbol]/fundamental` | ✓ | ✓ | — | 재무, 밸류에이션, 애널리스트 컨센서스 |
| `/[symbol]/financials` | ✓ | ✓ | — | 손익계산서, 재무상태표, 현금흐름표, 성장률 |
| `/[symbol]/congress` | ✓ | — | — | 미국 공시 기반 의회 거래 흐름 |
| `/[symbol]/options` | ✓ | — | — | 옵션 체인, OI 분포, Max Pain, IV 분석 |

### 서비스 페이지

| 경로 | 내용 |
|---|---|
| `/market` | 섹터별 시장 신호 대시보드 |
| `/fear-greed` | 시장 전체 공포탐욕 지수와 구성 요인 |
| `/economy` | 거시경제 지표, 국채금리, 경제 캘린더, AI 브리핑 |
| `/news`, `/news/[category]` | 뉴스 허브 — 일반·주식·암호화폐·외환·마켓 |
| `/backtesting` | AI 분석 백테스팅 결과 |
| `/portfolio` | 등록한 보유종목 관리 |
| `/onboarding` | 가입 직후 보유종목 등록 |
| `/share/[id]` | 공유 가능한 분석 스냅샷 |

<details>
<summary><b>계정·운영 라우트</b></summary>

**계정**

| 경로 | 용도 |
|---|---|
| `/login`, `/signup` | 이메일·OAuth 로그인 / 회원가입 |
| `/signup/oauth/consent` | OAuth 가입 시 약관 동의 단계 |
| `/forgot-password`, `/reset-password` | 이메일 토큰 기반 비밀번호 재설정 |
| `/account` | 계정 설정, tier, BYOK 키 관리 |
| `/account/delete` | 회원 탈퇴 |
| `/terms`, `/privacy` | 이용약관, 개인정보처리방침 |

**운영 엔드포인트**

| 경로 | 용도 |
|---|---|
| `/api/analysis/stream` | SSE 분석 스트림 — tier 게이트, BYOK 해석, 하트비트, 마감 10분 |
| `/api/health` | shallow liveness 프로브 — ALB 타깃 그룹이 폴링 |
| `/api/ready` | deep readiness 프로브 (DB·Redis 도달성) |
| `/api/sse-probe` | 프록시 idle 타임아웃 실측용 스트리밍 진단 엔드포인트 |
| `/api/cron/seo-prewarm` | EventBridge가 호출하는 pre-warm 배치 (Bearer `CRON_SECRET`) |
| `/api/sitemap`, `/api/sitemap/{static,popular,crypto,longtail/[page],removal/[kind]}` | sitemap 인덱스·세그먼트·임시 제거 목록 |
| `/api/auth/[provider]/start`, `/api/auth/callback/[provider]` | OAuth 시작·콜백 |

</details>

### 데이터 출처

| 데이터 | 출처 | 비고 |
|---|---|---|
| 미국 주식·암호화폐 OHLCV | [Financial Modeling Prep](https://site.financialmodelingprep.com) | 주식 5분봉~일봉, 암호화폐 5분봉·1시간봉·일봉 |
| 미국 펀더멘털·재무제표·뉴스·의회 거래 | FMP `/stable` | 뉴스 sentiment는 자체 스코어링 |
| 한국 OHLCV·시세·펀더멘털·재무제표·종목코드 검색 | [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) | `chart`, `quoteSummary`, `fundamentalsTimeSeries`, `search`. 키 불필요 |
| 한국 상장 마스터·한글 검색 | [공공데이터포털 KRX 상장종목정보](https://www.data.go.kr/data/15094775/openapi.do) | `yarn db:seed:kr-names`가 `korean_tickers`에 적재 |
| 한국 뉴스 | [네이버 검색 API](https://developers.naver.com/docs/serviceapi/search/news/news.md) | 2026-07-31 개발자센터 신규 신청 마감 — NAVER API HUB에서 발급 |
| 옵션 체인 | yahoo-finance2 | 미국 전용. 스냅샷, OI, IV, Greeks |
| 거시경제 | FMP + Siglens DB | 경제 지표, 국채금리, 경제 캘린더 |

## 시작하기

```bash
git clone https://github.com/y0ngha/siglens.git
cd siglens
yarn install          # SIGLENS_GITHUB_TOKEN 필요 — 아래 참고
cp .env.example .env.local
yarn dev              # → http://localhost:4200
```

**Node.js 25.2.1**(`.nvmrc`)과 **yarn 4.12.0**이 필요합니다. `yarn install`이 GitHub Packages에서 `@y0ngha/siglens-core`를 받아오므로 설치 전에 `SIGLENS_GITHUB_TOKEN`이 있어야 합니다.

**없으면 부팅되지 않는 키:**

| 변수 | 발급처 | 용도 |
|---|---|---|
| `FMP_API_KEY` | [Financial Modeling Prep](https://site.financialmodelingprep.com/developer) | 미국 시세, 검색, 펀더멘털, 뉴스 |
| `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | 아래 `*_CHAT_API_KEY`와 동일한 콘솔 | 분석용 서버 사이드 LLM 호출. 앱이 프로바이더를 직접 호출합니다(워커 없음). 최소한 기본 분석 모델에 해당하는 키는 있어야 첫 분석이 성공합니다 |
| `DEEPSEEK_CHAT_API_KEY` | [DeepSeek](https://platform.deepseek.com/api_keys) | DeepSeek 모델 — 기본 분석 프로바이더 |
| `GEMINI_CHAT_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Gemini 모델, 챗봇, 옵션·뉴스·거시 해석 |
| `ANTHROPIC_CHAT_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Claude 모델 |
| `OPENAI_CHAT_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | ChatGPT 모델 |
| `DATABASE_URL` | [Neon](https://neon.tech) | PostgreSQL |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | [Upstash](https://upstash.com) | 분석 캐시, 시세 캐시, ISR 태그 스토어 |
| `DATA_GO_KR_SERVICE_KEY` | [공공데이터포털](https://www.data.go.kr/data/15094775/openapi.do) | 한국 상장 종목 마스터. **일반 인증키(Decoding)** 를 넣어야 합니다 — Encoding 키는 이중 인코딩돼 403 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | [NAVER API HUB](https://www.ncloud.com/product/applicationService/apiGateway) | 한국 종목 뉴스 |
| `OAUTH_TOKEN_ENCRYPTION_KEY`, `LLM_API_KEY_ENCRYPTION_KEY`, `OAUTH_STATE_HMAC_SECRET` | `openssl rand -hex 32` | 토큰·사용자 키 암호화, OAuth state 서명 |
| `CRON_SECRET` | 직접 생성 | cron 라우트·액션을 지키는 Bearer 토큰 |
| `SIGLENS_GITHUB_TOKEN` | [GitHub Tokens](https://github.com/settings/tokens) | `@y0ngha/siglens-core` 설치 |

한국 키 3종은 코드가 없어도 크래시하지 않지만 `infra/aws/check-env.sh`가 필수로 강제합니다. 없으면 조용히 degrade하기 때문입니다 — 뉴스 탭이 비고 한글 검색이 큐레이션 9종목으로 줄어드는데 에러는 어디에도 뜨지 않습니다. 배포 게이트에서 막히는 편이 낫습니다.

<details>
<summary><b>선택·운영 변수</b></summary>

| 변수 | 용도 |
|---|---|
| `UPSTASH_REDIS_REST_READONLY_TOKEN` | Redis 읽기 전용 접근 |
| `TRANSLATE_MODEL` | 종목명·기업 설명 번역 모델 (`DEEPSEEK_API_KEY`로 호출, DeepSeek 모델 id만 허용) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 구글 OAuth 로그인 |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | 카카오 OAuth 로그인 |
| `OAUTH_REDIRECT_BASE_URL` | OAuth 리다이렉트 기준 URL |
| `RESEND_API_KEY` / `EMAIL_FROM` | 이메일 발송 |
| `NEXT_PUBLIC_SITE_URL` | canonical 사이트 URL |
| `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` / `NEXT_PUBLIC_ADSENSE_SLOT_*` / `NEXT_PUBLIC_ADSENSE_ENABLED` | 구글 애드센스 |
| `ISR_CACHE_BUCKET` | S3 기반 ISR/fetch 캐시 핸들러 |
| `ALARM_EMAIL` | CloudWatch 알람 SNS 구독 |
| `DEBUG_VERBOSE_LOGS` | 서버 전용 verbose 로깅 |

</details>

## 아키텍처

6-레이어 Feature-Sliced Design. import는 한 방향으로만 흐릅니다.

```text
app → pages → widgets → features → entities → shared
                                                 ↑
                    @y0ngha/siglens-core — 모든 레이어에서 직접 import 가능
```

```text
siglens/
├── src/
│   ├── app/              Next.js App Router, RSC, 라우트 핸들러
│   ├── views/            FSD "pages" 레이어 — 페이지 단위 조합
│   ├── widgets/          차트, 분석 패널, 대시보드
│   ├── features/         인증, 검색, 챗, 보유종목, 프리미엄 게이트
│   ├── entities/         user, session, bars, analysis, ticker, portfolio…
│   └── shared/           UI, config, db, email, api(fmp·yahoo·dataGoKr), hooks, lib
├── skills/               분석 기법 Markdown
├── docs/                 아키텍처·제품·도메인·컨벤션 문서
├── e2e/                  Playwright 스펙과 하네스
├── cache-handler/        S3 기반 ISR/fetch 캐시 핸들러
├── infra/aws/            배포·운영 스크립트
└── refs/                 보조지표·투자 이론 레퍼런스
```

이 트리에서 처음 보면 놀라는 지점이 셋 있습니다.

**`pages` 레이어가 `src/views/`에 있습니다.** App Router 프로젝트에서 `src/pages/`를 만들면 레거시 Pages Router가 활성화되기 때문에 FSD 레이어 이름을 `views`로 뒀습니다. 이 매핑은 레포의 린트 boundary 규칙이 강제합니다 — 위반은 리뷰가 아니라 빌드에서 막힙니다.

**`@y0ngha/siglens-core`는 서드파티 의존성이 아닙니다.** Siglens 자신의 분석 도메인을 패키지로 분리한 것입니다 — 지표 계산, 패턴 탐지, 시그널 로직, 프롬프트 빌딩. 어느 레이어에서든 직접 import할 수 있습니다. 무엇이 core에 속하고 무엇이 여기 남는지는 [SCOPE.md](./docs/architecture/SCOPE.md), 레이어 규칙 자체는 [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)에 있습니다.

**프로바이더는 호출부가 아니라 어댑터 뒤에 있습니다.** `shared/api/{fmp,yahoo,dataGoKr}`가 market·fundamental·statements 포트를 같은 모양으로 구현하고, market profile이 그중 하나를 고릅니다. 한국 주식 추가가 페이지 분기가 아니라 descriptor + provider 추가로 끝난 이유이고, 나중에 한국 재무제표 소스를 바꿔도 어댑터 하나로 끝나는 이유입니다.

## Skills 시스템

분석 기법은 코드가 아니라 Markdown입니다.

```text
skills/<category>/my-strategy.md 추가  →  해당 기법이 즉시 반영
```

`entities/skill`이 이 파일들을 파싱해 `@y0ngha/siglens-core`의 프롬프트 빌더로 넘기므로, 새 기법을 추가해도 계산 코드는 건드리지 않습니다. `yarn validate:skills`가 frontmatter 계약을 검증하고, `yarn skills:digest-verify`가 분석 캐시 키에 들어가는 카탈로그 digest를 확인합니다.

| 카테고리 | 내용 |
|---|---|
| `_core/` | 모든 카테고리에 공통 적용되는 규약 |
| `indicators/` | 보조지표 시그널 해석 |
| `patterns/` | 차트 패턴 |
| `strategies/` | 엘리엇 파동, 대주기 분석 |
| `candlesticks/` | 캔들 패턴 교육 |
| `support-resistance/` | 피보나치, 피봇 포인트 |
| `fundamental/` | 가치·성장·퀄리티 관점 |
| `news/` | 이벤트 드리븐, 거시 영향, 실적 반응 |

## 운영

배포는 태그 기반입니다. `v*` 태그를 푸시하면 `.github/workflows/deploy.yml`이 돌면서 typecheck·유닛 테스트를 게이트로 걸고, 이미지를 빌드해 ECR에 푸시한 뒤 ASG를 instance refresh로 롤링합니다.

AWS(ALB + ASG/EC2, ECR, SSM, EventBridge, CloudWatch, S3 ISR 캐시) 위에서 Upstash Redis, Neon PostgreSQL, Resend 이메일, 앞단 Cloudflare와 함께 돌아갑니다. 긴 AI 작업은 앱 자신이 스트리밍으로 처리합니다 — 예전의 Cloud Run 워커와 Redis Job 큐는 제거됐습니다.

| 필요한 작업 | 읽을 문서 |
|---|---|
| 배포, 롤백, 장애 대응, 알람 확인 | [DEPLOY_RUNBOOK.md](./docs/architecture/DEPLOY_RUNBOOK.md) |
| AWS 스크립트 실행, 골든 AMI, env 게이트 통과 | [infra/aws/README.md](./infra/aws/README.md) |
| S3 ISR 캐시, kill switch, 태그 스토어 | [ISR_CACHE_HANDLER.md](./docs/architecture/ISR_CACHE_HANDLER.md) |
| 페이지별 revalidate 주기 변경 | [ISR_REVALIDATE.md](./docs/architecture/ISR_REVALIDATE.md) |
| Cloudflare 캐싱·WAF·봇 대응 조정 | [CDN_CACHING.md](./docs/architecture/CDN_CACHING.md) |
| pre-warm cron과 알람 작업 | [CRON.md](./docs/reference/CRON.md) |

## 문서

전체 인덱스는 **[docs/README.md](./docs/README.md)**에 있습니다. 가장 먼저 찾게 되는 문서:

| 문서 | 내용 |
|---|---|
| [SERVICE.md](./docs/product/SERVICE.md) | 서비스 개요, 타깃 사용자, Skills 시스템 |
| [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) | 레이어 구조, 의존 규칙, 데이터 흐름 |
| [SCOPE.md](./docs/architecture/SCOPE.md) | siglens와 siglens-core의 경계 |
| [DOMAIN.md](./docs/product/DOMAIN.md) | 지표 명세, 캔들 패턴, 비즈니스 규칙 |
| [FMP_INVENTORY_KR.md](./docs/architecture/FMP_INVENTORY_KR.md) | FMP 데이터 전수조사와 한국 주식 조달 방식 |
| [AUTH.md](./docs/product/AUTH.md) | 인증, 세션, OAuth, 이메일 토큰 |
| [API.md](./docs/reference/API.md) | 데이터·AI API와 환경변수 |
| [CONVENTIONS.md](./docs/conventions/CONVENTIONS.md) | 코딩 컨벤션, 네이밍, 테스트 정책 |
| [E2E.md](./docs/qa/E2E.md) | Playwright 하네스, 로컬/CI 실행, 스펙 작성 |
| [DESIGN.md](./docs/conventions/DESIGN.md) | 컬러 시스템, Tailwind 테마, 차트 상수 |
| [GIT_CONVENTIONS.md](./docs/conventions/GIT_CONVENTIONS.md) | 브랜치·커밋·PR 규칙 |
| [MISTAKES.md](./docs/workflows/MISTAKES.md) | 반복 실수와 예방법 |
| [SECURITY.md](./SECURITY.md) | 취약점 신고 절차 |

## 테스트

```bash
yarn test            # Vitest 전체
yarn test-coverage   # 커버리지 포함
yarn test:e2e        # Playwright
```

Vitest 테스트 파일 약 1,000개, Playwright 스펙 43개입니다. 커버리지 목표는 **90%**이고, 측정 범위는 `entities/`, `features/`, `shared/`, `widgets/`, `app/`, `src/proxy.ts`, `cache-handler/`입니다. 마지막 항목을 넣은 이유는 `src/` 밖에 있지만 프로덕션 코드이고, 빼 두면 커버리지가 조용히 썩기 때문입니다. `src/views/`는 현재 측정 대상이 아닙니다.

E2E는 Vitest와 별개로 실제 프로덕션 빌드를 브라우저에서 검증합니다 — [E2E.md](./docs/qa/E2E.md) 참고. `git push` 시 Husky 게이트가 format check, lint, typecheck, 유닛 테스트, 프로덕션 빌드를 전부 돌리므로 시간이 꽤 걸립니다.

### React Doctor

`npx react-doctor@latest`가 React 코드베이스를 감사한다(보안·정확성·접근성·성능·구조).
CI는 `.github/workflows/react-doctor.yml`로 모든 PR에서 실행되며, 그 PR이 **새로 추가한
error 등급** 지적이 있을 때만 실패시킨다. 룰 정책은 `doctor.config.json`에 있고 끈 룰마다
근거를 주석으로 남긴다.

## 명령어

일상적으로 쓰는 것:

```bash
yarn dev             # :4200 개발 서버
yarn build           # 프로덕션 빌드
yarn lint            # oxlint          (lint:fix로 자동 수정)
yarn typecheck       # TypeScript 7 (네이티브 tsc)
yarn format          # oxfmt           (format:check로 검사만)
yarn test            # Vitest
```

설치는 항상 `yarn`으로 합니다. `npm`과 `pnpm`은 쓰지 않습니다.

**툴체인은 TypeScript 7과 OXC입니다.** 타입 체크는 TypeScript 7의 네이티브 `tsc`(`typescript@7`, Go 포팅)로 돌아 전체 트리가 2초 남짓에 끝납니다. `@typescript/native-preview`는 Next 16.2가 자기 타입체크(레거시 `typescript/lib/typescript.js` API 필요 — TS7은 배포하지 않음)를 건너뛰게 하는 신호로 devDependencies에 남아 있습니다. 제거하면 `yarn build`가 깨집니다. 린트와 포맷은 OXC입니다 — `yarn lint`가 `oxlint`, `yarn format`이 `oxfmt`입니다. 스크립트 이름은 그대로라 Husky pre-push 훅과 CI는 예전과 같은 게이트를 호출합니다. 제약과 배경은 [TOOLCHAIN.md](./docs/conventions/TOOLCHAIN.md)에 정리했습니다.

<details>
<summary><b>package.json 전체 스크립트</b></summary>

| 명령어 | 용도 |
|---|---|
| `yarn dev` | Turbopack 개발 서버 (4200 포트) |
| `yarn build` | 프로덕션 빌드 |
| `yarn analyze` | 번들 분석기와 함께 빌드 |
| `yarn start` | Next.js 프로덕션 서버 |
| `yarn clear:build` | `.next` 산출물 제거 |
| `yarn copy:backtesting` | 백테스팅 JSON을 `public/backtesting`으로 복사 |
| `yarn clear:backtesting` | 생성된 `public/backtesting` 파일 제거 |
| `yarn predev` / `yarn prebuild` | dev/build 전 백테스팅 파일 재생성 |
| `yarn lint` | oxlint |
| `yarn lint:fix` | oxlint 자동 수정 |
| `yarn lint:staged` | staged 파일 oxlint 자동 수정 |
| `yarn lint:style` | Stylelint |
| `yarn lint:style-fix` | Stylelint 자동 수정 |
| `yarn format` | oxfmt write |
| `yarn format:staged` | staged 파일 oxfmt |
| `yarn format:check` | oxfmt check |
| `yarn typecheck` | TypeScript 7 네이티브 `tsc` 타입체크 |
| `yarn db:generate` | Drizzle migration 생성 |
| `yarn db:migrate` | migration 실행 |
| `yarn db:seed:terms` | 약관 데이터 seed |
| `yarn db:migrate:tickers` | 한국어 ticker 데이터 seed/update |
| `yarn db:seed:crypto` | FMP crypto universe를 `crypto_assets`에 적재 |
| `yarn db:seed:crypto-korean` | 암호화폐 한국어 이름 seed |
| `yarn db:backfill:calendar` | 경제 캘린더 backfill |
| `yarn db:seed:calendar-analysis` | 경제 캘린더 분석 seed |
| `yarn test` | Vitest 전체 |
| `yarn test:quiet` | dot 리포터 Vitest |
| `yarn test:related` | 변경 파일 관련 테스트 |
| `yarn test-watch` | Vitest watch 모드 |
| `yarn test-coverage` | 커버리지 포함 Vitest |
| `yarn test-coverage-watch` | watch 모드 커버리지 |
| `yarn test-coverage-report` | verbose 커버리지 리포트 |
| `yarn e2e` | E2E 하네스 스크립트 실행 |
| `yarn e2e:up` / `yarn e2e:down` | E2E Compose 스택 기동 / 정리 |
| `yarn e2e:db` | E2E DB 글로벌 셋업 |
| `yarn test:e2e` | Playwright 테스트 |
| `yarn test:e2e:ui` | Playwright UI 모드 |
| `yarn validate:skills` | Skills Markdown 검증 |
| `yarn skills:digest-verify` | Skills digest 검증 |
| `yarn skills:digest-update` | Skills digest 메타 갱신 |
| `yarn prepare` | Husky 훅 설치 |
| `yarn release` | release-it |
| `yarn release:patch` / `:minor` / `:major` | 버전별 릴리스 |
| `yarn fetch-this-week-tasks` | 주간 작업 조회 스크립트 |
| `yarn update-popular-tickers` | 인기 티커 목록 갱신 |
| `yarn update-popular-cryptos` | 인기 크립토 목록 갱신 |

</details>

## 보안

취약점은 공개 이슈로 열지 말아 주세요 — 신고 절차는 [SECURITY.md](./SECURITY.md)에 있습니다.

## 기여

외부 코드 기여는 아직 공식적으로 열려 있지 않습니다. 버그 리포트와 제안은 [Issues](https://github.com/y0ngha/siglens/issues)에서 환영합니다.

Skills도 아직 공개 리뷰·머지 워크플로가 없습니다. Markdown 파일 하나로 분석이 확장되도록 의도적으로 설계했으니, frontmatter 표준과 검증이 정리되는 대로 기여 가이드를 따로 제공할 예정입니다.

## 라이선스

[MIT License](./LICENSE)

---

<div align="center">

**[맨 위로](#siglens)** · **[English README](https://github.com/y0ngha/siglens/blob/master/README.md)**

</div>
