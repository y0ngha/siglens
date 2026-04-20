'use client';

import {
    startTransition,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import type { AnalysisResponse, Timeframe } from '@/domain/types';
import { ChatPanel } from '@/components/chat/ChatPanel';

const TOOLTIP_SHOWN_KEY = 'siglens:chat-tooltip-shown';

interface FloatingChatButtonProps {
    symbol: string;
    timeframe: Timeframe;
    analysis: AnalysisResponse;
    isAnalysisReady: boolean;
}

export function FloatingChatButton({
    symbol,
    timeframe,
    analysis,
    isAnalysisReady,
}: FloatingChatButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const wasReadyOnMountRef = useRef(isAnalysisReady);

    const handleClose = useCallback(() => setIsOpen(false), []);

    const dismissTooltip = useCallback(() => {
        setShowTooltip(false);
        try {
            localStorage.setItem(TOOLTIP_SHOWN_KEY, '1');
        } catch {
            // ignore quota errors
        }
    }, []);

    const handleButtonClick = useCallback(() => {
        if (showTooltip) dismissTooltip();
        setIsOpen(prev => !prev);
    }, [showTooltip, dismissTooltip]);

    useEffect(() => {
        if (!isAnalysisReady) return;
        // 마운트 시점에 이미 ready였다면 분석이 방금 완료된 게 아님 — 툴팁 미표시
        if (wasReadyOnMountRef.current) return;
        try {
            if (!localStorage.getItem(TOOLTIP_SHOWN_KEY)) {
                startTransition(() => {
                    setShowTooltip(true);
                });
            }
        } catch {
            // ignore
        }
    }, [isAnalysisReady]);

    return (
        <>
            {isOpen && (
                <div className="border-secondary-700 bg-secondary-900 fixed inset-x-2 bottom-18 z-50 overflow-hidden rounded-xl border shadow-2xl md:inset-x-auto md:right-6 md:bottom-20 md:w-95">
                    <ChatPanel
                        symbol={symbol}
                        timeframe={timeframe}
                        analysis={analysis}
                        isAnalysisReady={isAnalysisReady}
                        onClose={handleClose}
                    />
                </div>
            )}
            {showTooltip && !isOpen && (
                <div className="border-secondary-700 bg-secondary-800 fixed right-4 bottom-18 z-50 w-64 rounded-xl border px-4 py-3 shadow-xl md:right-6 md:bottom-22">
                    <button
                        type="button"
                        onClick={dismissTooltip}
                        className="text-secondary-400 hover:text-secondary-200 absolute top-2 right-2 flex h-5 w-5 items-center justify-center text-xs transition-colors"
                        aria-label="툴팁 닫기"
                    >
                        ✕
                    </button>
                    <p className="text-secondary-100 pr-4 text-sm leading-relaxed">
                        AI 분석이 완료되었어요.
                        <br />
                        분석 내용에 궁금하신 게 있다면 언제든 저에게
                        말씀해주세요.
                    </p>
                </div>
            )}
            <button
                type="button"
                onClick={handleButtonClick}
                className="bg-primary-600 hover:bg-primary-500 fixed right-4 bottom-3 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-colors md:right-6 md:bottom-6"
                aria-label={isOpen ? 'AI 채팅 닫기' : 'AI 채팅 열기'}
                aria-expanded={isOpen}
            >
                <span className="text-base leading-none">
                    {isOpen ? '✕' : '💬'}
                </span>
            </button>
        </>
    );
}
