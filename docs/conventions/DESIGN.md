# Design System

## 컬러 철학

주식 분석 플랫폼으로서 두 가지 감정을 전달한다.
- **신뢰** — 사용자가 데이터를 믿고 의사결정할 수 있다는 확신
- **편안함** — 복잡한 분석을 쉽게 소화할 수 있다는 안도감

다크 기본. 차트 가독성과 장시간 사용 피로도를 고려한다. **라이트 테마도 1급으로 지원한다**
(2026-08 리디자인) — 두 테마 모두 같은 토큰 이름을 쓰고 값만 갈아끼운다.

### 대비 기준 — AAA 지향

WCAG **AA(4.5:1)는 하한선이고 목표는 AAA(7:1)**다. 본문·헤딩·보조 텍스트는 페이지와 카드
양쪽 배경에서 7:1을 넘긴다. 가장 흐린 단계(`secondary-500`)만 6.5:1 부근으로 AAA에 못
미치는데, 더 밝히면 `secondary-400`과 구분이 사라져 위계가 무너지기 때문에 의도적으로 멈춘
지점이다. 새 색을 추가할 때는 **두 테마 × 페이지/카드 두 배경** 네 조합을 모두 재어본다.

### 토큰 2계층

| 계층 | 이름 | 용도 |
|---|---|---|
| 1 | `primary-*` / `secondary-*` | 호환 레이어. 기존 2,400여 참조가 여기 걸려 있다. **이름 고정, 값만 재지정** |
| 2 | `surface` / `fg` / `accent` / `border-*` | **신규·재작성 코드는 이것만 쓴다.** 역할 기반이라 테마 전환에 자동 대응 |

계층 1의 스텝 번호는 "얼마나 어두운가"를 뜻하고 계층 2의 이름은 "무슨 역할인가"를 뜻한다.
라이트에서 스텝 번호의 의미는 뒤집히지만(카드 800이 페이지 900보다 밝다) 역할은 그대로다.
램프가 단조롭지 않은 것은 결함이 아니라 의도된 배치다 — 그라데이션이 아니라 이름 붙은
역할이기 때문이다.

---

## Primary Color — Trust Blue

신뢰, 안정, 전문성을 표현한다.
주요 액션(버튼, 링크, 활성 상태, 포커스 링)에 사용한다.

```
다크 (기본)                       라이트 ([data-theme='light'])
--color-primary-400: #60a5fa      #1e40af   ← 링크 / 활성 텍스트 (양 테마 AAA)
--color-primary-500: #3b82f6      #1d4ed8   ← 포커스 링
--color-primary-600: #2563eb      #1d4ed8   ← 채움 버튼 배경 (흰 글자)
--color-primary-300: #93c5fd      #1e3a8a
--color-primary-900: #1e3a8a      #dbeafe
--color-primary-950: #172554      #eff6ff
(50/100/200/700/800은 다크 값 공유)

액센트는 희소 자원이다. 한 뷰포트에 **주 액션과 현재 위치 표시 2곳까지만** 쓴다.
링크·포커스·활성 탭 외의 장식적 사용은 금지.
```

**사용처**
```
버튼 (primary)         bg-primary-600 hover:bg-primary-700  (신규: bg-accent-fill)
활성 탭/메뉴           text-primary-400 border-primary-400  (신규: text-accent)
포커스 링              ring-primary-500                     (신규: ring-accent-ring)
링크                   text-primary-400 hover:text-primary-300
인디케이터 라인 (MA120/EMA120)  #3b82f6

⚠ hover는 대비가 **올라가야** 한다. `bg-primary-600 → hover:bg-primary-500`은
   흰 글자 대비를 5.17:1에서 3.68:1로 떨어뜨리므로 `hover:bg-primary-700`을 쓴다.
```

---

## Secondary Color — Slate

편안함, 중립, 배경감을 표현한다.
배경, 카드, 보조 텍스트, 구분선에 사용한다.

```
다크 (기본)                         라이트 ([data-theme='light'])
--color-secondary-50:  #f4f4f6      #16181d   ← 최고 대비 텍스트
--color-secondary-100: #ecedf0      #1f222a   ← 헤딩
--color-secondary-200: #dcdde2      #2b303a
--color-secondary-300: #c6c7ce      #3e434d   ← 본문
--color-secondary-400: #abacb6      #4d525b   ← 보조 텍스트 (AAA)
--color-secondary-500: #96979f      #565c66   ← 가장 흐린 텍스트
--color-secondary-600: #3a3a45      #cfd3da   ← 강조 보더
--color-secondary-700: #2a2a33      #e6e8ec   ← 보더 / 호버 틴트
--color-secondary-800: #101014      #ffffff   ← 카드/패널 배경
--color-secondary-900: #09090b      #f7f8fa   ← 페이지 배경
--color-secondary-950: #050507      #eff0f3   ← 인셋 (입력·차트 우물)

--color-border-control: #6a6a78     #878e9a   ← 컨트롤 경계 전용 (WCAG 1.4.11, 3:1)

라이트에서 800(카드)이 900(페이지)보다 밝고, 텍스트 램프의 명암 방향이 뒤집힌다.
프로미넌스 서열(400이 500보다 눈에 띈다)은 두 테마에서 동일하게 유지된다.
```

**사용처**
```
페이지 배경            bg-secondary-900   (신규 코드: bg-surface-page)
카드/패널 배경         bg-secondary-800   (신규 코드: bg-surface)
차트 배경              CHART_COLORS.background
보조 텍스트            text-secondary-400 (신규 코드: text-fg-muted)
구분선                 border-secondary-700 (신규 코드: border-border-subtle)
입력·컨트롤 경계       border-border-control
```

---

## Semantic Color — 차트 전용

차트에서 상승/하락/중립을 표현한다.
주식 서비스의 관습적 색상을 따른다.

```
상승 (Bullish)   #26a69a   (틸 그린)
하락 (Bearish)   #ef5350   (레드)
중립 (Neutral)   #94a3b8   (슬레이트)
```

**사용처**
```
상승 캔들          #26a69a
하락 캔들          #ef5350
거래량 상승        #26a69a80  (50% 투명도)
거래량 하락        #ef535080  (50% 투명도)
AI 분석 bullish    text-ui-success-text
AI 분석 bearish    text-ui-danger-text
AI 분석 neutral    text-secondary-300
```

---

## 인디케이터 라인 컬러

인디케이터별로 구분 가능한 고대비 색상을 사용한다.

### MA / EMA (기간별 컬러)

MA는 실선(solid), EMA는 점선(dashed)으로 렌더링한다.
짧은 기간 → 긴 기간 순으로 레드 → 퍼플 스펙트럼을 따른다.

```
기간   MA 색상 (실선)   EMA 색상 (점선)
5      #ef4444           #ef4444
10     #f97316           #f97316
20     #eab308           #eab308
60     #22c55e           #22c55e
120    #3b82f6           #3b82f6
200    #a855f7           #a855f7
```

Lightweight Charts lineStyle 값:
```
MA  → lineStyle: 0  (실선, LineStyle.Solid)
EMA → lineStyle: 1  (점선, LineStyle.Dotted)
```

### 볼린저 밴드

```
볼린저 상단       #818cf8   (인디고)
볼린저 중단       #94a3b8   (슬레이트)
볼린저 하단       #818cf8   (인디고)
볼린저 배경       #818cf820 (인디고 12% 투명도)
```

### MACD

```
MACD 라인        #3b82f6   (블루)
MACD 시그널      #f59e0b   (앰버)
MACD 히스토그램  상승 #26a69a / 하락 #ef5350
```

### RSI

```
RSI 라인         #a78bfa   (바이올렛)
RSI 과매수선(70) #ef535060 (레드 40% 투명도)
RSI 과매도선(30) #26a69a60 (틸 40% 투명도)
```

### DMI

```
DMI +DI          #26a69a   (틸)
DMI -DI          #ef5350   (레드)
DMI ADX          #f59e0b   (앰버)
```

### Stochastic

```
Stochastic %K    #f472b6   (핑크)
Stochastic %D    #38bdf8   (스카이블루)
과매수선(80)     #ef535060 (레드 40% 투명도)
과매도선(20)     #26a69a60 (틸 40% 투명도)
```

### CCI

```
CCI 라인         #fb923c   (오렌지)
CCI 과매수선(+100) #ef535060 (레드 40% 투명도)
CCI 과매도선(-100) #26a69a60 (틸 40% 투명도)
CCI 중앙선(0)    #94a3b860 (슬레이트 40% 투명도)
```

### VWAP

```
VWAP             #e879f9   (퍼플)
```

### 추세선

```
상승 추세선 (Ascending)  #26a69a   (틸 그린)
하락 추세선 (Descending) #ef5350   (레드)
```

### Support / Resistance Lines (지지/저항선)

```
지지선 (Support)     #26a69a   (틸 그린)
저항선 (Resistance)  #ef5350   (레드)
```

### Ichimoku Cloud

```
전환선 (Tenkan)          #2962ff   (블루)
기준선 (Kijun)           #e91e63   (핑크)
선행스팬A (Senkou A)     #26a69a   (틸 그린)
선행스팬B (Senkou B)     #ef5350   (레드)
후행스팬 (Chikou)        #9c27b0   (퍼플)
구름 강세 (Cloud Bullish) #26a69a20 (틸 그린 12% 투명도)
구름 약세 (Cloud Bearish) #ef535020 (레드 12% 투명도)
```

---

## UI Color — 상태 표시

UI 상태를 표현한다. 차트 컬러와 구분되는 UI 전용 토큰이다.

```
--color-ui-success: #26a69a   (틸 그린)
--color-ui-warning: #f59e0b   (앰버)
--color-ui-danger:  #ef5350   (레드)
```

**사용처**
```
valid strength rule    text-ui-success
medium risk 표시      text-ui-warning
moderate strength     text-ui-warning
투자 면책 고지 박스   border-ui-danger/30  bg-ui-danger/5  text-ui-danger
```

참고: `#26a69a`는 `chart.bullish`(상승 캔들)와 동일한 값이지만, UI 성공/충족 상태 표시 목적으로 별도 토큰(`ui-success`)을 분리한다. 차트 상승 렌더링에는 `chart-bullish`를 사용하고, UI 성공 표시에는 `ui-success`를 사용한다.

참고: `#f59e0b`는 `chart.signal`(MACD 시그널 라인)과 동일한 값이지만, UI 상태 표시 목적으로 별도 토큰(`ui-warning`)을 분리한다. 차트 시그널 렌더링에는 `chart-signal`을 사용하고, UI 심각도 표시에는 `ui-warning`을 사용한다.

`#ef5350`은 `chart.bearish`(하락 캔들)와 동일한 값이지만, UI 위험/경고 알림 목적으로 별도 토큰(`ui-danger`)을 분리한다. 차트 하락 렌더링에는 `chart-bearish`를 사용하고, UI 위험 표시에는 `ui-danger`를 사용한다.

---

## AA Text-Variant Tokens — 소형 텍스트용 WCAG AA 색상

칩/배지 배경(`/10`–`/20` 투명 색조) 위에 렌더링되는 **소형 텍스트**(text-xs/text-sm)는 기본
`ui-*` / `chart-*` 토큰(≈3:1, 대형 텍스트 기준 통과)으로는 WCAG AA(≥4.5:1)를 충족하지 못한다.
이 토큰군은 해당 맥락 전용 밝은 변형이다.

```
다크 (기본)                        라이트 ([data-theme='light'])
--color-ui-success-text: #5eead4   #0a5b52
--color-ui-danger-text:  #fca5a5   #a02420
--color-ui-warning-text: #fcd34d   #7a4f00

다크 값은 **밝은** 변형, 라이트 값은 **어두운** 변형이다. 방향이 반대이므로
다크 값을 라이트에 그대로 쓰면 흰 배경에서 1.4~1.9:1로 전멸한다.
```

**사용 규칙**

| 상황 | 사용 토큰 |
|---|---|
| 칩/배지 소형 텍스트 (`bg-ui-success/10` 등 위) | `text-ui-success-text` / `text-ui-danger-text` / `text-ui-warning-text` |
| AI 분석 감성 텍스트 (bullish/bearish/neutral) | `text-ui-success-text` / `text-ui-danger-text` / `text-secondary-300` |
| 그래픽, 캔들, 차트 채움 | `fill-chart-bullish` / `stroke-chart-bearish` (3:1, 비텍스트) |
| UI 상태 표시 (아이콘, 테두리, 배경) | `ui-success` / `ui-danger` / `ui-warning` (3:1, 비텍스트 OK) |

> `ui-success-text` / `ui-danger-text` / `ui-warning-text`는 순수 텍스트 전용이다.
> 배경 채움이나 차트 렌더링에는 사용하지 않는다.

---

## Brand Color — 소셜 로그인

외부 브랜드가 명시한 색상을 UI 상태 토큰과 분리해 관리한다.

```
--color-brand-kakao: #fee500   (Kakao Yellow)
```

**사용처**
```
카카오 소셜 로그인 버튼    bg-brand-kakao
```

---

## Tailwind CSS 버전

이 프로젝트는 **Tailwind CSS v4**를 사용한다.

v4는 v3와 달리 `flex-3`, `grid-cols-7` 등 숫자 기반 유틸리티 클래스를 추가 설정 없이 지원한다.
리뷰 시 v3 기준으로 "표준이 아니다"고 판단하지 않도록 주의한다.

```
✅ v4에서 유효한 클래스 예시
flex-3        → flex: 3
flex-[3]      → 동일 (임의값 문법도 허용되지만 불필요)
```

---

## Tailwind 설정 (v4 `@theme`)

Tailwind v4를 사용하므로 별도의 `tailwind.config.ts`(JS 설정) 파일은 **없다**. 모든 커스텀 토큰은
`src/app/globals.css`의 `@theme { }` 블록에 CSS 커스텀 프로퍼티로 등록한다.

```css
/* src/app/globals.css */
@theme {
    --color-primary-500: #3b82f6;
    --color-secondary-900: #09090b;
    --color-chart-bullish: #26a69a;
    --color-chart-bearish: #ef5350;
    /* MA/EMA, 볼린저, MACD, RSI, DMI, Stochastic, Stochastic RSI, CCI, Ichimoku,
       VWAP, trendline, support/resistance, UI(success/warning/danger) ... */
    --color-brand-kakao: #fee500;
}
```

- `--color-<name>`을 등록하면 `bg-<name>` / `text-<name>` 등 유틸리티가 자동 생성된다.
- 차트·지표 색상 값의 **정본은 `src/shared/lib/chartColors.ts`**이며, `globals.css`의 `@theme`에 동일 값으로
  미러링한다. 토큰을 추가/변경할 때 두 곳(`@theme` + `chartColors.ts`)을 함께 갱신한다.
- **전체 토큰 목록은 `src/app/globals.css`를 source of truth로 본다** — drift 방지를 위해 이 문서에 전부
  나열하지 않는다.

---

## 사용 규칙

```
✅ 컬러 토큰 사용
<div className="bg-secondary-900 text-primary-400">

✅ 차트 컬러는 상수로 관리
import { CHART_COLORS } from '@/shared/lib/chartColors';

❌ 하드코딩 금지
<div style={{ backgroundColor: '#0f172a' }}>

❌ 임의 hex 값 금지 (토큰에 없는 색상)
className="text-[#1a2b3c]"
```

---

## 자주 하는 실수

```
1. 차트 컬러를 Tailwind 클래스로 사용
   → Lightweight Charts는 CSS 클래스 미지원
   → 반드시 hex 값 직접 전달 (CHART_COLORS 상수 사용)

2. 상승/하락 색상을 green/red로 사용
   → Siglens는 teal(#26a69a) / red(#ef5350) 고정
   → 임의로 변경 금지 (라이트 테마는 같은 색상을 진하게 조정한 짝을 쓴다)

3. 라이트 테마를 잊고 다크 값만 확인
   → 두 테마 모두 1급 지원 대상 (2026-08~)
   → `[data-theme='light']` 블록에 짝을 정의하지 않으면 라이트에서 대비가 무너진다
   → 특히 `ui-*-text` 3종은 다크 전용으로 튜닝돼 흰 배경에서 1.4~1.9:1로 전멸한다

4. 신규 코드에서 계층 1 램프를 직접 참조
   → `bg-secondary-800` 대신 `bg-surface`
   → 계층 1은 기존 코드 호환용이며, 새로 쓰는 곳은 시맨틱 이름을 쓴다
```

## Dashboard Panel C — Signal Quadrants

Five subsections per sector: `상승 신호 / 상승 조짐 / 혼재 / 하락 조짐 / 하락 신호`.

The center **혼재** section appears when a stock has equal bullish and bearish signal counts. It uses `border-t-2 border-secondary-500` and a `◈` unicode marker to remain visually distinct from directional sections without introducing emoji rendering inconsistencies.

### Visual System — "Terminal Editorial"

Distinction uses three orthogonal cues (not emotional color):
- **Marker shape**: filled ▲▼ for confirmed signals, outlined △▽ for anticipation, ◈ for mixed
- **Top rule**: `border-t-2 border-secondary-600` solid (confirmed), `border-t-2 border-secondary-500` (mixed), `border-t border-dashed border-secondary-700` (anticipation)
- **Label typography**: `font-semibold tracking-[0.15em]` (confirmed / mixed), `font-medium tracking-[0.15em] opacity-70` (anticipation)

`text-chart-*`는 **쓰지 않는다.** 이 계열은 그래픽용(3:1)이라 라이트 인셋 표면에서 4.23~4.30:1로 본문 기준(4.5)을 밑돈다 — 틴트 위만이 아니라 민 배경에서도 그렇다. 텍스트에는 `text-ui-success-text` / `text-ui-danger-text`, 그래픽에는 `fill-`/`stroke-chart-*`를 쓴다.

**SVG `<text>`/`<tspan>`의 `fill`도 글자색이다.** `fill-`이 붙었다고 그래픽이 되는 게 아니라, 무엇을 칠하느냐가 기준을 정한다. 차트 안 범례를 막대와 같은 색으로 맞추고 싶어지지만 그건 글자이므로 `-text` 짝을 쓴다 — 옵션 차트 두 곳이 HTML 범례만 옮기고 SVG 범례를 `var(--color-chart-bullish)`로 남겨둔 적이 있다. 막대(`<rect>`)와 색칩은 그대로 `chart-*`다. `semanticTextTokenGuard`가 클래스와 `var()` 두 철자 모두 강제한다. Subsection headers are neutral (`text-secondary-200`).

### Cards

`SignalStockCard` extends `IndexCard` language: mono ticker, tabular-nums price, signal badges as tracked uppercase labels with `·` bullet separator. Hover uses `-translate-y-px` + background/border shift, not `opacity-80`.

**Title hierarchy is market-dependent** (`DashboardScope.tickerIsReadable`). US tickers are names a reader recognises (`XLK`, `AAPL`), so they take the primary line in mono and the Korean name sits below in muted grey. KRX tickers are 6-digit codes (`091160.KS`, `005930.KS`) that mean nothing to anyone, so on `tickerIsReadable: false` markets the two swap: the proportional Korean name (`반도체`, `삼성전자`) becomes the primary line and the mono ticker drops to the muted line. Both values stay in the DOM either way — only visual priority moves, and `translate="no"` follows the ticker. Ship a new quote card with the ticker hardcoded as the title and `/market/kr` goes back to a page whose headings are all numbers.

### Background

`.sector-panel-bg` utility applies a subtle 32px grid with radial mask — terminal atmosphere at opacity 0.35.

### Accessibility

- Sector tabs: WAI-ARIA tablist, Left/Right/Home/End key nav
- Strict mode toggle: radiogroup, Left/Right key toggle
- All ▲▼ markers `aria-hidden` with `sr-only` direction text
- `prefers-reduced-motion`: global utility in `globals.css` disables all transitions/animations
