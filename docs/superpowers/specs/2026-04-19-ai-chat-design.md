# AI Chat Feature — Design Spec

**Date:** 2026-04-19
**Status:** Approved

---

## Overview

분석 결과 페이지(`[symbol]`)에서 사용자가 AI와 대화할 수 있는 기능.
분석 데이터를 컨텍스트로 주입하여 분석 범위 내 질문에만 답변한다.
현재는 Gemini 2.5 Flash만 활성화. 추후 유료 플랜에서 고급 모델 개방 예정.

---

## UI 배치

### 데스크톱
- `AnalysisPanel` 하단 인라인에 채팅 영역 배치
- **고정 높이** (약 350px) — 채팅 메시지는 컨테이너 내부에서만 스크롤
- 분석 패널은 위에서 항상 참고 가능, 사이드바 총 길이 변하지 않음

### 모바일
- 기존 `MobileAnalysisSheet` 내부에 "💬 AI에게 물어보기" 버튼 추가
- 버튼 탭 → 시트 내용이 채팅 뷰로 전환 (바텀시트 이중 중첩 없음)
- "← 분석으로" 버튼으로 분석 뷰 복귀

---

## Chat UI 디자인

- **말풍선 스타일 (Option A)**: 좌측 AI, 우측 사용자 메시지
- **입력창**: 모델명(`Gemini 2.5 Flash`) + "분석 범위 내 질문만 가능" 안내를 항상 표시
- **로딩 상태**: AI 말풍선이 먼저 등장하여 단계별 메시지 표시
  - "요청을 분석하고 있어요..."
  - "응답을 생성하고 있어요..."
  - → Server Action 완료 시 실제 응답으로 교체
- **분석 미완료 시**: 입력창 비활성화 + "분석이 완료된 후 질문할 수 있어요" placeholder

---

## 아키텍처

### 레이어 구조

```
domain/chat/
  types.ts              — ChatMessage, ChatSession, ChatRequest/Response 타입
  buildChatPrompt.ts    — System Prompt 조립 (분석 컨텍스트 주입)

infrastructure/chat/
  chatAction.ts         — Server Action: Gemini 호출, Redis 토큰 차감
  tokenStore.ts         — Redis: 세션 토큰 카운트 read/write

components/chat/
  ChatPanel.tsx         — 채팅 UI (말풍선 + 입력창)
  hooks/useChat.ts      — 메시지 상태, localStorage 히스토리, 로딩 단계
```

### 데이터 흐름

```
ChatPanel (사용자 입력)
  → useChat hook
    → localStorage 히스토리 로드/저장
    → chatAction (Server Action)
      → tokenStore.get(hash(ip)) — 토큰 확인
      → buildChatPrompt() — system prompt + 분석 컨텍스트 조립
      → Gemini API 호출
      → 성공 시 tokenStore.decrement()
      → 실패 시 토큰 차감 안 함
  → 말풍선 업데이트
```

### 구현 방식
Server Action + 로딩 단계 메시지. 스트리밍 없음.
(스트리밍은 추후 유료 플랜 업그레이드 포인트로 예약)

---

## System Prompt 설계

```
당신은 {symbol} 종목의 기술적 분석 결과를 바탕으로 사용자의 질문에 답하는
AI 어시스턴트입니다. 아래 분석 데이터만을 근거로 답변하세요.

분석과 무관한 질문(종목 추천, 타 종목, 일반 금융 조언 등)에는
"이 분석 결과와 관련된 질문만 답변할 수 있어요."라고 정중히 거절하세요.

사용자는 주식 기술적 분석을 잘 모르는 초보자입니다.
전문 용어 대신 쉬운 말로 설명하고, 맥락에 맞는 비유를 활용하세요.
억지스러운 비유는 피하세요.

한국어로 답변하세요.

[분석 컨텍스트]
- 종목: {symbol} · 타임프레임: {timeframe}
- 추세: {trend} · 리스크: {riskLevel}
- 요약: {analysis.summary}
- 매매 전략: {actionRecommendation.entry} / {actionRecommendation.exit}
- 주요 레벨: 지지 {support} / 저항 {resistance}
- 감지된 패턴: {detectedPatterns}
- 보조지표 시그널: {indicatorResults 요약}
- 가격 목표: 상승 {bullish.targets} / 하락 {bearish.targets}
```

**주입하지 않는 것:** raw OHLCV 캔들 배열 (토큰 낭비, AI 활용 불가)

### 멀티턴
이전 대화 히스토리를 함께 전달하여 연속 대화 지원:
```typescript
messages: [
  { role: 'user', content: '...' },
  { role: 'model', content: '...' },
  { role: 'user', content: '현재 질문' },
]
```

---

## Rate Limiting (토큰제)

- **무료**: IP 기반 5회 / 24시간
- **유료 플랜**: 무제한 (추후 구현)
- **저장소**: Upstash Redis
- **키**: `chat:tokens:{sha256(ip)}` — TTL 24h

```typescript
// Redis key 구조
chat:tokens:{sha256(ip)}  →  value: 5, TTL: 86400s
```

IP는 해시 처리 후 저장 (raw IP 비보관).
Redis 미설정 시: rate limit 비활성화로 graceful degradation (기존 캐시 패턴과 동일).

---

## 에러 처리

| 상황 | 에러 코드 | 채팅창 표시 |
|------|----------|------------|
| 토큰 소진 | `token_exhausted` | "오늘 무료 질문 5회를 모두 사용했어요. 내일 다시 이용하거나 유료 플랜을 이용해보세요." |
| Gemini 429 | `rate_limited` | "AI 서버가 잠시 바빠요. 10초 후 다시 시도해주세요." + countdown |
| 서버/네트워크 오류 | `server_error` | "일시적인 오류가 발생했어요. 다시 시도해주세요." + 재시도 버튼 |
| 범위 외 질문 | — | Gemini가 텍스트로 자연스럽게 거절 (별도 처리 불필요) |
| 분석 미완료 | — | 입력창 비활성화 |

---

## 대화 히스토리 관리

- **저장소**: `localStorage`
- **키**: `siglens_chat_{symbol}_{timeframe}` (예: `siglens_chat_AAPL_1D`)
- **TTL**: 7일 초과 시 자동 만료
- **심볼·타임프레임 변경 시**: 현재 대화 저장 → 새 키 로드 (있으면 복원, 없으면 새 채팅)
- **재분석 시**: 히스토리 유지 + "분석이 업데이트됐어요 — 최신 결과 기반으로 이어서 질문하세요" 배너

---

## 모델 선택 UI

현재는 Gemini 2.5 Flash만 활성화. 다른 모델(Claude, OpenAI)은 비활성화 표시.
추후 유료 플랜에서 고급 모델 개방 시 이 UI에서 선택 가능.

---

## 개인정보처리방침 업데이트

**파일**: `src/app/privacy/page.tsx`

추가 항목:
> AI 질문 횟수 제한을 위해 IP 주소를 식별 불가능한 형태(해시)로 처리하여 24시간 보관 후 자동 삭제합니다. 이는 서비스 남용 방지 목적으로만 사용되며, 다른 개인정보와 결합되지 않습니다.
