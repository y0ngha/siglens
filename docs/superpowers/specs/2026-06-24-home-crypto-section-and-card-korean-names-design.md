# 홈 화면 — 암호화폐 인기 종목 섹션 + 카드 한글명 + 정렬/Placeholder 폴리시

- 날짜: 2026-06-24
- 범위: siglens 로컬(UI/표시용 config). siglens-core 분석 로직 무관 — Cross-repo scope guard 트리거 없음.
- 관련 위젯: `widgets/home`, `features/ticker-search`, `app/page.tsx`, `shared/config`, `shared/lib/types`

## 배경 / 목표

홈 화면의 3가지 개선을 한 변경 세트로 처리한다.

1. **종목 검색 input placeholder** 를 주식·암호화폐를 모두 포괄하도록 변경.
2. **987px(태블릿, md 구간) 정렬 깨짐** 수정 — hero 텍스트만 가운데, 검색창·하단 섹션은 좌측이라 어긋나 보임.
3. **'암호화폐 인기 종목' 섹션 신설** — 기존 납작한 칩 위젯(`CryptoShowcase`)을 '섹터별 인기 종목'(`TickerCategories`)과 동일한 카드 그리드 디자인으로 재구성.

추가로, 사용자 결정에 따라 **주식 섹터 카드와 암호화폐 카드 모두 칩 라벨을 "한글명 메인 + 티커 보조"** 로 통일한다.

## 비목표 (YAGNI)

- 새 데이터 fetch/API/서버 액션 없음. 모든 데이터는 정적 config.
- 분석 로직(지표/시그널/패턴/프롬프트) 변경 없음.
- `popular-cryptos.ts`(자동생성)·`POPULAR_TICKERS`(sitemap용 flat 배열) 변경 없음.
- 카테고리 인덱스 페이지/앵커 라우트 신설 없음.

---

## 1. 검색 Placeholder 변경

- 파일: `src/features/ticker-search/ui/TickerAutocomplete.tsx:87`
- 변경: `종목 입력… 예: AAPL, 애플` → `종목 입력 (예: AAPL, 애플, BTC, 비트코인)`
- 이 input은 홈(size=lg)·헤더(size=sm) 양쪽에서 공유되므로 한 곳 수정으로 전부 반영.
- `aria-label="종목 티커 검색"`(line 72)은 유지.

---

## 2. 987px 정렬 통일 (hero 좌측정렬 트리거 `lg:` → `md:`)

### 원인
hero의 좌측정렬 전환이 `lg:`(1024px)에 묶여 있어 768–1023px 구간에서 제목·부제·최근검색칩·StatsBar가 가운데 정렬된다. 반면 검색 input은 `w-full`이라 항상 좌측처럼 보이고, 하단 섹션(`HowItWorks`, `TickerCategories` 등)은 기본 좌측 정렬이라 시각적으로 어긋난다.

### 변경 (모두 `lg:` → `md:`)
- `src/app/page.tsx:265` — `text-center lg:text-left` → `text-center md:text-left`
- `src/app/page.tsx:292` — `... justify-center lg:justify-start` → `... justify-center md:justify-start`
- `src/app/page.tsx:296` — quick links `lg:justify-start` → `md:justify-start`
- `src/widgets/home/StatsBar.tsx:21` 및 `:46` — `lg:justify-start` → `md:justify-start`
- `src/features/ticker-search/ui/SymbolSearchPanel.tsx:22` — `lg:justify-start` → `md:justify-start`

> 주의: hero 2-column 그리드 전환(`page.tsx:254 lg:grid-cols-[...]`)은 **변경하지 않는다**(그대로 lg). md 구간은 단일 컬럼 유지하되 콘텐츠만 좌측정렬한다.

### 검증 (구현/QA)
- 768px·900px·987px·1023px에서 hero(제목·부제·검색창·칩·StatsBar)와 하단 섹션이 모두 좌측 정렬로 일관되는지 실측.
- 단일 컬럼에서 차트 일러스트 카드가 좌측정렬 텍스트와 균형이 깨지지 않는지 확인. 깨지면 일러스트 컬럼 정렬을 동일 트리거로 맞춘다(구현 시 판단).
- 모바일(<768px)은 기존 가운데 정렬 유지(회귀 없음).

---

## 3. 공유 카드 컴포넌트 + 한글명 칩

### 3.1 공유 프레젠테이션 컴포넌트 추출

주식·크립토 카드가 동일한 `{label, items: [{symbol, name}]}` 구조이므로, 시각 통일을 코드로 보장하기 위해 프레젠테이션 컴포넌트를 추출한다.

- 신규: `src/widgets/home/ui/CategoryCardGrid.tsx`
- 책임: 섹션 헤딩 + 카드 그리드 렌더링(순수 프레젠테이션, 데이터/스타일 주입형).
- props 인터페이스(개념):
  ```ts
  type CategoryCardItem = { symbol: string; name: string };
  type CategoryCard = {
      id: string;
      label: string;
      borderColor: string; // tailwind class, 예: 'border-l-primary-400'
      textColor: string;   // tailwind class, 예: 'text-primary-400'
      items: readonly CategoryCardItem[];
  };
  type CategoryCardGridProps = {
      heading: string;       // ' 섹터별 인기 종목' / '암호화폐 인기 종목'
      ariaLabel: string;     // nav aria-label
      cards: readonly CategoryCard[];
  };
  ```
- 렌더 규칙(기존 `TickerCategories` 마크업을 그대로 이관):
  - `<nav aria-label={ariaLabel} className="px-6 py-10 lg:pr-[10vw] lg:pl-[15vw]">`
  - `<h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">{heading}</h2>`
  - `<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">`
  - 카드: `border-secondary-700 bg-secondary-800/50 scroll-mt-20 rounded-lg border p-5 border-l-2 {borderColor}`, `id={card.id}`
  - 카드 헤딩: `mb-3 text-xs font-semibold tracking-wider uppercase {textColor}`
  - 칩: 기존 칩 클래스 유지(`rounded-full border px-3 py-1 text-xs ...`), 각 칩은 `<Link href={`/${item.symbol}`}>`.

### 3.2 칩 라벨: 한글명 메인 + 티커 보조

- 칩 내부 표시: 한글명(`item.name`)을 메인 텍스트로, 티커(`item.symbol`)를 보조로.
  - 마크업(개념):
    ```tsx
    <Link href={`/${item.symbol}`} title={`${item.symbol} 분석`} aria-label={`${item.name} (${item.symbol}) 분석`} className="...">
        <span>{item.name}</span>
        <span className="text-secondary-500 ml-1.5 text-[10px]">{item.symbol}</span>
    </Link>
    ```
  - `title`/`aria-label`에 티커를 유지해 검색성·접근성 보존.
- 모든 item에 `name`을 명시 큐레이션하므로 런타임 폴백 분기는 두지 않는다.

### 3.3 타입 변경 (`src/shared/lib/types.ts`)

- `TickerCategory.tickers: readonly string[]` (line 90) → `items: readonly { symbol: string; name: string }[]`
- 신규:
  ```ts
  export type CryptoCategoryId = 'major' | 'altcoin';
  export interface CryptoCategory {
      id: CryptoCategoryId;
      label: string;
      items: readonly { symbol: string; name: string }[];
  }
  ```
- `CategoryId`(주식 카테고리 union)는 변경 없음.

### 3.4 주식 카테고리 데이터 (`src/shared/config/popular-tickers.ts`)

`TICKER_CATEGORIES`의 각 카테고리 `tickers: string[]` → `items: { symbol, name }[]`로 변경. 한글명은 아래 큐레이션을 source-of-truth로 한다. (이 파일의 `TICKER_CATEGORIES` 블록은 `update-popular-tickers.ts`가 건드리지 않으므로 수기 편집 안전 — 스크립트는 `POPULAR_TICKERS` flat 배열만 갱신.)

| id | label | items (symbol → name) |
|---|---|---|
| megacap | 메가캡·지수 | AAPL 애플 · MSFT 마이크로소프트 · NVDA 엔비디아 · GOOGL 알파벳(구글) · AMZN 아마존 · META 메타 · TSLA 테슬라 · SPY S&P500 ETF · QQQ 나스닥100 ETF |
| ai-semiconductor | AI·반도체 | AMD AMD · AVGO 브로드컴 · ARM 암(ARM) · SMCI 슈퍼마이크로 · ALAB 아스테라랩스 · SOUN 사운드하운드 |
| software-cloud | 소프트웨어·클라우드 | PLTR 팔란티어 · CRWD 크라우드스트라이크 · SNOW 스노우플레이크 · NOW 서비스나우 · CRM 세일즈포스 · DDOG 데이터독 · NET 클라우드플레어 |
| fintech-crypto | 핀테크·크립토 | COIN 코인베이스 · MSTR 스트래티지 · HOOD 로빈후드 · XYZ 블록 · PYPL 페이팔 · SOFI 소파이 · AFRM 어펌 |
| leveraged-etf | 레버리지 ETF | TQQQ 나스닥 3배 롱 · SQQQ 나스닥 3배 숏 · SOXL 반도체 3배 롱 · TSLL 테슬라 2배 롱 · NVDL 엔비디아 2배 롱 |
| healthcare-bio | 헬스케어·바이오 | LLY 일라이릴리 · NVO 노보노디스크 · UNH 유나이티드헬스 · ISRG 인튜이티브서지컬 · AMGN 암젠 |
| quantum-computing | 양자컴퓨팅 | IONQ 아이온큐 · LAES 세알시큐리티 · RGTI 리게티 · QBTS 디웨이브 · QUBT 퀀텀컴퓨팅 · IBM IBM |
| space | 우주·항공우주 | SPCX 스페이스X 관련 ETF · RKLB 로켓랩 · ASTS AST스페이스모바일 · LUNR 인튜이티브머신스 · RDW 레드와이어 · PL 플래닛랩스 · SPCE 버진갤럭틱 |
| ev-mobility | EV·모빌리티 | TSLA 테슬라 · RIVN 리비안 · NIO 니오 · LCID 루시드 · XPEV 샤오펑 · UBER 우버 · LYFT 리프트 |
| energy-industrial | 에너지·산업재 | XOM 엑슨모빌 · CVX 셰브론 · OXY 옥시덴탈 · COP 코노코필립스 · CAT 캐터필러 · GE GE에어로스페이스 · BA 보잉 |

> **구현 시 실측 확인이 필요한 한글명**(불확실 → FMP `/profile` 또는 신뢰 가능한 소스로 검증 후 확정): `SPCX`, `LAES`(SEALSQ), `XYZ`(Block). 검증 결과가 큐레이션과 다르면 정확한 통용명으로 교체한다.

### 3.5 암호화폐 데이터 (신규 `src/shared/config/crypto-categories.ts`)

자동생성되는 `popular-cryptos.ts`와 **분리**하여 수기 큐레이션 파일을 신설한다. 심볼은 모두 검증된 `POPULAR_CRYPTOS`(15종) 내에서 선정 → 심볼 라우트 해석 리스크 없음.

```ts
import type { CryptoCategory } from '@/shared/lib/types';

export const CRYPTO_CATEGORIES: readonly CryptoCategory[] = [
    {
        id: 'major',
        label: '메이저',
        items: [
            { symbol: 'BTCUSD', name: '비트코인' },
            { symbol: 'ETHUSD', name: '이더리움' },
            { symbol: 'XRPUSD', name: '리플' },
            { symbol: 'SOLUSD', name: '솔라나' },
            { symbol: 'BNBUSD', name: '비앤비' },
        ],
    },
    {
        id: 'altcoin',
        label: '알트코인',
        items: [
            { symbol: 'DOGEUSD', name: '도지코인' },
            { symbol: 'ADAUSD', name: '카르다노' },
            { symbol: 'TRXUSD', name: '트론' },
            { symbol: 'LINKUSD', name: '체인링크' },
            { symbol: 'LTCUSD', name: '라이트코인' },
        ],
    },
];
```

### 3.6 위젯 재구성

- `src/widgets/home/TickerCategories.tsx`
  - 기존 인라인 마크업 → `CategoryCardGrid`에 위임.
  - `CATEGORY_STYLES`(borderColor/textColor 맵) 유지하되, `TICKER_CATEGORIES`를 `CategoryCardGrid`의 `cards` 형태로 매핑(각 카테고리에 style 주입).
  - heading: `'섹터별 인기 종목'`(기존 문자열 유지), ariaLabel: `'섹터별 인기 종목 탐색'`.

- `src/widgets/home/CryptoShowcase.tsx`
  - 납작한 칩 리스트 제거 → `CategoryCardGrid` 사용.
  - 크립토 스타일 맵(2그룹): `major` → `border-l-primary-400`/`text-primary-400`, `altcoin` → `border-l-chart-bullish`/`text-chart-bullish`.
  - heading: `'암호화폐 인기 종목'`, ariaLabel: `'암호화폐 인기 종목 탐색'`.
  - 기존 `CRYPTO_SHOWCASE_COUNT`/`SHOWCASE` 슬라이스 로직 제거(이제 큐레이션 카테고리 사용).
  - 섹션 위치(`page.tsx:340`, 섹터 바로 아래)는 변경 없음. `page.tsx`의 deep-import도 유지.

> 두 위젯은 동일 `CategoryCardGrid`를 쓰므로 카드/칩/그리드 클래스가 자동 동일 → 디자인 통일 보장.

---

## 영향 받는 테스트 (갱신 필요)

- `src/shared/config/__tests__/popular-tickers.test.ts` — `.tickers` 단언을 `.items`/`.items.map(i => i.symbol)`로 재작성. `space` 카테고리 순서 단언(line 54-60)도 `items` 기준으로.
- `src/widgets/home/__tests__/TickerCategories.test.tsx` — `vi.mock`의 `tickers` → `items: [{symbol, name}]`. 한글명 렌더 검증 추가.
- `src/__integration__/homePageCategoryBrowse.test.tsx` — mock shape `items`로.
- `src/__integration__/journeyNewUser.test.tsx` — mock shape `items`로.
- `src/shared/db/__tests__/update-popular-tickers.test.ts:59` — 픽스처 문자열(자동생성 대상 아님 증명용), 변경 불필요(원하면 사실성 위해 갱신 가능, load-bearing 아님).

### 신규 테스트

- `src/shared/config/__tests__/crypto-categories.test.ts` — `CRYPTO_CATEGORIES` shape, 각 그룹 최소 5개, 모든 symbol이 `POPULAR_CRYPTOS`에 포함(검증 목록 일치), symbol 중복 없음.
- `src/widgets/home/__tests__/CategoryCardGrid.test.tsx` — heading/카드/칩 렌더, `href`=`/${symbol}`, 한글명 메인 + 티커 보조 표시, aria-label에 티커 포함.
- `CryptoShowcase` 테스트가 있으면 신규 카드형으로 갱신, 없으면 추가.

---

## FSD / 레이어 준수

- `CategoryCardGrid`: `widgets/home/ui/` (widget 내부 프레젠테이션). barrel(`widgets/home/index.ts`)에서 노출 불필요(위젯 내부 소비).
- `crypto-categories.ts`: `shared/config/` — 도메인 어휘 없는 정적 상수(기존 `popular-tickers.ts`와 동일 레이어/패턴).
- import 방향: widgets → shared 정방향. 위반 없음.

## 커밋 정책

스펙 문서 및 구현 커밋은 모두 **git-agent**가 수행(메인 세션은 직접 커밋 금지, CLAUDE.md). 구현 완료 → review-agent → mistake-managing-agent → git-agent 순서.

## 수용 기준 (체크리스트)

1. placeholder가 홈·헤더 양쪽에서 `종목 입력 (예: AAPL, 애플, BTC, 비트코인)`로 표시.
2. 768–1023px에서 hero와 하단 섹션이 모두 좌측 정렬로 일관(스크린샷 실측). <768px 회귀 없음.
3. 홈에 '암호화폐 인기 종목' 섹션이 '섹터별 인기 종목' 바로 아래, 동일 카드 디자인으로 렌더.
4. 주식·크립토 카드 칩이 한글명 메인 + 티커 보조로 표시되고, 클릭 시 `/${symbol}`로 이동.
5. 크립토 2그룹 각 5종, 전부 `POPULAR_CRYPTOS` 내 심볼.
6. `yarn lint`, `yarn test`(갱신·신규 테스트 포함), `yarn build` 통과.
7. 불확실 한글명(SPCX/LAES/XYZ) 실측 검증 완료.
