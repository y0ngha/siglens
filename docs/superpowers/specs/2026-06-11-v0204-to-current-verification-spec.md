# 릴리스 실증 검증 Spec — v0.20.4 → 현재(보조지표 렌더링 스택 머지본)

- **작성일**: 2026-06-11
- **유형**: 릴리스(버전범위) 실증 검증 ([docs/qa/RELEASE_VERIFICATION.md](../../qa/RELEASE_VERIFICATION.md) 플레이북)
- **범위**: 직전 배포 **v0.20.4** → 현재 master + 보조지표 렌더링 9-PR 스택 머지본(= 다음 배포 후보)
- **검증 산출물(Test Sheet)**: [docs/qa/sheets/2026-06-11-v0204-indicator-render-release-verification.md](../../qa/sheets/2026-06-11-v0204-indicator-render-release-verification.md)

## 0. 실행 플랜 (확정)

1. **(이 문서) Spec + Test Sheet 작성** — Opus 4.8로 케이스 먼저 생성. ← 현재 단계
2. **스택 rebase + 머지**: #575←#577←#580←#581←#582←#584←#585←#587←#588 체인을 현재 master(core 0.21.1) 위로 rebase(충돌 1회 해결, core 0.21.1·아키텍처 변경 흡수) → 각 PR base 정렬 후 순서대로 `--merge`.
3. **core**: 추가 bump 없음 — master가 이미 `@y0ngha/siglens-core@0.21.1`. 머지된 9-PR(0.20.0 base)은 master의 0.21.1을 상속. rebase 후 0.21.1에서 깨지는 테스트가 있으면 수정.
4. **실증**: prod-like 빌드 + 개발/prod 서버 기동 → **curl(C#) + Chrome(B#) 이중 검증**(동작·SEO).
5. **Opus 4.8 감사**: 머지 후 5-context 안정성 감사([docs/qa/STABILITY_AUDIT.md](../../qa/STABILITY_AUDIT.md)).

## 1. 변경 범위 (change surface)

직전 배포(v0.20.4) 대비 신규 = **미사용 보조지표 렌더링 9-PR 스택**. 외부세계/데이터 변경 없음, 순수 차트 렌더링. core는 master에서 이미 0.21.1(배포됨).

### 1.1 신규/변경 기능
- **보조지표 설정 모달** — 차트 우상단 톱니바퀴(`보조지표 설정`) → 카테고리 그룹(추세/모멘텀/변동성/볼륨/통계/**SMC**) 체크박스 + MA/EMA period 칩. createPortal(z-60). SMC 그룹은 이번에 처음 노출.
- **레지스트리** 11→34 지표. 4개 kind:
  - `overlay`(Pane 0): MA·EMA·Ichimoku·Bollinger·VP·Keltner·Donchian·Supertrend·Parabolic SAR·Chandelier
  - `pane`(별 pane): RSI·MACD·DMI·Stoch·StochRSI·CCI·MFI·Williams%R·CRSI·CMF·%B·Hurst·VR·MACD-V·ForceIndex·OBV·ATR·YangZhang·EWMA Vol·**ElderRay**·**Squeeze**·**Regression**
  - `candle-paint`: **Elder Impulse**(메인 캔들 per-bar 재색칠)
  - `zone`: **SMC Zones**(premium/discount/equilibrium 가격선)
- **신규 렌더 메커니즘**: trend 색 2-시리즈(supertrend/sar/chandelier), 히스토그램 per-bar colorFn(MACD/elderRay/squeeze/regression), 0라인 상태 점(squeeze), r2 투명도(regression), 캔들 색칠(elderImpulse), priceLine 밴드(smc).
- **유틸/색**: seriesDataUtils(buildTrendSplitData/buildZeroLineDots/row-aware colorFn), histogramColorUtils, candlestickDataUtils, smcZoneUtils, overlayLabelUtils, paneLabelUtils, chartColors.ts + globals.css @theme 토큰 다수.

### 1.2 영향 라우트
- **주 변경면**: `/[symbol]`(심볼 차트 페이지 — 모달·전 지표 렌더가 여기). 예: `/AAPL`.
- **회귀 확인(핵심 기능, 변경 없음이어야)**: `/[symbol]/{fundamental,news,options,overall,fear-greed}`, `/market`, `/backtesting`, `/login`·`/signup`·`/forgot-password`·`/reset-password`, `/privacy`·`/terms`, `/account`. 인프라: `/robots.txt`·`/manifest.webmanifest`·`/api/sitemap*`·opengraph-image 라우트.

## 2. 검증 관점

prod 빌드 런타임 관점 — E2E/단위가 못 잡는 것:
- **동작**: prod 빌드에서 차트/모달/지표 토글이 실제로 렌더·동작하는가. 콘솔 에러 없는가. 캔버스 기반이라 **Chrome(B#) 필수**.
- **SEO**: 각 라우트의 메타(title/description), canonical, OG/twitter, 구조화데이터(JSON-LD), H1, robots/sitemap/manifest. → curl(HTML 파싱) + `seo-audit` 스킬.
- **상태/Status**: status code, Content-Type, 캐시 헤더(ISR), 정적 prerender 산물.

## 3. 검증 방법 (이중)

### 3.1 curl (C#)
- 각 라우트 status code + `Content-Type`.
- HTML 내 `<title>`·`<meta name=description>`·`<link rel=canonical>`·`og:`/`twitter:`·JSON-LD(`application/ld+json`)·`<h1>` 존재/정확.
- `/robots.txt`·`/manifest.webmanifest`·`/api/sitemap*` 유효 응답.
- ISR 캐시 헤더(가능 시).

### 3.2 Chrome (B#)
- `/AAPL` 로드 → 차트 캔버스 렌더, 콘솔 에러 0.
- 모달: 톱니바퀴 클릭 → 카테고리 그룹(SMC 포함) 노출 → kind별 대표 지표 토글 후 렌더 변화 육안 확인:
  - overlay(예: Bollinger) 라인, pane(예: RSI) 새 pane, candle-paint(Elder Impulse) 캔들 색 변화, zone(SMC Zones) 가격선.
- period 칩(MA), 모바일 뷰포트(시트/오버플로우), a11y(키보드 토글).

## 4. 환경

[docs/qa/QA_ENV_SETUP.md](../../qa/QA_ENV_SETUP.md) — prod DB 미접촉. 차트는 bars/indicators fetch가 필요하므로 docker(Postgres+Redis) 또는 HYBRID 백엔드로 기동. prod-like 빌드(`yarn build` → `yarn start`) 우선, 필요 시 `yarn dev`.

## 5. 성공 기준

- 모든 C#/B# 케이스 PASS(실측 근거 기록, 추측 금지).
- 콘솔 에러 0, 4xx/5xx 없음(의도된 인증 가드 제외).
- SEO 메타/canonical/OG/JSON-LD/H1 핵심 라우트에서 정상.
- 머지 후 `yarn build`·`test-coverage`·`lint`·`prettier` 그린.

## 6. 후속

- 발견 이슈 → 수정 PR([docs/qa/PR_REVIEW_LOOP.md](../../qa/PR_REVIEW_LOOP.md)).
- 검증 완료 후 Opus 4.8 5-context 안정성 감사.
