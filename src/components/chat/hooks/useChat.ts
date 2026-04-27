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
} from '@/domain/constants/chatModels';
import type {
    AnalysisResponse,
    ChatErrorCode,
    ChatLoadingPhase,
    ChatMessage,
    ChatModel,
    Timeframe,
} from '@y0ngha/siglens-core';
import { chatAction } from '@/infrastructure/chat/chatAction';
import { getRemainingTokensAction } from '@/infrastructure/chat/getRemainingTokensAction';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    startTransition,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

// 분석 중 단계의 최소 표시 시간 (UX: 즉시 사라지면 깜빡이는 것처럼 보임)
const ANALYZING_PHASE_MIN_DURATION_MS = 1500;
const MODEL_STORAGE_KEY = 'siglens_chat_model';

// Matches CHAT_TOKEN_LIMIT in infrastructure/chat/tokenStore.ts
// Hook files may not import from infrastructure — duplicate value with link
const DAILY_CHAT_LIMIT = 5;

const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
    token_exhausted: `오늘 무료 질문 ${DAILY_CHAT_LIMIT}회를 모두 사용했어요. 내일 다시 이용해주세요.`,
    rate_limited: 'AI 서버가 잠시 바빠요. 잠시 후 다시 시도해주세요.',
    server_busy:
        'AI 서버가 지금 바빠요. 다른 모델로 변경 후 다시 시도해주세요.',
    server_error: '일시적인 오류가 발생했어요. 다시 시도해주세요.',
};

export interface UseChatOptions {
    symbol: string;
    timeframe: Timeframe;
    analysis: AnalysisResponse;
    isAnalysisReady: boolean;
}

export interface UseChatReturn {
    messages: ChatMessage[];
    loadingPhase: ChatLoadingPhase | null;
    analysisUpdated: boolean;
    remainingTokens: number | null;
    sendMessage: (text: string) => Promise<void>;
    dismissAnalysisUpdated: () => void;
    selectedModel: ChatModel;
    handleModelChange: (model: ChatModel) => void;
}

export function useChat({
    symbol,
    timeframe,
    analysis,
    isAnalysisReady,
}: UseChatOptions): UseChatReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingPhase, setLoadingPhase] = useState<ChatLoadingPhase | null>(
        null
    );
    const [analysisUpdated, setAnalysisUpdated] = useState(false);
    const [selectedModel, setSelectedModel] = useState<ChatModel>(
        GEMINI_2_5_FLASH_MODEL
    );

    const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // null on first render — treated as "not yet compared" to prevent false banner on mount
    const prevAnalysisRef = useRef<AnalysisResponse | null>(null);
    // null on mount — used to skip the initial effect run in the key-change effect
    const prevKeyRef = useRef<string | null>(null);
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
        queryKey: ['chat', 'remaining-tokens'],
        queryFn: getRemainingTokensAction,
        staleTime: 0,
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
                selectedModel
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
            const aiContent = result.ok
                ? result.message
                : (ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.server_error);
            const aiMessage: ChatMessage = {
                role: 'model',
                content: aiContent,
            };
            setMessages(prev => [...prev, aiMessage]);
            if (result.ok) {
                queryClient.setQueryData(
                    ['chat', 'remaining-tokens'],
                    result.remainingTokens
                );
            }
        },
        onError: () => {
            setMessages(prev => [
                ...prev,
                { role: 'model', content: ERROR_MESSAGES.server_error },
            ]);
        },
    });

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
            await mutateAsync({ currentMessages: messagesRef.current, text });
        },
        [isAnalysisReady, mutateAsync]
    );

    const dismissAnalysisUpdated = useCallback(() => {
        setAnalysisUpdated(false);
    }, []);

    const handleModelChange = useCallback((model: ChatModel) => {
        setSelectedModel(model);
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
            // VALID_CHAT_MODELS.some narrows stored to a known ChatModel literal; cast is safe
            if (stored !== null && VALID_CHAT_MODELS.some(m => m === stored)) {
                startTransition(() => {
                    setSelectedModel(
                        stored as (typeof VALID_CHAT_MODELS)[number]
                    );
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

    // messages 변경 시 localStorage 동기화
    // — 첫 실행(messages=[])은 스킵, storageKey 변경 직후 낡은 messages 저장 방지
    useEffect(() => {
        if (!didSaveMountRef.current) {
            didSaveMountRef.current = true;
            return;
        }
        if (isKeyChangePendingRef.current) {
            isKeyChangePendingRef.current = false;
            return;
        }
        saveSession(storageKey, messages);
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
    };
}
