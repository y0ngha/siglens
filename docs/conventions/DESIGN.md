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

### 토큰은 한 층이다

한때 `surface` / `fg` / `accent` 같은 **역할 이름의 2계층**을 얹고 "신규 코드는 이것만
쓴다"고 적어 두었다. 리디자인에서 페이지 30여 개를 다시 쓰면서 확인해 보니 그 14개
토큰의 **소비자가 하나도 없었다.** 주석이 코드가 하지 않는 보장을 약속하고 있었던
것이라 토큰을 지웠다. 지금 존재하는 것은 다음뿐이다.

| 종류 | 이름 | 성격 |
|---|---|---|
| 램프 | `primary-*` / `secondary-*` | 스텝 번호가 "얼마나 어두운가"를 뜻한다. 값은 테마별로 갈아끼운다 |
| 역할 | `border-control` · `ui-*` · `ui-*-text` · `chart-*` · `grade-*` · `brand-*` | 이름이 "무슨 용도인가"를 뜻한다. 대비 기준이 이름에 붙어 있다 |

라이트에서 램프 스텝의 명암 방향은 뒤집히지만(카드 800이 페이지 900보다 밝다)
**프로미넌스 서열은 두 테마에서 같다** — 400이 500보다 눈에 띈다. 램프가 단조롭지
않은 것은 결함이 아니라 의도된 배치다. 그라데이션이 아니라 이름 붙은 역할이기 때문이다.

> **죽은 토큰은 용량이 아니라 거짓 안내가 문제다.** 다음 사람은 이름만 보고 그게 이
> 코드베이스의 규약이라고 읽는다. 게다가 어떤 대비 가드도 그 값을 검사하지 않으므로
> (가드는 실제 사용된 유틸리티를 훑는다) 기준 미달인 값이 규약처럼 보이는 자리에 앉는다.
> `deadColourTokenGuard`가 소비자 없는 `--color-*`를 막는다. 허용목록은 비어 있다.

### 반복되는 클래스 조합은 상수로

토큰만으로는 부족한 자리가 있다. 리디자인 전에는
`rounded-xl border border-secondary-700 bg-secondary-800` 문자열이 **83곳에 그대로
복제**돼 있었고 반경 6종·표면 틴트 20종이 뒤섞여 있었다. 페이지마다 다른 템플릿을
이어붙인 인상의 가장 큰 원인이었다.

| 상수 | 파일 | 쓰는 자리 |
|---|---|---|
| `SURFACE_CARD` · `SURFACE_NESTED` | `shared/lib/surfaceStyles.ts` | 카드·패널, 그 안의 중첩 블록 |
| `PLACEHOLDER_ON_CARD` · `PLACEHOLDER_ON_INSET` | `shared/lib/surfaceStyles.ts` | 로딩 자리표시자 — **어느 표면 위인지** 보고 고른다 |
| `HEADING_SECTION` · `HEADING_SUBSECTION` · `LABEL_KO` | `shared/lib/typographyStyles.ts` | h2 · h3 · 한글 라벨 |
| `CARD_LINK_CLASSES` | `shared/lib/cardStyles.ts` | `Link`로 감싼 카드의 hover·focus |

컴포넌트가 아니라 **문자열 상수**인 이유: 83곳을 컴포넌트로 감싸면 DOM 구조가 바뀌어
E2E 로케이터와 SEO 텍스트 위치에 회귀 위험이 생긴다. 클래스만 바꾸면 구조는 그대로다.

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
버튼 (primary)         bg-primary-600 hover:bg-primary-700
활성 탭/메뉴           text-primary-400 border-primary-400
포커스 링              ring-primary-500
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

--color-border-control: #6a6a78     #7d838f   ← 컨트롤 경계 전용 (WCAG 1.4.11, 3.57 / 3.81)

라이트에서 800(카드)이 900(페이지)보다 밝고, 텍스트 램프의 명암 방향이 뒤집힌다.
프로미넌스 서열(400이 500보다 눈에 띈다)은 두 테마에서 동일하게 유지된다.
```

**사용처**
```
페이지 배경            bg-secondary-900
카드/패널 배경         bg-secondary-800   (카드 전체는 SURFACE_CARD)
차트 배경              CHART_COLORS.background
보조 텍스트            text-secondary-400
구분선                 border-secondary-700
입력·컨트롤 경계       border-border-control
비활성 컨트롤          disabled:bg-secondary-700 disabled:text-secondary-500
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
--color-ui-success-text: #5eead4   #0a574e
--color-ui-danger-text:  #fca5a5   #8c201c
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

4. 비활성 상태를 `opacity-*`로 표현
   → 글자와 밑판을 **함께** 페이지 배경 쪽으로 끌어 둘 사이 대비가 무너진다
   → 라이트에서 특히 나쁘다(실측 최저 1.51:1). `disabledOpacityGuard`가 막는다
   → 채움: `disabled:bg-secondary-700 disabled:text-secondary-500` / 고스트: 뒤엣것만

5. 표면 토큰을 경계로 사용
   → `border-secondary-800`은 카드 위에서 **1.00:1** — 경계를 선언하고 아무것도 안 그린다
   → 장식 경계는 `secondary-700`, 컨트롤 경계는 `border-control`. `surfaceAsBorderGuard`가 막는다

6. 같은 위계의 제목을 파일마다 리터럴로 복제
   → `HEADING_SECTION` / `HEADING_SUBSECTION`을 쓴다
   → 리터럴끼리 "톤을 맞춘" 일치는 토큰과의 불일치다 — 실제로 홈 h2 둘이 그렇게 어긋나 있었다
```

## 새 화면을 만들 때

2026-08 리디자인은 페이지 30여 개를 다시 쓰면서 같은 결함을 **여러 파일에서 반복해서**
만났다. 아래는 그때 값을 치르고 알게 된 것들이라, 새 화면을 붙일 때 미리 지키면 같은
값을 다시 치르지 않는다.

### 폭 규약

| 대상 | 클래스 | 값 |
|---|---|---|
| 사이트 일반(홈·마켓·뉴스·경제·푸터) | `.page-container` | 1200px 중앙, 좌우 1rem(sm 1.5rem) |
| 심볼 서브탭 본문(뉴스·펀더멘털·종합…) | `mx-auto w-full max-w-5xl px-4` | 1024px 중앙, 좌우 1rem |
| 심볼 상단 크롬(브레드크럼·탭) | 전폭 `px-4` | 뷰포트 기준 16px |

**크롬과 본문의 폭 규약이 다른 것은 의도다.** 기본 진입 탭인 차트는 자기 제목 줄을
전폭 `px-4`로 그린다(캔버스 좌단에 맞추려고). 크롬까지 1024px로 묶으면 넓은 화면에서
크롬만 안쪽으로 들여쓰여 두 줄이 어긋난다(1920px에서 448px). 그래서 **크롬은 뷰포트에,
본문은 읽기 폭에** 맞춘다. 서브탭에서 크롬이 본문보다 바깥에서 시작하는 것은 그
트레이드오프의 결과다.

셋 중 어느 값을 바꾸든 **짝이 되는 자리를 같이 본다** — 심볼 크롬은 헤더·헤더 스켈레톤·
탭 레일·탭 스켈레톤 네 곳이 같은 규약을 공유하고, 차트 제목 줄이 다섯 번째다.

### 체크리스트

1. **색은 토큰으로.** 임의 hex·`style={{color}}`·`text-[#...]` 금지. 새 토큰이 필요하면
   `globals.css`의 `@theme`(다크)과 `:root[data-theme='light']`(라이트)에 **짝으로** 넣는다.
2. **네 조합을 잰다.** 두 테마 × 페이지 배경/카드 배경. 다크만 재고 넘어가는 것이 이
   리디자인에서 가장 자주 나온 실수다 — 라이트에서만 무너지는 값이 계속 나왔다.
3. **반복되는 클래스 뭉치는 상수로.** 카드는 `SURFACE_CARD`, 섹션 제목은
   `HEADING_SECTION`. 리터럴을 복제하면 한쪽만 고쳐지고, 그 시점부터 두 화면이 조용히
   갈린다.
4. **텍스트와 그래픽의 기준이 다르다.** 텍스트 4.5:1(`ui-*-text`), 그래픽·경계 3:1
   (`chart-*` · `ui-*` · `border-control`). SVG `<text>`의 `fill`도 **글자색**이다 —
   `fill-`이 붙었다고 그래픽이 되는 게 아니라 무엇을 칠하느냐가 기준을 정한다.
5. **비활성·포커스·경계는 명시 토큰으로.** `opacity-*`로 비활성을 만들지 않고,
   포커스는 `focus-visible:ring-2 ring-primary-500`을 붙이고, 컨트롤 경계는
   `border-control`을 쓴다.
6. **테스트를 같이 쓴다.** 새 순수 함수에는 colocated 유닛 테스트, 새 화면에는 렌더
   테스트. 훅을 테스트했다고 **배선을 테스트한 것이 아니다** — 호출부에서 그 효과가
   나타나는지 한 줄이라도 단언한다(이 루프에서 여덟 번 반복된 결함이다).

### 정적 가드 — 이미 깔려 있는 레일

`src/__tests__/guards/`가 아래를 강제한다. 새 화면이 이 중 하나를 어기면 CI에서 걸린다.
**가드가 걸리면 가드를 고치지 말고 코드를 고친다** — 예외가 필요하면 허용목록에 넣되
"왜 대상이 아닌지"를 함께 적는다.

| 가드 | 막는 것 |
|---|---|
| `deadColourTokenGuard` | 소비자 없는 `--color-*` |
| `themeTokenParity` | 라이트에만 있고 다크에 없는 토큰 |
| `surfaceAsBorderGuard` | 표면 토큰을 경계로 사용(`border-secondary-800` = 카드 위 1.00:1) |
| `controlBorderTokenGuard` · `controlBorderContrast` | 조작 요소 경계가 3:1 미달 |
| `disabledOpacityGuard` | `disabled:opacity-*` |
| `focusIndicatorGuard` | 포커스 표시 없는 조작 요소 |
| `headingColourTokenGuard` | 색 클래스 없는 heading(가장 밝은 단계를 상속해 위계가 뒤집힌다) |
| `semanticTextTokenGuard` | 텍스트에 `chart-*`(그래픽용 3:1) 사용 |
| `graphicAlphaContrastGuard` | 알파 합성 후 3:1 미달인 그래픽 |
| `radiusScaleGuard` | 반경 3단계(`rounded` / `rounded-lg` / `rounded-full`) 밖의 값 |
| `chartPaletteContrastGuard` · `chartThemeRemountGuard` | 캔버스 팔레트 대비, 테마 전환 시 remount |
| `sourceScanParity` | 스캐너 자신이 주석을 잘못 보는 것 |

### 재는 법 — 측정기를 먼저 의심하라

실패가 수십 건 나오면 제품이 아니라 **측정기**를 의심한다. 이 리디자인에서 가짜 실패를
만든 원인들이다.

- **정규식으로 색을 읽지 않는다.** Tailwind v4는 `oklab()`을 내보내고, 정규식은 그걸
  가짜 검정으로 읽어 실패 33건을 지어냈다. canvas에 칠해 실제 RGB로 해석한다.
- **알파와 조상 사슬을 합성한다.** 바로 위 부모만 보면 중간 배경을 놓쳐 1.06:1이라고
  보고하는데 실제는 6.70:1이다. `document.documentElement`까지 걸어 올라간다.
- **테마 전환은 reload로 잰다.** 런타임에 `dataset.theme`만 뒤집으면 배경만 바뀌고
  자손 토큰은 옛 값을 유지한다(활성 칩 2.83:1 가짜 대 5.16:1 실제). `localStorage` +
  reload.
- **백그라운드 탭에서 재지 않는다.** 트랜지션이 t=0에 고정돼 좌표가 영구 from-value가
  되고, rAF가 안 돌아 **레이아웃 자체가 stale**이다. `getAnimations().forEach(a => a.finish())`
  후에 읽는다.
- **캔버스는 DOM 프로브가 볼 수 없다.** 지표 색은 렌더가 아니라 **상수에서** 검사한다
  (`chartPaletteContrastGuard`). 그리고 대비비는 휘도만 보므로 **같은 배경에 맞춘 색들끼리는
  1.0이 나온다** — 색 구분은 CIE76 ΔE로 따로 잰다(현재 라이트 최소 18.62 / 다크 12.79).
- **측정 중에 소스를 고치지 않는다.** Next dev는 라우트별로 컴파일하므로, 재는 도중
  컴포넌트를 고치면 라우트마다 다른 버전이 서빙된다. 하이드레이션 에러가 안 나서 신호도 없다.

### 문구 규약

- **한글 라벨에 `font-mono`·`uppercase`·넓은 자간을 쓰지 않는다.** Geist Mono에 한글
  글리프가 없어 OS 폰트로 조용히 폴백되고(맥·윈도가 다르게 보인다), 한글에는 대소문자가
  없어 `uppercase`가 무효이며, 0.18em은 라틴 소문자 기준이라 자모가 흩어진다. 위계는
  크기와 굵기로 만든다 — `LABEL_KO` / `HEADING_SECTION` / `HEADING_SUBSECTION`.
- **한글과 숫자가 한 줄에 섞이면 모노 대신 `tabular-nums`.** 자릿수 정렬만 필요한
  경우가 대부분이고, 모노를 걸면 그 줄이 두 서체로 조판된다.
- **잠긴 기능은 "회원"이라고 부른다.** "PRO"가 아니다 — 가입만 하면 열리는 것이라
  유료 등급으로 읽히면 안 된다.
- **통화 기호는 심볼에서 유도한다.** `currencyForSymbol`(`shared/config/marketProfile`)이
  유일한 판정처다. `$`를 하드코딩하면 한국 상장 종목(`005930.KS`)에 달러가 붙는다.
- **티커가 읽히는 시장과 아닌 시장을 구분한다.** 미국 티커(`AAPL`)는 사람이 아는 이름이라
  주 라인이지만, KRX 티커(`005930.KS`)는 아무 뜻도 없는 6자리라 한글명이 주 라인이다
  (`DashboardScope.tickerIsReadable`). 새 시세 카드를 티커 고정으로 만들면 `/market/kr`이
  제목이 전부 숫자인 페이지로 돌아간다.
- **`[강세]`/`[약세]` 배지와 ⓘ 툴팁은 유지한다.** 방향과 근거를 색에만 싣지 않기 위한
  장치라 색이 안 보이는 환경에서 유일한 단서다.

---

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
