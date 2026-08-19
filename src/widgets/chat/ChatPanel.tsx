'use client';

import { useTranslations } from 'next-intl';
import { ContextSwitchSystemMessage } from './ContextSwitchSystemMessage';
import { ModelSelect, type ModelOption } from './ModelSelect';
import { useChat } from './hooks/useChat';
import { useChatInput } from './hooks/useChatInput';
import { useSymbolChat } from '@/features/symbol-chat';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { PremiumModelGateModal } from '@/features/premium-gate';
import { cn } from '@/shared/lib/cn';
import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { VALID_CHAT_MODELS } from '@y0ngha/siglens-core';

const CHAT_MODEL_OPTIONS: readonly ModelOption[] = VALID_CHAT_MODELS.map(
    id => ({ id, ...getModelDisplay(id) })
);

const LOADING_MESSAGES = {
    analyzing: '질문 내용을 살펴보고 있어요...',
    generating: '답변을 작성하고 있어요...',
} as const;

interface ChatPanelProps {
    symbol: string;
    onClose?: () => void;
}

export function ChatPanel({ symbol, onClose }: ChatPanelProps) {
    const t = useTranslations('widgets.chat');
    const { isAnalysisReady } = useSymbolChat();

    const {
        messages,
        loadingPhase,
        analysisUpdated,
        remainingTokens,
        sendMessage,
        dismissAnalysisUpdated,
        selectedModel,
        isModelHydrated,
        handleModelChange,
        gateModal,
        dismissGate,
    } = useChat({ symbol });

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
        ? t('ChatPanel.0b63e2')
        : t('ChatPanel.408331');

    return (
        <div className="flex flex-col overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-secondary-700 px-3 py-2">
                <span className="text-xs font-semibold text-secondary-300">
                    {t('ChatPanel.50071e')}
                </span>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="-mr-1 flex h-11 w-11 items-center justify-center rounded text-sm leading-none text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none md:h-6 md:w-6"
                        aria-label={t('ChatPanel.f4ca4c')}
                    >
                        ✕
                    </button>
                )}
            </div>

            {analysisUpdated && (
                <div
                    className="flex items-center justify-between border-b border-primary-700/50 bg-primary-900/30 px-3 py-1.5"
                    role="status"
                    aria-live="polite"
                >
                    <span className="text-xs text-primary-300">
                        {t('ChatPanel.d7fb24')}
                    </span>
                    <button
                        type="button"
                        onClick={dismissAnalysisUpdated}
                        aria-label={t('ChatPanel.1dbde9')}
                        className="ml-2 rounded text-xs text-primary-400 hover:text-primary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 메시지 영역 — 고정 높이, 내부 스크롤 */}
            <div className="flex h-80 flex-col gap-2 overflow-y-auto px-3 py-2">
                {messages.length === 0 && loadingPhase === null && (
                    <div className="rounded-lg rounded-tl-sm bg-secondary-700/30 p-3">
                        <p className="text-sm leading-relaxed text-secondary-400">
                            {t('ChatPanel.f292ff')}
                        </p>
                    </div>
                )}

                {/* uiId는 메시지 생성/복원 시 부여되는 렌더 전용 식별자다(useChat). */}
                {messages.map(msg => {
                    if (msg.role === 'system') {
                        return (
                            <ContextSwitchSystemMessage
                                key={msg.uiId}
                                label={msg.label}
                            />
                        );
                    }

                    return (
                        <div
                            key={msg.uiId}
                            className={cn(
                                'max-w-[85%] rounded-lg p-2.5 text-xs leading-relaxed',
                                msg.role === 'user'
                                    ? 'bg-primary-600/80 self-end rounded-tr-sm text-white'
                                    : 'bg-secondary-700/50 text-secondary-200 self-start rounded-tl-sm'
                            )}
                        >
                            {msg.role === 'user' ? (
                                msg.content
                            ) : (
                                <MarkdownText>{msg.content}</MarkdownText>
                            )}
                        </div>
                    );
                })}

                {loadingPhase !== null && (
                    <div
                        className="max-w-[85%] self-start rounded-lg rounded-tl-sm bg-secondary-700/50 p-2.5"
                        role="status"
                        aria-live="polite"
                    >
                        <p className="text-xs text-secondary-400">
                            {LOADING_MESSAGES[loadingPhase]}
                        </p>
                        <span className="mt-1 inline-flex gap-0.5 text-base leading-none text-secondary-500">
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

            <div className="border-t border-secondary-700 px-3 py-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-secondary-600">
                    <ModelSelect
                        options={CHAT_MODEL_OPTIONS}
                        selected={selectedModel}
                        onChange={handleModelChange}
                        isHydrated={isModelHydrated ?? false}
                    />

                    <span>·</span>
                    <span>{t('ChatPanel.1ca3c2')}</span>
                    {remainingTokens !== null && (
                        <>
                            <span>·</span>
                            <span>
                                {t('ChatPanel.cce9f7', { v0: remainingTokens })}
                            </span>
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
                        enterKeyHint="send"
                        autoCapitalize="sentences"
                        autoCorrect="on"
                        className={cn(
                            'border-secondary-600 bg-secondary-800 text-secondary-200 placeholder:text-secondary-600 min-h-11 flex-1 resize-none rounded-lg border px-3 py-1.5 text-base leading-relaxed transition-colors outline-none md:min-h-8 md:text-xs',
                            'focus:border-primary-500',
                            isInputDisabled && 'cursor-not-allowed opacity-50'
                        )}
                    />
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={isInputDisabled || inputValue.trim() === ''}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-500 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-secondary-700 disabled:text-secondary-500 md:h-8 md:w-8"
                        aria-label={t('ChatPanel.4077ce')}
                    >
                        ↑
                    </button>
                </div>
            </div>

            {gateModal !== null && (
                <PremiumModelGateModal
                    mode={gateModal.mode}
                    providerLabel={LLM_PROVIDER_LABELS[gateModal.provider]}
                    onClose={dismissGate}
                />
            )}
        </div>
    );
}
