# 백테스팅 소개 페이지 설계

**날짜:** 2026-04-20  
**상태:** 승인됨

---

## 1. 목적

Siglens의 기술적 분석 + AI 분석 신뢰도를 증명하는 정적 마케팅 페이지.
"얼마나 정확한가요?"라는 잠재 사용자의 질문에 데이터로 답한다.

---

## 2. 페이지 위치

- **라우트:** `/backtesting`
- **홈페이지 연결:** 홈(`/`) 어딘가에 CTA 버튼 1개 → `/backtesting` 링크
- **독립 페이지:** 홈페이지에 통합하지 않음

---

## 3. 테스트 대상

### 종목 (10개)
| 구분 | 티커 |
|---|---|
| Magnificent 7 | AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA |
| 선도 섹터 주도주 | PLTR, CRWD, MSTR |

### 기간
- **2025년 04월 ~ 2026년 04월 (1년)**

### 케이스 수
- 종목당 최대 10개, 전체 약 93개 케이스
- **승/패 비율: 약 8:2** (100% 적중만 보여주면 오히려 신뢰도 하락)

---

## 4. 데이터 구조

### 데이터 소스
- FMP API로 일봉 데이터 수신
- 기존 `src/domain/indicators/` 계산 로직으로 신호 생성
- AI 분석은 `worker/src/claude.ts` (또는 `worker/src/gemini.ts`) 코드를 직접 호출 — Redis 폴링 없음
- **로컬 스크립트로 직접 실행 후 결과를 JSON 파일로 저장**

### JSON 파일 위치
```
src/app/backtesting/data.json
```

### JSON 스키마

```typescript
type SignalResult = "win" | "loss"

type BacktestCase = {
  ticker: string            // "NVDA"
  entryDate: string         // "2025-04-11"
  entryPrice: number        // 98.31
  exitDate: string          // "2025-04-19"
  exitPrice: number         // 121.42
  holdingDays: number       // 8
  returnPct: number         // 23.5  (양수 = 수익, 음수 = 손실)
  signalType: "buy" | "sell"
  result: SignalResult
  exitReason: "signal" | "stop_loss"  // 매도신호 vs 손절
  aiAnalysis: {
    summary: string         // AI 분석 발췌 (1~2문장)
    tags: string[]          // ["RSI 과매도 반등", "Squeeze 양전환", ...]
  }
}

type BacktestData = {
  meta: {
    period: string          // "2025.04 – 2026.04"
    totalCases: number      // 93
    winRate: number         // 73.2
    aiWinRate: number       // 68.9
    tickerCount: number     // 10
  }
  cases: BacktestCase[]     // 날짜순 정렬 (entryDate ASC)
}
```

---

## 5. 페이지 구조

### 5-1. Hero 섹션
- 소제목: `BACKTESTING RESULTS · 2025.04 – 2026.04`
- 제목: `Siglens가 얼마나 정확한가요?`
- 핵심 수치 3개 (인라인 카드):
  - 지표 신호 승률 (%)
  - AI 예측 승률 (%)
  - 총 케이스 수 + 테스트 종목 수

### 5-2. 티커 탭
- `전체` + 10개 티커 탭
- 탭 선택 시 해당 티커 케이스만 필터링
- 기본값: `전체`

### 5-3. 케이스 리스트
- 날짜 오름차순 정렬 (entryDate ASC)
- 월별 구분선 (`2025년 04월`, `2025년 06월` …)
- 각 케이스 카드:
  - **헤더:** 티커 뱃지 / 매수→보유기간→매도 타임라인 / 수익률 + ✓✗
  - **본문:** AI 분석 발췌 (사이드 컬러바: 승→초록, 패→주황)
  - **태그:** 신호 근거가 된 기술적 지표 태그 (최대 3개)
- **패 케이스 스타일:** 카드 테두리 빨간색, 티커 뱃지 빨간색

### 5-4. 면책 조항 (하단 고정)
> "본 결과는 과거 데이터 기반 백테스팅이며 미래 수익을 보장하지 않습니다. 투자 판단의 책임은 투자자 본인에게 있습니다."

---

## 6. 데이터 원칙

### AI 분석 발췌 작성 규칙
- **순수 기술적 분석만:** RSI, MACD, Supertrend, Squeeze, OBV, CMF, ATR, Ichimoku, DMI, CCI, Parabolic SAR, MFI, VWAP, Keltner 등
- **금지:** 뉴스, 섹터 동향, 정책, 거시경제 언급 일절 없음
- 승 케이스: 진입 근거 지표 + 예측 방향
- 패 케이스: 초기 신호 + 무효화 원인 (기술적으로)

### 신뢰도 설계
- 패 케이스 약 2/10 비율 포함 — 100% 적중 배제
- 패 케이스에 "왜 틀렸는지" 기술적 원인 명시
- 극적 수익 케이스(+70%대) 포함하되 과장 없이 실제 데이터 기반

---

## 7. 아키텍처

### 레이어 배치
```
app/backtesting/
  page.tsx          ← RSC, data.json import, 렌더링
  data.json         ← 사전 계산된 백테스팅 결과

components/backtesting/
  BacktestHero.tsx          ← 상단 요약 수치
  BacktestTabs.tsx          ← 티커 필터 탭 (Client Component)
  BacktestCaseList.tsx      ← 케이스 리스트 (날짜 그룹핑)
  BacktestCaseCard.tsx      ← 개별 케이스 카드

domain/
  types.ts          ← BacktestCase, BacktestData 타입을 기존 types.ts에 추가
```

### 레이어 규칙 준수
- `app/backtesting/page.tsx`: `data.json` 직접 import (infrastructure 불필요)
- `components/`: `domain/types.ts` 타입만 import
- `BacktestTabs.tsx`: `"use client"` — 탭 상태 관리
- 나머지 컴포넌트: Server Component

### 데이터 흐름
```
data.json
  → page.tsx (RSC, import)
  → BacktestHero (meta 통계)
  → BacktestTabs + BacktestCaseList (cases 배열)
    → BacktestCaseCard (개별 렌더링)
```

---

## 8. 스타일

- 기존 다크 테마 (`#0f1117` 배경) 유지
- 승 케이스: `#4ade80` (green-400)
- 패 케이스: `#f87171` (red-400), 경고: `#f59e0b` (amber-400)
- AI 분석 사이드바: 승→초록 2px, 패→주황 2px
- 태그: `#60a5fa` (blue-400) 계열

---

## 9. 홈페이지 CTA

`app/page.tsx` (또는 적절한 섹션)에 단순 CTA 추가:
```
"Siglens는 얼마나 정확할까요? → 백테스팅 결과 보기"
```
링크: `/backtesting`

---

## 10. 범위 외 (Out of Scope)

- 실시간 데이터 업데이트 — 수동 JSON 교체로 관리
- 사용자별 커스텀 백테스팅 — 없음
- 백테스팅 계산 자동화 스크립트 — 별도 작업
