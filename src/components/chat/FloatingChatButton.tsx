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
                <div className="border-secondary-700 bg-secondary-900 fixed right-6 bottom-20 z-40 hidden w-[380px] overflow-hidden rounded-xl border shadow-2xl md:block">
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
                className="bg-primary-600 hover:bg-primary-500 fixed right-6 bottom-6 z-40 hidden h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-colors md:flex"
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
