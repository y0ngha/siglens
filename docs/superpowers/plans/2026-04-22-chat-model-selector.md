# Chat Model Selector & 503 Error Handling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 채팅 패널에 모델 선택 드롭다운을 추가하고, Gemini 503(high demand) 에러를 별도 처리하며 Textarea 높이를 2줄로 확장한다.

**Architecture:** 모델 ID 상수를 `domain/constants/chatModels.ts`에 정의 → `domain/types.ts`에서 `ChatModel`·`server_busy` 타입으로 노출 → `chatAction`이 `model` 파라미터를 받아 Gemini 호출 시 사용 → `useChat` 훅이 `selectedModel` 상태를 관리·노출 → `ChatPanel`이 `usePopoverToggle` 기반 커스텀 드롭다운으로 모델 전환 제공.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4, `@google/genai` v1, `usePopoverToggle` (내부 훅)

---

## File Map

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/domain/constants/chatModels.ts` | 모델 ID 상수 | **신규** |
| `src/domain/types.ts` | `ChatModel` 타입, `server_busy` 에러코드 | 수정 (L731) |
| `src/infrastructure/chat/chatAction.ts` | `model` 파라미터, `isServerBusyError` | 수정 |
| `src/__tests__/infrastructure/chat/chatAction.test.ts` | 신규 케이스 추가 | 수정 |
| `src/components/chat/hooks/useChat.ts` | `selectedModel` 상태, `setSelectedModel` | 수정 |
| `src/components/chat/ChatPanel.tsx` | 드롭다운 UI, 헤더 정리, `rows={2}` | 수정 |

---

## Task 1: Domain 상수 파일 생성

**Files:**
- Create: `src/domain/constants/chatModels.ts`

- [ ] **Step 1: 파일 생성**

`src/domain/constants/chatModels.ts` 를 아래 내용으로 생성한다:

```ts
export const GEMINI_2_5_FLASH_MODEL = 'gemini-2.5-flash' as const;
export const GEMINI_2_5_FLASH_LITE_MODEL = 'gemini-2.5-flash-lite' as const;
```

- [ ] **Step 2: lint 통과 확인**

```bash
yarn lint
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/domain/constants/chatModels.ts
git commit -m "feat: Gemini 모델 ID 상수 정의 (chatModels)"
```

---

## Task 2: domain/types.ts — ChatModel 타입·server_busy 에러코드 추가

**Files:**
- Modify: `src/domain/types.ts:731`

- [ ] **Step 1: types.ts 수정**

`src/domain/types.ts` L731 근처를 아래와 같이 수정한다.

기존:
```ts
export type ChatErrorCode = 'token_exhausted' | 'rate_limited' | 'server_error';
```

변경 후 (L719 위쪽에 import 추가 + L731 수정):
```ts
// L719 블록 바로 위에 추가
import {
    GEMINI_2_5_FLASH_MODEL,
    GEMINI_2_5_FLASH_LITE_MODEL,
} from '@/domain/constants/chatModels';

// ChatMessage 블록 이후, ChatLoadingPhase 앞에 추가
export type ChatModel =
    | typeof GEMINI_2_5_FLASH_MODEL
    | typeof GEMINI_2_5_FLASH_LITE_MODEL;

// 기존 ChatErrorCode 라인을 교체
export type ChatErrorCode =
    | 'token_exhausted'
    | 'rate_limited'
    | 'server_error'
    | 'server_busy';
```

> ⚠️ `domain/types.ts`는 현재 import가 없는 파일이다. import를 파일 최상단(기존 첫 줄 앞)에 추가하거나, Chat 섹션 내 적절한 위치에 둔다. 파일 상단을 먼저 확인하고 기존 import 블록이 있다면 거기에 추가한다.

- [ ] **Step 2: lint + 타입 체크**

```bash
yarn lint
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/domain/types.ts
git commit -m "feat: ChatModel 타입, server_busy 에러코드 추가"
```

---

## Task 3: chatAction — model 파라미터 + 503 감지

**Files:**
- Modify: `src/infrastructure/chat/chatAction.ts`
- Modify: `src/__tests__/infrastructure/chat/chatAction.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/infrastructure/chat/chatAction.test.ts`의 `describe` 블록 안에 아래 두 테스트를 추가한다:

```ts
it('Gemini 503 에러 시 server_busy를 반환한다', async () => {
    mockTryConsumeToken.mockResolvedValueOnce(true);
    const error = Object.assign(new Error('503'), { status: 503 });
    mockGenerateContent.mockRejectedValueOnce(error);

    const result = await chatAction(
        'AAPL',
        '1Day',
        MINIMAL_ANALYSIS,
        [],
        '질문'
    );

    expect(result).toEqual({ ok: false, error: 'server_busy' });
});

it('model 파라미터를 Gemini 호출에 전달한다', async () => {
    mockTryConsumeToken.mockResolvedValueOnce(true);
    mockGetRemainingTokens.mockResolvedValueOnce(4);

    let capturedModel = '';
    MockGoogleGenAI.mockImplementation(
        () =>
            ({
                models: {
                    generateContent: jest
                        .fn()
                        .mockImplementation(
                            (params: { model: string }) => {
                                capturedModel = params.model;
                                return Promise.resolve({ text: '응답' });
                            }
                        ),
                },
            }) as unknown as InstanceType<typeof GoogleGenAI>
    );

    await chatAction(
        'AAPL',
        '1Day',
        MINIMAL_ANALYSIS,
        [],
        '질문',
        'gemini-2.5-flash-lite'
    );

    expect(capturedModel).toBe('gemini-2.5-flash-lite');
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test --testPathPattern="chatAction" --no-coverage
```

Expected: 위 두 테스트 FAIL (함수 시그니처 미변경 상태)

- [ ] **Step 3: chatAction.ts 수정**

`src/infrastructure/chat/chatAction.ts` 전체를 아래와 같이 수정한다:

```ts
'use server';

import { constants } from 'node:http2';
import { headers } from 'next/headers';
import type {
    AnalysisResponse,
    ChatActionResult,
    ChatMessage,
    ChatModel,
    Timeframe,
} from '@/domain/types';
import { GEMINI_2_5_FLASH_MODEL } from '@/domain/constants/chatModels';
import { buildChatPrompt } from '@/domain/chat/buildChatPrompt';
import {
    getRemainingTokens,
    hashIp,
    tryConsumeToken,
} from '@/infrastructure/chat/tokenStore';
import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';

async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}

function isRateLimitError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status: number }).status ===
            constants.HTTP_STATUS_TOO_MANY_REQUESTS
    );
}

function isServerBusyError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status: number }).status ===
            constants.HTTP_STATUS_SERVICE_UNAVAILABLE
    );
}

export async function chatAction(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string,
    model: ChatModel = GEMINI_2_5_FLASH_MODEL,
): Promise<ChatActionResult> {
    const paidApiKey = process.env.GEMINI_API_KEY;
    if (!paidApiKey) {
        return { ok: false, error: 'server_error' };
    }

    const ip = await getClientIp();
    const hashedIp = hashIp(ip);

    const allowed = await tryConsumeToken(hashedIp);
    if (!allowed) {
        return { ok: false, error: 'token_exhausted' };
    }

    const { systemPrompt, messages } = buildChatPrompt(
        symbol,
        timeframe,
        analysis,
        history,
        userMessage
    );

    const geminiContents = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
    }));

    try {
        const responseText = await callGeminiWithKeyFallback({
            freeApiKey: process.env.GEMINI_CHAT_FREE_API_KEY,
            paidApiKey,
            model,
            contents: geminiContents,
            systemInstruction: systemPrompt,
        });
        const remainingTokens = await getRemainingTokens(hashedIp);
        return { ok: true, message: responseText, remainingTokens };
    } catch (error) {
        if (isRateLimitError(error)) {
            return { ok: false, error: 'rate_limited' };
        }
        if (isServerBusyError(error)) {
            return { ok: false, error: 'server_busy' };
        }
        return { ok: false, error: 'server_error' };
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn test --testPathPattern="chatAction" --no-coverage
```

Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/infrastructure/chat/chatAction.ts src/__tests__/infrastructure/chat/chatAction.test.ts
git commit -m "feat: chatAction — model 파라미터 추가, server_busy(503) 에러 처리"
```

---

## Task 4: useChat — selectedModel 상태 관리

**Files:**
- Modify: `src/components/chat/hooks/useChat.ts`

- [ ] **Step 1: useChat.ts 수정**

`src/components/chat/hooks/useChat.ts`를 아래와 같이 수정한다.

**import 추가 (기존 import 블록 상단에):**
```ts
import type { ChatModel } from '@/domain/types';
import { GEMINI_2_5_FLASH_MODEL } from '@/domain/constants/chatModels';
```

> `ChatModel` 타입은 `@/domain/types`에서, 상수 값은 `@/domain/constants/chatModels`에서 가져온다.

**`ERROR_MESSAGES` 상수에 `server_busy` 추가:**
```ts
const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
    token_exhausted: `오늘 무료 질문 ${DAILY_CHAT_LIMIT}회를 모두 사용했어요. 내일 다시 이용해주세요.`,
    rate_limited: 'AI 서버가 잠시 바빠요. 잠시 후 다시 시도해주세요.',
    server_busy: 'AI 서버가 지금 바빠요. 위의 모델 선택기에서 다른 모델로 바꿔보세요.',
    server_error: '일시적인 오류가 발생했어요. 다시 시도해주세요.',
};
```

**`UseChatReturn` 인터페이스에 필드 추가:**
```ts
export interface UseChatReturn {
    messages: ChatMessage[];
    loadingPhase: ChatLoadingPhase | null;
    analysisUpdated: boolean;
    remainingTokens: number | null;
    sendMessage: (text: string) => Promise<void>;
    dismissAnalysisUpdated: () => void;
    selectedModel: ChatModel;
    setSelectedModel: (model: ChatModel) => void;
}
```

**`useChat` 함수 내부에 상태 추가** (기존 `useState` 선언들 바로 아래):
```ts
const [selectedModel, setSelectedModel] = useState<ChatModel>(GEMINI_2_5_FLASH_MODEL);
```

**`useMutation`의 `mutationFn`에 `selectedModel` 전달:**

기존:
```ts
mutationFn: ({
    currentMessages,
    text,
}: {
    currentMessages: ChatMessage[];
    text: string;
}) => chatAction(symbol, timeframe, analysis, currentMessages, text),
```

변경 후:
```ts
mutationFn: ({
    currentMessages,
    text,
}: {
    currentMessages: ChatMessage[];
    text: string;
}) => chatAction(symbol, timeframe, analysis, currentMessages, text, selectedModel),
```

**`return` 블록에 `selectedModel`·`setSelectedModel` 추가:**
```ts
return {
    messages,
    loadingPhase,
    analysisUpdated,
    remainingTokens: remainingTokensData ?? null,
    sendMessage,
    dismissAnalysisUpdated,
    selectedModel,
    setSelectedModel,
};
```

- [ ] **Step 2: lint 확인**

```bash
yarn lint
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/chat/hooks/useChat.ts
git commit -m "feat: useChat — selectedModel 상태 추가, server_busy 에러 메시지"
```

---

## Task 5: ChatPanel — 드롭다운 UI + Textarea 확장

**Files:**
- Modify: `src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: ChatPanel.tsx 수정**

`src/components/chat/ChatPanel.tsx` 전체를 아래 내용으로 교체한다:

```tsx
'use client';

import { useRef, useState } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import type { AnalysisResponse, ChatModel, Timeframe } from '@/domain/types';
import {
    GEMINI_2_5_FLASH_MODEL,
    GEMINI_2_5_FLASH_LITE_MODEL,
} from '@/domain/constants/chatModels';
import { cn } from '@/lib/cn';
import { usePopoverToggle } from '@/components/hooks/usePopoverToggle';
import { useChat } from '@/components/chat/hooks/useChat';
import { useChatInput } from '@/components/chat/hooks/useChatInput';

// 모델 선택 옵션 (모듈 레벨 상수 — 렌더마다 재생성 방지)
const CHAT_MODEL_OPTIONS: ReadonlyArray<{
    id: ChatModel;
    label: string;
    fullName: string;
}> = [
    {
        id: GEMINI_2_5_FLASH_MODEL,
        label: 'Flash',
        fullName: 'Gemini 2.5 Flash',
    },
    {
        id: GEMINI_2_5_FLASH_LITE_MODEL,
        label: 'Flash Lite',
        fullName: 'Gemini 2.5 Flash Lite',
    },
];

// 모듈 레벨 상수로 선언하여 렌더마다 객체가 재생성되지 않도록 한다
const MARKDOWN_COMPONENTS: Components = {
    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
    strong: ({ children }) => (
        <strong className="text-secondary-100 font-semibold">{children}</strong>
    ),
    em: ({ children }) => (
        <em className="text-secondary-300 italic">{children}</em>
    ),
    ul: ({ children }) => (
        <ul className="mb-1.5 ml-3 list-disc last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="mb-1.5 ml-3 list-decimal last:mb-0">{children}</ol>
    ),
    li: ({ children }) => <li className="mb-0.5">{children}</li>,
    h1: ({ children }) => (
        <p className="text-secondary-100 mb-1.5 font-semibold last:mb-0">
            {children}
        </p>
    ),
    h2: ({ children }) => (
        <p className="text-secondary-100 mb-1.5 font-semibold last:mb-0">
            {children}
        </p>
    ),
    h3: ({ children }) => (
        <p className="text-secondary-200 mb-1 font-medium last:mb-0">
            {children}
        </p>
    ),
    code: ({ children }) => (
        <code className="bg-secondary-800 text-secondary-300 rounded px-1 py-0.5 font-mono text-[10px]">
            {children}
        </code>
    ),
    pre: ({ children }) => (
        <pre className="bg-secondary-800 text-secondary-300 mb-1.5 overflow-x-auto rounded p-2 font-mono text-[10px] last:mb-0">
            {children}
        </pre>
    ),
};

const LOADING_MESSAGES = {
    analyzing: '요청을 분석하고 있어요...',
    generating: '응답을 생성하고 있어요...',
} as const;

interface ChatPanelProps {
    symbol: string;
    timeframe: Timeframe;
    analysis: AnalysisResponse;
    isAnalysisReady: boolean;
    onClose?: () => void;
}

export function ChatPanel({
    symbol,
    timeframe,
    analysis,
    isAnalysisReady,
    onClose,
}: ChatPanelProps) {
    const {
        messages,
        loadingPhase,
        analysisUpdated,
        remainingTokens,
        sendMessage,
        dismissAnalysisUpdated,
        selectedModel,
        setSelectedModel,
    } = useChat({ symbol, timeframe, analysis, isAnalysisReady });

    const {
        inputValue,
        setInputValue,
        isInputDisabled,
        inputRef,
        messagesEndRef,
        handleSubmit,
        handleKeyDown,
    } = useChatInput({ messages, loadingPhase, isAnalysisReady, sendMessage });

    // 모델 드롭다운 상태
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [opensUpward, setOpensUpward] = useState(true);
    const { isOpen, toggle, close } = usePopoverToggle([
        triggerRef,
        dropdownRef,
    ]);

    const handleDropdownToggle = () => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setOpensUpward(rect.top > window.innerHeight - rect.bottom);
        }
        toggle();
    };

    const selectedModelOption =
        CHAT_MODEL_OPTIONS.find(opt => opt.id === selectedModel) ??
        CHAT_MODEL_OPTIONS[0];

    const placeholder = !isAnalysisReady
        ? '분석이 완료된 후 질문할 수 있어요'
        : '질문을 입력하세요… (Enter로 전송)';

    return (
        <div className="flex flex-col">
            {/* 헤더 */}
            <div className="border-secondary-700 flex items-center justify-between border-b px-3 py-2">
                <span className="text-secondary-300 text-xs font-semibold">
                    💬 AI에게 물어보기
                </span>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-primary-500 rounded text-sm leading-none transition-colors focus-visible:ring-1 focus-visible:outline-none"
                        aria-label="채팅 닫기"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* 재분석 업데이트 배너 */}
            {analysisUpdated && (
                <div className="bg-primary-900/30 border-primary-700/50 flex items-center justify-between border-b px-3 py-1.5">
                    <span className="text-primary-300 text-xs">
                        분석이 업데이트됐어요 — 최신 결과 기반으로 이어서
                        질문하세요
                    </span>
                    <button
                        type="button"
                        onClick={dismissAnalysisUpdated}
                        className="text-primary-400 hover:text-primary-200 focus-visible:ring-primary-500 ml-2 rounded text-xs focus-visible:ring-1 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 메시지 영역 — 고정 높이, 내부 스크롤 */}
            <div className="flex h-[320px] flex-col gap-2 overflow-y-auto px-3 py-2">
                {messages.length === 0 && loadingPhase === null && (
                    <div className="bg-secondary-700/30 rounded-lg rounded-tl-sm p-3">
                        <p className="text-secondary-400 text-xs leading-relaxed">
                            분석 결과를 바탕으로 질문해보세요. 진입 타이밍, 매도
                            전략, 지표 해석 등을 물어보실 수 있어요.
                        </p>
                    </div>
                )}

                {/* 메시지 목록은 append-only이므로 role+index 키가 안전하다 */}
                {messages.map((msg, i) => (
                    <div
                        key={`${msg.role}-${i}`}
                        className={cn(
                            'max-w-[85%] rounded-lg p-2.5 text-xs leading-relaxed',
                            msg.role === 'user'
                                ? 'bg-primary-600/80 ml-auto rounded-tr-sm text-white'
                                : 'bg-secondary-700/50 text-secondary-200 rounded-tl-sm'
                        )}
                    >
                        {msg.role === 'user' ? (
                            msg.content
                        ) : (
                            <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                                {msg.content}
                            </ReactMarkdown>
                        )}
                    </div>
                ))}

                {/* 로딩 말풍선 */}
                {loadingPhase !== null && (
                    <div className="bg-secondary-700/50 max-w-[85%] rounded-lg rounded-tl-sm p-2.5">
                        <p className="text-secondary-400 text-xs">
                            {LOADING_MESSAGES[loadingPhase]}
                        </p>
                        <span className="text-secondary-500 mt-1 inline-flex gap-0.5 text-base leading-none">
                            <span className="animate-bounce [animation-delay:0ms]">
                                ·
                            </span>
                            <span className="animate-bounce [animation-delay:150ms]">
                                ·
                            </span>
                            <span className="animate-bounce [animation-delay:300ms]">
                                ·
                            </span>
                        </span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="border-secondary-700 border-t px-3 py-2">
                {/* 메타 바 — 모델 드롭다운 + 안내 텍스트 */}
                <div className="text-secondary-600 mb-1.5 flex items-center gap-1.5 text-[10px]">
                    {/* 모델 선택 드롭다운 */}
                    <div className="relative">
                        <button
                            ref={triggerRef}
                            type="button"
                            onClick={handleDropdownToggle}
                            className="bg-secondary-700 hover:bg-secondary-600 text-secondary-400 flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
                            aria-haspopup="listbox"
                            aria-expanded={isOpen}
                            aria-label="AI 모델 선택"
                        >
                            <span>{selectedModelOption.label}</span>
                            <span
                                className={cn(
                                    'transition-transform duration-150',
                                    isOpen && 'rotate-180'
                                )}
                                aria-hidden="true"
                            >
                                ▾
                            </span>
                        </button>

                        {isOpen && (
                            <div
                                ref={dropdownRef}
                                role="listbox"
                                aria-label="AI 모델 목록"
                                className={cn(
                                    'border-secondary-600 bg-secondary-800 absolute left-0 z-10 min-w-[160px] overflow-hidden rounded-lg border shadow-lg',
                                    opensUpward
                                        ? 'bottom-full mb-1'
                                        : 'top-full mt-1'
                                )}
                            >
                                {CHAT_MODEL_OPTIONS.map(option => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        role="option"
                                        aria-selected={
                                            selectedModel === option.id
                                        }
                                        onClick={() => {
                                            setSelectedModel(option.id);
                                            close();
                                        }}
                                        className={cn(
                                            'flex min-h-[44px] w-full items-center gap-2 px-3 text-left transition-colors',
                                            selectedModel === option.id
                                                ? 'text-primary-300 bg-primary-900/20'
                                                : 'text-secondary-300 hover:bg-secondary-700'
                                        )}
                                    >
                                        <span className="w-3 text-[10px]">
                                            {selectedModel === option.id &&
                                                '✓'}
                                        </span>
                                        <div>
                                            <div className="text-[11px] font-medium">
                                                {option.label}
                                            </div>
                                            <div className="text-secondary-500 text-[10px]">
                                                {option.fullName}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <span>·</span>
                    <span>분석 범위 내 질문만 가능</span>
                    {remainingTokens !== null && (
                        <>
                            <span>·</span>
                            <span>오늘 {remainingTokens}회 남음</span>
                        </>
                    )}
                </div>

                {/* 입력창 + 전송 버튼 */}
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isInputDisabled}
                        placeholder={placeholder}
                        rows={2}
                        className={cn(
                            'border-secondary-600 bg-secondary-800 text-secondary-200 placeholder:text-secondary-600 min-h-[52px] flex-1 resize-none rounded-lg border px-3 py-1.5 text-xs leading-relaxed transition-colors outline-none',
                            'focus:border-primary-500',
                            isInputDisabled && 'cursor-not-allowed opacity-50'
                        )}
                    />
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={isInputDisabled || inputValue.trim() === ''}
                        className="bg-primary-600 hover:bg-primary-500 disabled:bg-secondary-700 disabled:text-secondary-500 focus-visible:ring-primary-500 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed"
                        aria-label="전송"
                    >
                        ↑
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: lint 확인**

```bash
yarn lint
```

Expected: 에러 없음

- [ ] **Step 3: 전체 테스트 통과 확인**

```bash
yarn test --no-coverage
```

Expected: 전체 PASS

- [ ] **Step 4: 커밋**

```bash
git add src/components/chat/ChatPanel.tsx
git commit -m "feat: ChatPanel — 모델 선택 드롭다운 추가, Textarea 2줄 확장"
```

---

## 완료 체크리스트

- [ ] `domain/constants/chatModels.ts` 생성 — 모델 상수 2개
- [ ] `domain/types.ts` — `ChatModel` 타입 + `server_busy` 에러코드
- [ ] `chatAction.ts` — `model` 파라미터 + `isServerBusyError(503)` 분기
- [ ] `chatAction.test.ts` — 503 테스트 + model 전달 테스트 통과
- [ ] `useChat.ts` — `selectedModel` 상태 + `server_busy` 메시지
- [ ] `ChatPanel.tsx` — 드롭다운 UI + 헤더 모델칩 제거 + `rows={2}`
- [ ] `yarn lint` 최종 통과
- [ ] `yarn test --no-coverage` 전체 통과
