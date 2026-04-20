'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import type { AnalysisResponse, Timeframe } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useChat } from '@/components/chat/hooks/useChat';
import { useChatInput } from '@/components/chat/hooks/useChatInput';

const CHAT_MODEL_DISPLAY_NAME = 'Gemini 2.5 Flash';

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
                <div className="flex items-center gap-2">
                    <span className="bg-secondary-700 text-secondary-400 rounded px-1.5 py-0.5 text-[10px]">
                        {CHAT_MODEL_DISPLAY_NAME}
                    </span>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-secondary-500 hover:text-secondary-300 text-sm leading-none transition-colors"
                            aria-label="채팅 닫기"
                        >
                            ✕
                        </button>
                    )}
                </div>
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
                        className="text-primary-400 hover:text-primary-200 ml-2 text-xs"
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
                <div className="text-secondary-600 mb-1.5 flex items-center gap-1.5 text-[10px]">
                    <span className="bg-secondary-700 rounded px-1 py-0.5">
                        {CHAT_MODEL_DISPLAY_NAME}
                    </span>
                    <span>·</span>
                    <span>분석 범위 내 질문만 가능</span>
                    {remainingTokens !== null && (
                        <>
                            <span>·</span>
                            <span>오늘 {remainingTokens}회 남음</span>
                        </>
                    )}
                </div>
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isInputDisabled}
                        placeholder={placeholder}
                        rows={1}
                        className={cn(
                            'border-secondary-600 bg-secondary-800 text-secondary-200 placeholder:text-secondary-600 min-h-[32px] flex-1 resize-none rounded-lg border px-3 py-1.5 text-xs leading-relaxed transition-colors outline-none',
                            'focus:border-primary-500',
                            isInputDisabled && 'cursor-not-allowed opacity-50'
                        )}
                    />
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={isInputDisabled || inputValue.trim() === ''}
                        className="bg-primary-600 hover:bg-primary-500 disabled:bg-secondary-700 disabled:text-secondary-500 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors disabled:cursor-not-allowed"
                        aria-label="전송"
                    >
                        ↑
                    </button>
                </div>
            </div>
        </div>
    );
}
