'use client';

import { useCallback, useState } from 'react';
import type { AnalysisResponse, Timeframe } from '@/domain/types';
import { ChatPanel } from '@/components/chat/ChatPanel';

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
    const handleClose = useCallback(() => setIsOpen(false), []);

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
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
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
