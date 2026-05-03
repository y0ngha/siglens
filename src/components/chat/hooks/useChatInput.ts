'use client';

import type { ChatLoadingPhase } from '@y0ngha/siglens-core';
import type { DisplayMessage } from '@/components/chat/hooks/useChat';
import {
    type KeyboardEvent,
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

interface UseChatInputOptions {
    messages: readonly DisplayMessage[];
    loadingPhase: ChatLoadingPhase | null;
    isAnalysisReady: boolean;
    sendMessage: (text: string) => Promise<void>;
}

interface UseChatInputReturn {
    inputValue: string;
    setInputValue: (value: string) => void;
    isInputDisabled: boolean;
    inputRef: RefObject<HTMLTextAreaElement | null>;
    messagesEndRef: RefObject<HTMLDivElement | null>;
    handleSubmit: () => Promise<void>;
    handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function useChatInput({
    messages,
    loadingPhase,
    isAnalysisReady,
    sendMessage,
}: UseChatInputOptions): UseChatInputReturn {
    const [inputValue, setInputValue] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const isInputDisabled = loadingPhase !== null || !isAnalysisReady;

    const handleSubmit = useCallback(async (): Promise<void> => {
        const text = inputValue.trim();
        if (!text || loadingPhase !== null || !isAnalysisReady) return;
        setInputValue('');
        await sendMessage(text);
        inputRef.current?.focus();
    }, [inputValue, loadingPhase, isAnalysisReady, sendMessage]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>): void => {
            if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
            ) {
                e.preventDefault();
                void handleSubmit();
            }
        },
        [handleSubmit]
    );

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loadingPhase]);

    return {
        inputValue,
        setInputValue,
        isInputDisabled,
        inputRef,
        messagesEndRef,
        handleSubmit,
        handleKeyDown,
    };
}
