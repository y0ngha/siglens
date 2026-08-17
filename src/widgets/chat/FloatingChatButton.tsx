'use client';

import { ChatPanel } from './ChatPanel';
import { useChatButtonState } from './hooks/useChatButtonState';
import { useSymbolChat } from '@/features/symbol-chat';

interface FloatingChatButtonProps {
    symbol: string;
}

export function FloatingChatButton({ symbol }: FloatingChatButtonProps) {
    const { isAnalysisReady } = useSymbolChat();
    const {
        isOpen,
        showTooltip,
        handleClose,
        handleButtonClick,
        dismissTooltip,
    } = useChatButtonState(isAnalysisReady);

    return (
        <>
            {isOpen && (
                <div className="fixed inset-x-2 bottom-18 z-60 rounded-xl border border-secondary-700 bg-secondary-900 shadow-2xl md:inset-x-auto md:right-6 md:bottom-20 md:w-95">
                    <ChatPanel symbol={symbol} onClose={handleClose} />
                </div>
            )}
            {showTooltip && !isOpen && (
                <div className="fixed right-4 bottom-18 z-60 w-64 rounded-xl border border-secondary-700 bg-secondary-800 px-4 py-3 shadow-xl md:right-6 md:bottom-22">
                    <button
                        type="button"
                        onClick={dismissTooltip}
                        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-xs text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                        aria-label="툴팁 닫기"
                    >
                        ✕
                    </button>
                    <p className="pr-4 text-sm leading-relaxed text-secondary-100">
                        분석 내용에 궁금하신 게 있다면 언제든 저에게
                        말씀해주세요.
                    </p>
                </div>
            )}
            <button
                type="button"
                onClick={handleButtonClick}
                className="fixed right-4 bottom-3 z-60 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-colors hover:bg-primary-500 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none md:right-6 md:bottom-6"
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
