# Design System

## 컬러 철학

주식 분석 플랫폼으로서 두 가지 감정을 전달한다.
- **신뢰** — 사용자가 데이터를 믿고 의사결정할 수 있다는 확신
- **편안함** — 복잡한 분석을 쉽게 소화할 수 있다는 안도감

다크 모드 기반. 차트 가독성과 장시간 사용 피로도를 고려한다.

---

## Primary Color — Trust Blue

신뢰, 안정, 전문성을 표현한다.
주요 액션(버튼, 링크, 활성 상태, 포커스 링)에 사용한다.

```
--color-primary-50:  #eff6ff
--color-primary-100: #dbeafe
--color-primary-200: #bfdbfe
--color-primary-300: #93c5fd
--color-primary-400: #60a5fa
--color-primary-500: #3b82f6   ← 메인 (배경이 밝을 때)
--color-primary-600: #2563eb   ← 메인 (다크 모드 기본)
--color-primary-700: #1d4ed8
--color-primary-800: #1e40af
--color-primary-900: #1e3a8a
--color-primary-950: #172554
```

**사용처**
```
버튼 (primary)         bg-blue-600 hover:bg-blue-700
활성 탭/메뉴           text-blue-400 border-blue-400
포커스 링              ring-blue-500
링크                   text-blue-400 hover:text-blue-300
인디케이터 라인 (MA120/EMA120)  #3b82f6
```

---

## Secondary Color — Slate

편안함, 중립, 배경감을 표현한다.
배경, 카드, 보조 텍스트, 구분선에 사용한다.

```
--color-secondary-50:  #f8fafc
--color-secondary-100: #f1f5f9
--color-secondary-200: #e2e8f0
--color-secondary-300: #cbd5e1
--color-secondary-400: #94a3b8
--color-secondary-500: #64748b
--color-secondary-600: #475569
--color-secondary-700: #334155
--color-secondary-800: #1e293b   ← 카드/패널 배경
--color-secondary-900: #0f172a   ← 페이지 배경
--color-secondary-950: #020617
```

**사용처**
```
페이지 배경            bg-slate-900
카드/패널 배경         bg-slate-800
차트 배경              bg-slate-900
보조 텍스트            text-slate-400
구분선                 border-slate-700
그리드 라인            #1e293b
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
AI 분석 bullish    text-chart-bullish
AI 분석 bearish    text-chart-bearish
AI 분석 neutral    text-secondary-400
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

---

## UI Color — 심각도 표시

UI 상태 심각도를 표현한다. 차트 컬러와 구분되는 UI 전용 토큰이다.

```
--color-ui-warning: #f59e0b   (앰버)
```

**사용처**
```
medium risk 표시      text-ui-warning
moderate strength     text-ui-warning
```

참고: `#f59e0b`는 `chart.signal`(MACD 시그널 라인)과 동일한 값이지만, UI 상태 표시 목적으로 별도 토큰(`ui-warning`)을 분리한다. 차트 시그널 렌더링에는 `chart-signal`을 사용하고, UI 심각도 표시에는 `ui-warning`을 사용한다.

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

## Tailwind 설정

`tailwind.config.ts`에 커스텀 컬러로 등록한다.

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    50:  '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#172554',
                },
                secondary: {
                    50:  '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#020617',
                },
                chart: {
                    // 상승/하락/중립
                    bullish: '#26a69a',
                    bearish: '#ef5350',
                    neutral: '#94a3b8',
                    // MA / EMA (기간별, 실선=MA / 점선=EMA 공용 색상)
                    period5:   '#ef4444',
                    period10:  '#f97316',
                    period20:  '#eab308',
                    period60:  '#22c55e',
                    period120: '#3b82f6',
                    period200: '#a855f7',
                    // 볼린저 밴드
                    bollinger: '#818cf8',
                    // MACD
                    macd:      '#3b82f6',
                    signal:    '#f59e0b',
                    // RSI
                    rsi:       '#a78bfa',
                    // DMI
                    dmiPlus:   '#26a69a',
                    dmiMinus:  '#ef5350',
                    dmiAdx:    '#f59e0b',
                    // Stochastic
                    stochasticK: '#f472b6',
                    stochasticD: '#38bdf8',
                    // Stochastic RSI
                    stochRsiK: '#facc15',
                    stochRsiD: '#60a5fa',
                    // VWAP
                    vwap:      '#e879f9',
                },
            },
        },
    },
    plugins: [],
};

export default config;
```

---

## 사용 규칙

```
✅ 컬러 토큰 사용
<div className="bg-secondary-900 text-primary-400">

✅ 차트 컬러는 상수로 관리
import { CHART_COLORS } from '@/domain/constants/colors';

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
   → 임의로 변경 금지

3. 라이트 모드 고려
   → Siglens는 다크 모드 전용
   → 라이트 모드 분기 처리 불필요
```