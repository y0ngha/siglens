# Chat Model Selector & 503 Error Handling — Design Spec

**Date:** 2026-04-22
**Status:** Approved

---

## Overview

AI 채팅 패널에 모델 선택 기능을 추가하고, Gemini 503(high demand) 에러 발생 시 사용자에게 모델 전환을 안내한다.
Textarea 높이도 2줄로 확장한다.

---

## Background

- `gemini-2.5-flash` 모델이 high demand로 503을 반환하는 경우가 잦다.
- 현재는 503도 `server_error`로 뭉뚱그려 처리되어 사용자가 원인을 알 수 없다.
- `GEMINI_CHAT_FREE_API_KEY` 환경 변수명 불일치(`.env.local`에는 `GEMINI_FREE_API_KEY`)로 free key fallback이 동작하지 않는 부가 문제도 존재하나, 이번 스펙 범위에서는 모델 선택 기능으로 사용자가 직접 대응할 수 있도록 한다.

---

## Architecture

### 변경 파일 목록

| 파일 | 역할 | 변경 종류 |
|---|---|---|
| `domain/constants/chatModels.ts` | 모델 ID 상수 정의 | **신규** |
| `domain/types.ts` | `ChatModel` 타입, `ChatErrorCode` 확장 | 수정 |
| `infrastructure/chat/chatAction.ts` | `model` 파라미터 수신, 503 감지 | 수정 |
| `components/chat/hooks/useChat.ts` | `selectedModel` 상태 관리 및 노출 | 수정 |
| `components/chat/ChatPanel.tsx` | 드롭다운 UI, 헤더 정리, rows 확장 | 수정 |

### 레이어 의존성 (위반 없음)

```
domain/constants  ←  domain/types
                  ←  infrastructure/chat/chatAction
                  ←  components/chat/hooks/useChat
                  ←  components/chat/ChatPanel
```

---

## 1. Domain — 상수 & 타입

### `domain/constants/chatModels.ts` (신규)

```ts
export const GEMINI_2_5_FLASH_MODEL = 'gemini-2.5-flash' as const;
export const GEMINI_2_5_FLASH_LITE_MODEL = 'gemini-2.5-flash-lite' as const;
```

### `domain/types.ts` 변경

```ts
import { GEMINI_2_5_FLASH_MODEL, GEMINI_2_5_FLASH_LITE_MODEL }
    from '@/domain/constants/chatModels';

// 추가
export type ChatModel =
    | typeof GEMINI_2_5_FLASH_MODEL
    | typeof GEMINI_2_5_FLASH_LITE_MODEL;

// 기존 ChatErrorCode에 server_busy 추가
export type ChatErrorCode =
    | 'token_exhausted'
    | 'rate_limited'
    | 'server_error'
    | 'server_busy';
```

---

## 2. Infrastructure — chatAction

### 변경 사항

- `model: ChatModel` 파라미터 추가 (기본값 `GEMINI_2_5_FLASH_MODEL`)
- `isServerBusyError` 함수 추가: HTTP 503 감지
- catch 블록에 `server_busy` 분기 추가

```ts
import { GEMINI_2_5_FLASH_MODEL } from '@/domain/constants/chatModels';

function isServerBusyError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status: number }).status ===
            constants.HTTP_STATUS_SERVICE_UNAVAILABLE  // 503
    );
}

export async function chatAction(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string,
    model: ChatModel = GEMINI_2_5_FLASH_MODEL,
): Promise<ChatActionResult>

// catch 블록
} catch (error) {
    if (isRateLimitError(error))  return { ok: false, error: 'rate_limited' };
    if (isServerBusyError(error)) return { ok: false, error: 'server_busy' };
    return { ok: false, error: 'server_error' };
}
```

---

## 3. Hook — useChat

### 변경 사항

- `selectedModel: ChatModel` 상태 추가 (초기값: `GEMINI_2_5_FLASH_MODEL`)
- `setSelectedModel` 콜백 추가 및 `UseChatReturn`으로 노출
- `mutationFn`에 `selectedModel` 전달
- `ERROR_MESSAGES`에 `server_busy` 추가

```ts
server_busy: 'AI 서버가 지금 바빠요. 위의 모델 선택기에서 다른 모델로 바꿔보세요.',
```

### `UseChatReturn` 인터페이스 확장

```ts
export interface UseChatReturn {
    messages: ChatMessage[];
    loadingPhase: ChatLoadingPhase | null;
    analysisUpdated: boolean;
    remainingTokens: number | null;
    sendMessage: (text: string) => Promise<void>;
    dismissAnalysisUpdated: () => void;
    selectedModel: ChatModel;                      // 신규
    setSelectedModel: (model: ChatModel) => void;  // 신규
}
```

---

## 4. UI — ChatPanel

### 헤더

- 기존 모델명 칩(`CHAT_MODEL_DISPLAY_NAME`) **제거**
- 닫기 버튼만 유지

### 입력 영역 상단 바

기존 정적 모델명 칩 → **커스텀 드롭다운 트리거**로 교체

```
[Flash ▾] · 분석 범위 내 질문만 가능 · 오늘 3회 남음
```

### 드롭다운 동작

- `usePopoverToggle([triggerRef, dropdownRef])` 로 외부 클릭 감지
- 열기 시 `getBoundingClientRect()`로 위/아래 여백 비교 → 더 넓은 쪽으로 방향 결정
- 기본값 `opensUpward = true` (입력 영역은 패널 하단이므로)

```ts
const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setOpensUpward(rect.top > window.innerHeight - rect.bottom);
    }
    toggle();
};
```

드롭다운 위치 클래스:

```
opensUpward  → 'bottom-full mb-1'
!opensUpward → 'top-full mt-1'
```

### 모델 표시명 상수 (ChatPanel 내부)

```ts
const CHAT_MODEL_OPTIONS = [
    { id: GEMINI_2_5_FLASH_MODEL,      label: 'Flash',      fullName: 'Gemini 2.5 Flash' },
    { id: GEMINI_2_5_FLASH_LITE_MODEL, label: 'Flash Lite', fullName: 'Gemini 2.5 Flash Lite' },
] as const;
```

### 모바일 고려

- 드롭다운 아이템 최소 높이 `min-h-[44px]` (터치 타겟 기준)
- 방향 계산으로 뷰포트 잘림 방지
- `pointerdown` 기반 `useOnClickOutside` (터치 이벤트 포함)

### Textarea

- `rows={1}` → `rows={2}`
- `min-h-[32px]` → `min-h-[52px]`

---

## Error Handling

| 에러 코드 | 조건 | 메시지 |
|---|---|---|
| `token_exhausted` | Redis 토큰 소진 | 오늘 무료 질문 5회 모두 사용 |
| `rate_limited` | HTTP 429 | AI 서버가 잠시 바빠요 |
| `server_busy` | HTTP 503 | AI 서버가 지금 바빠요. 위의 모델 선택기에서 다른 모델로 바꿔보세요. |
| `server_error` | 그 외 예외 | 일시적인 오류가 발생했어요. 다시 시도해주세요. |

---

## Out of Scope

- `GEMINI_CHAT_FREE_API_KEY` 환경 변수명 불일치 수정 (별도 작업)
- 선택한 모델을 localStorage에 영속화
- 모델 추가 시 환경 변수로 목록 동적 관리
