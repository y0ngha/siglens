'use client';

import {
    buildStorageKey,
    loadSession,
    loadSessionFull,
    saveSession,
} from '@/components/chat/utils/chatStorage';
import {
    GEMINI_2_5_FLASH_MODEL,
    VALID_CHAT_MODELS,
    getProviderForModel,
    type AnalysisResponse,
    type ChatActionResult,
    type ChatErrorCode,
    type ChatLoadingPhase,
    type ChatMessage,
    type CurrentAnalysisContext,
    type ModelId,
    type Timeframe,
    type LlmProvider,
} from '@y0ngha/siglens-core';
import { isFreeChatModel } from '@/domain/llm';
import type {
    ContextSwitchMessage,
    DisplayMessage,
    GateMode,
} from '@/domain/types';
import { chatAction } from '@/infrastructure/chat/chatAction';
import { getRemainingTokensAction } from '@/infrastructure/chat/getRemainingTokensAction';
import { currentUserAction } from '@/infrastructure/auth/currentUserAction';
import { getRegisteredProvidersAction } from '@/infrastructure/llm/getRegisteredProvidersAction';
import { MS_PER_MINUTE } from '@/domain/constants/time';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { usePageContextLabel } from '@/components/chat/hooks/usePageContextLabel';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    startTransition,
    useCallback,
    useEffect,
    useEffectEvent,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

// 분석 중 단계의 최소 표시 시간 (UX: 즉시 사라지면 깜빡이는 것처럼 보임)
const ANALYZING_PHASE_MIN_DURATION_MS = 1500;
const CURRENT_USER_STALE_MS = 5 * MS_PER_MINUTE;
const REGISTERED_PROVIDERS_STALE_MS = MS_PER_MINUTE;
const MODEL_STORAGE_KEY = 'siglens_chat_model';

// Matches the siglens-core chat token limit; update only when the core policy changes.
const DAILY_CHAT_LIMIT = 5;

const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
    token_exhausted: `오늘 무료 질문 ${DAILY_CHAT_LIMIT}회를 모두 사용했어요. 내일 다시 이용해주세요.`,
    rate_limited: 'AI 서버가 잠시 바빠요. 잠시 후 다시 시도해주세요.',
    server_busy:
        'AI 서버가 지금 바빠요. 다른 모델로 변경 후 다시 시도해주세요.',
    server_error: '일시적인 오류가 발생했어요. 다시 시도해주세요.',
    model_not_allowed:
        '선택한 모델은 현재 회원 등급에서 사용할 수 없어요. 다른 모델을 선택해주세요.',
    // TODO(byok-adapter): BYOK 어댑터 구현 후 chatAction에서 이 코드가 반환됩니다
    user_api_key_required:
        '이 모델은 본인 API 키가 필요해요. 키를 등록하면 사용할 수 있어요.',
};

function isValidChatModel(value: string): value is ModelId {
    return VALID_CHAT_MODELS.some(model => model === value);
}

function isChatMessage(m: DisplayMessage): m is ChatMessage {
    return m.role !== 'system';
}

function resolveAiContent(result: ChatActionResult): string {
    if (result.ok) {
        return result.message;
    }

    if (typeof result.error === 'string') {
        return ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.server_error;
    }

    return result.error.message;
}

export interface UseChatOptions {
    symbol: string;
    timeframe: Timeframe;
    /**
     * Chart's technical AnalysisResponse. Required because core's
     * `buildChatPrompt` mandates an `analysis` parameter and unconditionally
     * embeds it as the primary "=== ANALYSIS DATA ===" block in the system
     * prompt. On non-chart pages the caller passes
     * `CHAT_NON_CHART_BASELINE_ANALYSIS` (a stub whose `summary` redirects the
     * LLM to the `## Current analysis context` section), while
     * `currentAnalysisContext` carries the actual page payload.
     */
    analysis: AnalysisResponse;
    /**
     * Tagged union describing the analysis result on the user's current page
     * (technical / fundamental / news / overall). Forwarded as-is to core's
     * optional `currentAnalysisContext` so the system prompt receives a
     * `## Current analysis context` block with the matching live numbers.
     * `null` when no page-level analysis is yet available.
     */
    currentAnalysisContext: CurrentAnalysisContext | null;
    isAnalysisReady: boolean;
}

export interface GateModalState {
    mode: GateMode;
    provider: LlmProvider;
}

export interface UseChatReturn {
    /** Full display history including UI-only system messages. */
    messages: DisplayMessage[];
    loadingPhase: ChatLoadingPhase | null;
    analysisUpdated: boolean;
    remainingTokens: number | null;
    sendMessage: (text: string) => Promise<void>;
    dismissAnalysisUpdated: () => void;
    selectedModel: ModelId;
    handleModelChange: (model: ModelId) => void;
    gateModal: GateModalState | null;
    dismissGate: () => void;
}

export function useChat({
    symbol,
    timeframe,
    analysis,
    currentAnalysisContext,
    isAnalysisReady,
}: UseChatOptions): UseChatReturn {
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [loadingPhase, setLoadingPhase] = useState<ChatLoadingPhase | null>(
        null
    );
    const [analysisUpdated, setAnalysisUpdated] = useState(false);
    const [selectedModel, setSelectedModel] = useState<ModelId>(
        GEMINI_2_5_FLASH_MODEL
    );
    const [gateModal, setGateModal] = useState<GateModalState | null>(null);

    const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // null on first render — treated as "not yet compared" to prevent false banner on mount
    const prevAnalysisRef = useRef<AnalysisResponse | null>(null);
    // null on mount — used to skip the initial effect run in the key-change effect
    const prevKeyRef = useRef<string | null>(null);
    // null on mount — used to skip emitting a context-switch system message on initial render.
    // KNOWN LIMITATION (Task 5 → follow-up / Task 6 domain):
    //   This ref only tracks transitions while `useChat` is mounted. `useChat` lives inside
    //   `ChatPanel`, which is mounted only when the panel is open (isOpen=true). If the user
    //   navigates between symbol pages while the chat panel is closed, `useChat` is unmounted
    //   for the entire transition; on next open `previousLabelRef` is null again and the
    //   first-mount guard suppresses the context-switch system message that would have
    //   announced the symbol/timeframe change. The transition message is silently lost.
    //   This is still strictly better than the pre-PR-413 behavior (where `useChat` was
    //   remounted on every navigation regardless of panel state). A proper fix likely
    //   requires hoisting context-switch detection above ChatPanel — see Task 6.
    const previousLabelRef = useRef<string | null>(null);
    // latest-value refs: let sendMessage read current values without being in its dep array
    const messagesRef = useRef(messages);
    const loadingPhaseRef = useRef(loadingPhase);
    // mount guard: save effect skips first run (messages = []) then sets true
    const didSaveMountRef = useRef(false);
    // storageKey captured at mount — mount effect reads this ref so deps array stays []
    const initialStorageKeyRef = useRef(buildStorageKey(symbol, timeframe));
    // storageKey just changed but messages haven't updated yet — skip that save cycle
    const isKeyChangePendingRef = useRef(false);
    // current storageKey ref — lets analysis effect read latest key without deps array entry
    const storageKeyRef = useRef(buildStorageKey(symbol, timeframe));
    // true until isAnalysisReady first becomes true — distinguishes page-refresh from re-analysis
    const isFirstAnalysisReadyRef = useRef(true);

    const queryClient = useQueryClient();
    const { data: remainingTokensData } = useQuery({
        queryKey: QUERY_KEYS.remainingTokens(),
        queryFn: getRemainingTokensAction,
        staleTime: 0,
    });

    const { data: currentUser } = useQuery({
        queryKey: QUERY_KEYS.currentUser(),
        queryFn: currentUserAction,
        staleTime: CURRENT_USER_STALE_MS,
    });

    const { data: registeredProviders = [] } = useQuery({
        queryKey: QUERY_KEYS.registeredProviders(),
        queryFn: getRegisteredProvidersAction,
        staleTime: REGISTERED_PROVIDERS_STALE_MS,
    });

    const { mutateAsync } = useMutation({
        mutationFn: ({
            currentMessages,
            text,
        }: {
            currentMessages: ChatMessage[];
            text: string;
        }) =>
            chatAction(
                symbol,
                timeframe,
                analysis,
                currentMessages,
                text,
                selectedModel,
                currentAnalysisContext
            ),
        onMutate: ({ currentMessages, text }) => {
            const userMessage: ChatMessage = { role: 'user', content: text };
            setMessages([...currentMessages, userMessage]);
            setLoadingPhase('analyzing');
            phaseTimerRef.current = setTimeout(() => {
                setLoadingPhase('generating');
            }, ANALYZING_PHASE_MIN_DURATION_MS);
        },
        onSettled: () => {
            if (phaseTimerRef.current !== null) {
                clearTimeout(phaseTimerRef.current);
                phaseTimerRef.current = null;
            }
            setLoadingPhase(null);
        },
        onSuccess: result => {
            const aiContent = resolveAiContent(result);
            const aiMessage: ChatMessage = {
                role: 'model',
                content: aiContent,
            };
            setMessages(prev => [...prev, aiMessage]);
            if (result.ok) {
                queryClient.setQueryData(
                    QUERY_KEYS.remainingTokens(),
                    result.remainingTokens
                );
            } else if (result.error === 'user_api_key_required') {
                // TODO(byok-adapter): chatAction이 BYOK 어댑터 구현 후 이 분기가 실행됩니다
                setGateModal({
                    mode: 'byok',
                    provider: getProviderForModel(selectedModel),
                });
            }
        },
        onError: () => {
            setMessages(prev => [
                ...prev,
                { role: 'model', content: ERROR_MESSAGES.server_error },
            ]);
        },
    });

    // 페이지 컨텍스트 라벨은 내부적으로 useMemo를 쓰므로 useMutation 이후, useMemo 그룹과 함께 위치한다.
    const currentLabel = usePageContextLabel();

    const storageKey = useMemo(
        () => buildStorageKey(symbol, timeframe),
        [symbol, timeframe]
    );

    const sendMessage = useCallback(
        async (text: string): Promise<void> => {
            // Guard checked at call time only; the async body runs to completion even if
            // loadingPhase or analysis change mid-flight (stale closure is intentional —
            // in-flight requests use the snapshot captured when the user submitted)
            if (loadingPhaseRef.current !== null || !isAnalysisReady) return;
            // Filter out UI-only system messages before forwarding history to the LLM.
            const llmMessages = messagesRef.current.filter(isChatMessage);
            await mutateAsync({ currentMessages: llmMessages, text });
        },
        [isAnalysisReady, mutateAsync]
    );

    const dismissAnalysisUpdated = useCallback(() => {
        setAnalysisUpdated(false);
    }, []);

    const handleModelChange = useCallback(
        (model: ModelId): void => {
            if (!isFreeChatModel(model)) {
                const requiredProvider = getProviderForModel(model);
                if (!currentUser) {
                    setGateModal({ mode: 'auth', provider: requiredProvider });
                    return;
                }
                if (
                    !registeredProviders.some(
                        p => p.provider === requiredProvider
                    )
                ) {
                    setGateModal({ mode: 'byok', provider: requiredProvider });
                    return;
                }
            }
            setSelectedModel(model);
        },
        [currentUser, registeredProviders]
    );

    const dismissGate = useCallback((): void => {
        setGateModal(null);
    }, []);

    // Sync latest-value refs after commit (useLayoutEffect is safe in concurrent React;
    // inline render assignments can be stale under interrupted/discarded renders)
    useLayoutEffect(() => {
        messagesRef.current = messages;
        loadingPhaseRef.current = loadingPhase;
        storageKeyRef.current = storageKey;
    });

    // 하이드레이션 후 localStorage 로드 (SSR/client mismatch 방지 — 마운트 1회만 실행)
    useEffect(() => {
        const loaded = loadSession(initialStorageKeyRef.current);
        startTransition(() => {
            setMessages(loaded);
        });
    }, []);

    // 하이드레이션 후 저장된 모델 로드 (SSR/client mismatch 방지 — 마운트 1회만 실행)
    // 선언 순서가 write effect보다 앞이어야 저장된 값을 읽을 수 있음
    useEffect(() => {
        try {
            const stored = localStorage.getItem(MODEL_STORAGE_KEY);
            // VALID_CHAT_MODELS comes from siglens-core and is the runtime source of truth.
            if (stored !== null && isValidChatModel(stored)) {
                startTransition(() => {
                    setSelectedModel(stored);
                });
            }
        } catch {
            // 스토리지 접근 불가 시 무시
        }
    }, []);

    // selectedModel 변경 시 localStorage 동기화
    useEffect(() => {
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
        } catch {
            // 스토리지 용량 초과 등 무시
        }
    }, [selectedModel]);

    // 심볼·타임프레임 변경 시 히스토리 교체 (null 체크로 마운트 첫 실행 스킵)
    useEffect(() => {
        if (prevKeyRef.current === null) {
            prevKeyRef.current = storageKey;
            return;
        }
        if (prevKeyRef.current === storageKey) return;
        prevKeyRef.current = storageKey;
        isKeyChangePendingRef.current = true;
        const loaded = loadSession(storageKey);
        startTransition(() => {
            setMessages(loaded);
            setAnalysisUpdated(false);
        });
    }, [storageKey]);

    // 컨텍스트 변경 배너 표시:
    // 분석 완료 시 마지막 채팅 시각(savedAt)과 분석 시각(analyzedAt)을 비교해
    // 분석이 더 최신이고 기존 채팅 내역이 있으면 배너를 표시한다.
    // — 1) 새로고침 후 첫 분석 완료 (page-refresh path)
    // — 2) 페이지 열린 상태에서 재분석으로 analysis 교체된 경우 (live re-analysis path)
    // 비차트 페이지에서는 `analysis`가 모듈 상수(`CHAT_NON_CHART_BASELINE_ANALYSIS`)로
    // 고정되어 `prev !== analysis`가 절대 true가 되지 않으므로 배너는 자연스럽게 비활성.
    useEffect(() => {
        const prev = prevAnalysisRef.current;
        prevAnalysisRef.current = analysis;

        if (!isAnalysisReady) return;
        if (!analysis.analyzedAt) return;
        if (messagesRef.current.length === 0) return;

        const analysisTime = new Date(analysis.analyzedAt).getTime();
        const { savedAt } = loadSessionFull(storageKeyRef.current);
        if (savedAt === null) return;

        if (isFirstAnalysisReadyRef.current) {
            // Page-refresh path: fire once when analysis first becomes ready
            isFirstAnalysisReadyRef.current = false;
            if (analysisTime > savedAt) {
                startTransition(() => setAnalysisUpdated(true));
            }
            return;
        }

        // Live re-analysis path: analysis object itself changed
        if (prev !== null && prev !== analysis && analysisTime > savedAt) {
            startTransition(() => setAnalysisUpdated(true));
        }
    }, [analysis, isAnalysisReady]);

    // 컨텍스트 스위치 system 메시지 삽입은 useEffectEvent로 격리해 effect 본문에서 setState를 직접 호출하지 않는다.
    // LLM 프롬프트에는 포함되지 않음 — sendMessage에서 필터링된다.
    const appendContextSwitch = useEffectEvent((label: string) => {
        const systemMessage: ContextSwitchMessage = {
            role: 'system',
            kind: 'context_switch',
            label,
        };
        startTransition(() => {
            setMessages(msgs => [...msgs, systemMessage]);
        });
    });

    useEffect(() => {
        const prev = previousLabelRef.current;
        previousLabelRef.current = currentLabel;

        // Skip initial mount (prev is null on first render) or when label is unavailable.
        if (prev === null || currentLabel === null) return;
        if (prev === currentLabel) return;

        appendContextSwitch(currentLabel);
    }, [currentLabel]);

    // messages 변경 시 localStorage 동기화
    // — 첫 실행(messages=[])은 스킵, storageKey 변경 직후 낡은 messages 저장 방지
    // — UI-only system messages를 필터링하여 LLM 히스토리만 저장한다
    useEffect(() => {
        if (!didSaveMountRef.current) {
            didSaveMountRef.current = true;
            return;
        }
        if (isKeyChangePendingRef.current) {
            isKeyChangePendingRef.current = false;
            return;
        }
        const persistableMessages = messages.filter(isChatMessage);
        saveSession(storageKey, persistableMessages);
    }, [messages, storageKey]);

    useEffect(() => {
        return () => {
            if (phaseTimerRef.current !== null) {
                clearTimeout(phaseTimerRef.current);
            }
        };
    }, []);

    return {
        messages,
        loadingPhase,
        analysisUpdated,
        remainingTokens: remainingTokensData ?? null,
        sendMessage,
        dismissAnalysisUpdated,
        selectedModel,
        handleModelChange,
        gateModal,
        dismissGate,
    };
}
