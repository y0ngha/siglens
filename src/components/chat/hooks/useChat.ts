'use client';

import {
    useState,
    useEffect,
    useLayoutEffect,
    useRef,
    useCallback,
    useMemo,
    startTransition,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AnalysisResponse, Timeframe } from '@/domain/types';
import type {
    ChatMessage,
    ChatErrorCode,
    ChatLoadingPhase,
} from '@/domain/types';
import { chatAction } from '@/infrastructure/chat/chatAction';
import {
    buildStorageKey,
    loadSession,
    saveSession,
} from '@/components/chat/utils/chatStorage';

// 분석 중 단계의 최소 표시 시간 (UX: 즉시 사라지면 깜빡이는 것처럼 보임)
const ANALYZING_PHASE_MIN_DURATION_MS = 1500;

const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
    // '5' matches CHAT_TOKEN_LIMIT in infrastructure/chat/tokenStore.ts
    token_exhausted:
        '오늘 무료 질문 5회를 모두 사용했어요. 내일 다시 이용하거나 유료 플랜을 이용해보세요.',
    rate_limited: 'AI 서버가 잠시 바빠요. 잠시 후 다시 시도해주세요.',
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
    sendMessage: (text: string) => Promise<void>;
    dismissAnalysisUpdated: () => void;
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

    const { mutateAsync } = useMutation({
        mutationFn: ({
            currentMessages,
            text,
        }: {
            currentMessages: ChatMessage[];
            text: string;
        }) => chatAction(symbol, timeframe, analysis, currentMessages, text),
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

    // Sync latest-value refs after commit (useLayoutEffect is safe in concurrent React;
    // inline render assignments can be stale under interrupted/discarded renders)
    useLayoutEffect(() => {
        messagesRef.current = messages;
        loadingPhaseRef.current = loadingPhase;
    });

    // 하이드레이션 후 localStorage 로드 (SSR/client mismatch 방지 — 마운트 1회만 실행)
    useEffect(() => {
        startTransition(() => {
            setMessages(loadSession(initialStorageKeyRef.current));
        });
    }, []);

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

    // 재분석으로 analysis 객체가 교체됐고 기존 대화가 있으면 배너 표시
    useEffect(() => {
        const prev = prevAnalysisRef.current;
        prevAnalysisRef.current = analysis;
        if (
            prev !== null &&
            prev !== analysis &&
            messagesRef.current.length > 0 &&
            isAnalysisReady
        ) {
            startTransition(() => {
                setAnalysisUpdated(true);
            });
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
        sendMessage,
        dismissAnalysisUpdated,
    };
}
