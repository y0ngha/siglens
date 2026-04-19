import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import type { AnalysisResponse, Timeframe } from '@/domain/types';
import type {
    ChatMessage,
    ChatErrorCode,
    ChatLoadingPhase,
    ChatSession,
} from '@/domain/chat/types';
import { chatAction } from '@/infrastructure/chat/chatAction';

const CHAT_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const LOADING_PHASE_DELAY_MS = 1500;

const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
    token_exhausted:
        '오늘 무료 질문 5회를 모두 사용했어요. 내일 다시 이용하거나 유료 플랜을 이용해보세요.',
    rate_limited: 'AI 서버가 잠시 바빠요. 잠시 후 다시 시도해주세요.',
    server_error: '일시적인 오류가 발생했어요. 다시 시도해주세요.',
};

function buildStorageKey(symbol: string, timeframe: Timeframe): string {
    return `siglens_chat_${symbol.toUpperCase()}_${timeframe}`;
}

function loadSession(key: string): ChatMessage[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const session: ChatSession = JSON.parse(raw);
        if (Date.now() - session.savedAt > CHAT_HISTORY_TTL_MS) {
            localStorage.removeItem(key);
            return [];
        }
        return session.messages;
    } catch {
        return [];
    }
}

function saveSession(key: string, messages: ChatMessage[]): void {
    if (typeof window === 'undefined') return;
    try {
        const session: ChatSession = { messages, savedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(session));
    } catch {
        // 스토리지 용량 초과 등 무시
    }
}

interface UseChatOptions {
    symbol: string;
    timeframe: Timeframe;
    analysis: AnalysisResponse;
    isAnalysisReady: boolean;
}

interface UseChatReturn {
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
    const storageKey = buildStorageKey(symbol, timeframe);
    const [messages, setMessages] = useState<ChatMessage[]>(() =>
        loadSession(storageKey)
    );
    const [loadingPhase, setLoadingPhase] = useState<ChatLoadingPhase | null>(
        null
    );
    const [analysisUpdated, setAnalysisUpdated] = useState(false);

    const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevAnalysisRef = useRef(analysis);
    const prevKeyRef = useRef(storageKey);

    // 심볼·타임프레임 변경 시 히스토리 교체
    useEffect(() => {
        if (prevKeyRef.current === storageKey) return;
        prevKeyRef.current = storageKey;
        const loaded = loadSession(storageKey);
        startTransition(() => {
            setMessages(loaded);
            setAnalysisUpdated(false);
        });
    }, [storageKey]);

    // 재분석으로 analysis 객체가 교체됐고 기존 대화가 있으면 배너 표시
    useEffect(() => {
        if (
            prevAnalysisRef.current !== analysis &&
            messages.length > 0 &&
            isAnalysisReady
        ) {
            startTransition(() => {
                setAnalysisUpdated(true);
            });
        }
        prevAnalysisRef.current = analysis;
    }, [analysis, messages.length, isAnalysisReady]);

    // messages 변경 시 localStorage 동기화
    useEffect(() => {
        saveSession(storageKey, messages);
    }, [messages, storageKey]);

    const sendMessage = useCallback(
        async (text: string): Promise<void> => {
            if (loadingPhase !== null || !isAnalysisReady) return;

            const userMessage: ChatMessage = { role: 'user', content: text };
            const updatedMessages = [...messages, userMessage];
            setMessages(updatedMessages);

            // 로딩 단계 시작
            setLoadingPhase('analyzing');
            phaseTimerRef.current = setTimeout(() => {
                setLoadingPhase('generating');
            }, LOADING_PHASE_DELAY_MS);

            const result = await chatAction(
                symbol,
                timeframe,
                analysis,
                messages, // 신규 userMessage 제외한 히스토리
                text
            );

            if (phaseTimerRef.current !== null) {
                clearTimeout(phaseTimerRef.current);
                phaseTimerRef.current = null;
            }
            setLoadingPhase(null);

            const aiContent: string = result.ok
                ? result.message
                : ERROR_MESSAGES[result.error];

            const aiMessage: ChatMessage = { role: 'model', content: aiContent };
            setMessages(prev => [...prev, aiMessage]);
        },
        [messages, loadingPhase, isAnalysisReady, symbol, timeframe, analysis]
    );

    const dismissAnalysisUpdated = useCallback(() => {
        setAnalysisUpdated(false);
    }, []);

    useEffect(() => {
        return () => {
            if (phaseTimerRef.current !== null) {
                clearTimeout(phaseTimerRef.current);
            }
        };
    }, []);

    return { messages, loadingPhase, analysisUpdated, sendMessage, dismissAnalysisUpdated };
}
