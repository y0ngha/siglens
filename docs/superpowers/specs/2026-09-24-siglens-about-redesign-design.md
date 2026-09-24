# siglens.io/about 재구성 설계 (2026-09-24)

## 목표

`siglens.io/about`을 약관형 마크다운 문서에서, `ai.siglens.io/about`처럼 **보여주면서 설명하는** 소개 페이지로 바꾼다.
기존 본문(운영자·분석 방식·갱신 주기·한계·면책·문의)은 E-E-A-T 근거라 전부 유지하되 섹션으로 재배치한다.
이 페이지는 SEO용이다. 브랜드 검색("시그렌즈", "siglens")과 "AI 주식 분석 사이트", "주식 AI 분석 무료" 류의 정보형 검색을 받는다.

## 결정

1. **뷰 슬라이스 신설** `src/views/about/`. 라우트(`app/[locale]/about/page.tsx`)는 메타데이터·JSON-LD·데이터 로드만, 화면은 뷰가 그린다(ai-about과 같은 분업).
2. **본문을 마크다운 상수에서 i18n 메시지로 옮긴다** (`views.about.*`). 기존엔 ko/en만 있고 ja/zh는 ko 폴백 + 미번역 안내였다. 메시지로 옮기면 4개 로케일 모두 제 언어로 나가고 `i18n:verify` 게이트를 탄다. `content.ts`, `UntranslatedNotice`/`LegalPageShell` 사용은 about에서 제거(terms/privacy는 그대로).
3. **리플레이 엔진 공유**. `views/ai-about/lib/{replayScript,replayPlayer}.ts`와 `hooks/useCanAnimate.ts`를 `shared/lib/replay/`로 옮긴다. views 슬라이스끼리는 import할 수 없어서다. 엔진은 원래 채팅과 무관한 "입력 타이핑 → 단계 점등 → 본문 스트리밍" 상태 기계라 그대로 맞는다.
4. **데모는 리포트 리플레이**(`ReportReplay`). 채팅이 아니라 siglens.io의 실제 흐름을 보여준다: 주소창에 `siglens.io/AAPL`이 타이핑되고 → 처리 단계(시세·차트 → 보조지표 → 패턴 → 재무·뉴스 → AI 서술)가 차례로 켜지고 → 리포트 본문이 흘러나온다. 미국 주식(AAPL)·한국 주식(삼성전자)·암호화폐(BTC) 3개가 무작위 반복. 입력창이 아니라 **주소창 모양**이라 실제 입력처럼 오해할 여지가 없다(ai-about 때 받은 피드백). 카드 위에 "예시 화면" 라벨, 아래에 "수치는 설명을 위한 예시" 주석.
   - SSR/첫 렌더는 첫 시나리오 완성본(크롤러·JS 없는 독자·하이드레이션 일치), 감속 선호 시 재생 안 함, 일시정지 버튼(WCAG 2.2.2), 화면 밖이면 정지. ChatReplay와 동일 규칙.
5. **히어로엔 검색창을 두지 않는다**(사용자 결정). 헤더에 이미 검색이 있다. 예시 종목 칩과 스킬 개수 줄도 뺐다(사용자 결정). 히어로는 행동 지시형 h1 + 리드 문단뿐이다. 종목 진입 링크는 데이터 타일이 맡는다.
6. 상단 고정 CTA 바는 두지 않는다. siglens.io 헤더에 이미 검색창이 있어 중복이다.

## 섹션 (위→아래)

| # | 섹션 | 내용 | 기존 본문 대응 |
|---|---|---|---|
| 0 | 브레드크럼 | 홈 / Siglens 소개 (`LegalBreadcrumb` 재사용) | 유지 |
| 1 | 히어로 | eyebrow "Siglens 소개", h1 행동형, lede | "무엇인가" 일부 |
| 2 | 리포트 리플레이 | 위 결정 4 | 신규 |
| 3 | 이런 점이 답답했다면 | 불편 → Siglens 5쌍 (사이트 여러 곳 / 지표가 너무 많음 / AI가 숫자를 지어냄 / 용어가 어려움 / 시장마다 다른 곳) | 신규 |
| 4 | 한 종목에서 보는 것 | 8개 타일(차트·보조지표, 캔들·차트 패턴, 재무제표, 펀더멘털, 뉴스, 옵션, 의회 거래, 공포·탐욕 지수), 각 타일에 범위 표기와 AAPL 예시 탭 링크 | "무엇인가" |
| 5 | 분석은 이렇게 만들어져요 | 3단계 도식(데이터 수집 → 규칙 계산 → AI 서술·검증) + 데이터 출처·지연·갱신 주기 | "어떻게 만들어지나", "얼마나 자주 갱신되나" |
| 6 | 누가 만드나 | 운영자 카드(개인 개발자, 이메일, GitHub, 공개 저장소, 사비 운영, 제휴·대가 없음) | "누가 만들고 운영하나" |
| 7 | 한계와 면책 | 기존 두 섹션을 한 카드로, 문구 유지 | "한계", "면책" |
| 8 | 자주 묻는 질문 | `FaqSection` + `FAQPage` JSON-LD 단일 소스 | 신규 |
| 9 | 더 둘러보기 + 끝 CTA | /market, /market/kr, /fear-greed, /backtesting, SIGLENS AI 소개(ai.siglens.io/about), 문의 | "문의" |

## 사실 정정 (코드 대조 결과)

기존 본문 중 코드와 다른 부분을 이번에 바로잡는다.

- **Polygon**: 코드 어디에서도 쓰지 않는다. 출처는 Financial Modeling Prep, Yahoo Finance, 공공데이터포털(KRX)로 고친다.
- **"시세는 최대 15분 지연"**: 미국 주식·암호화폐는 지연 0(`usEquity.ts`/`crypto.ts` `quoteDelayMinutes: 0`), 한국 주식은 20분(`krEquity.ts`). 그대로 적는다.
- **LLM 목록에 Google Gemini 누락**: core `MODEL_SPECS`에 gemini 모델이 있다. OpenAI·Anthropic·Google·DeepSeek로 고친다.
- **"매일 미국 증시 마감 후 다시 생성"**: 프리웜은 마감 뒤 회전 순번으로 돈다(모든 종목이 매일은 아님). "장 마감 뒤 차례로 다시 만든다"로 고친다.

## SEO

- `<title>`: `Siglens 소개: 미국·한국 주식, 코인 AI 분석` (+ 템플릿 없이 `| Siglens`는 `aboutFullTitle`이 붙임). description은 무엇을·누가·어떻게·무료를 한 문장씩.
- JSON-LD: 기존 `AboutPage`(mainEntity Organization) + `Person` + `BreadcrumbList` 유지, `FAQPage` 추가. `AboutPage`에 `dateModified` 부여.
- h1 1개, h2는 섹션마다, 타일은 h3. 모든 본문 서버 렌더(리플레이도 첫 시나리오 완성본 SSR).
- 내부 링크: 예시 종목(`/AAPL`, `/NVDA`, `/005930.KS`, `/BTCUSD`), 탭 링크(`/AAPL/financials` 등), 허브(/market, /fear-greed, /backtesting), 크로스 호스트(ai.siglens.io/about).
- `revalidate = 86400` 유지, `setRequestLocale` 유지(ISR). `ABOUT_UPDATED_AT` 갱신.
- 색인 대상은 기존과 같다(`localeRobots`: ko/en). ja/zh도 이제 제 언어 본문이 나가지만 색인 정책은 건드리지 않는다.

## 테스트

- 엔진 이동: 기존 테스트 파일도 함께 이동, import 경로만 수정.
- `ReportReplay`: SSR 첫 렌더 완성본, 감속 선호 시 버튼 없음.
- `AboutPage` 뷰: 섹션 h2 존재, 운영자 링크(mailto·GitHub·저장소), 면책 문구, FAQ 문답이 화면에 있음.
- 라우트: 메타데이터(title/description/canonical/robots), JSON-LD 4종, FAQ 단일 소스(`expectFaqSingleSource` 가드 규약).
- e2e: 기존 about 스펙이 있으면 셀렉터 갱신.

## 범위 밖

- 홈 페이지 변경 없음. terms/privacy 변경 없음.
- 실제 분석 스냅샷을 about에 임베드하지 않는다(DB 결합·장애 경로 증가 대비 이득 작음).
