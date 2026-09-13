'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';

const MAX = 4_000;
/** The counter stays hidden until the message is long enough that the cap is a real concern. */
const COUNTER_VISIBLE_FROM = MAX * 0.8;

interface Props {
    readonly disabled: boolean;
    readonly streaming: boolean;
    readonly remainingTurns: number | null;
    readonly onSend: (text: string) => void;
    readonly onStop: () => void;
    /** Prefilled text (an entry link's `?q=`); the user still presses send. */
    readonly initialValue?: string;
}

/** 44px hit target that sits flush inside the surface; both actions share it so the box never jumps when a turn starts or stops. */
const ACTION_BUTTON =
    'flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

function SendIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M10 16V4" />
            <path d="M5 9l5-5 5 5" />
        </svg>
    );
}

function StopIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-4"
            fill="currentColor"
        >
            <rect x="4" y="4" width="12" height="12" rx="2" />
        </svg>
    );
}

/**
 * One surface holds the textarea and the action button (send while idle,
 * stop while streaming) — the chat-product grammar users already know. The
 * surface, not the textarea, carries the focus ring so the ring wraps the
 * whole control instead of drawing a box inside a box.
 */
export function Composer({
    disabled,
    streaming,
    remainingTurns,
    onSend,
    onStop,
    initialValue = '',
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const [text, setText] = useState(initialValue.slice(0, MAX));
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const overLimit = text.length > MAX;
    const canSend =
        !disabled && !streaming && text.trim().length > 0 && !overLimit;
    const submit = (): void => {
        if (!canSend) return;
        onSend(text.trim());
        setText('');
        const el = textareaRef.current;
        if (el) {
            // Collapse the grown box back to one row and keep the caret here so
            // the user can keep typing while the reply streams in.
            el.style.height = 'auto';
            el.focus();
        }
    };
    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };
    return (
        // The fade lets the transcript scroll under the composer instead of
        // being cut by a hard edge.
        <div className="sticky bottom-0 bg-gradient-to-t from-secondary-900 from-70% to-transparent px-4 pt-6 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <div
                className={cn(
                    'mx-auto flex w-full max-w-3xl items-end gap-1 rounded-lg border border-border-control bg-secondary-800 p-1.5 shadow-lg shadow-secondary-950/40',
                    'focus-within:ring-2 focus-within:ring-primary-500',
                    overLimit && 'border-ui-danger'
                )}
            >
                <textarea
                    ref={textareaRef}
                    name="message"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    disabled={disabled}
                    autoComplete="off"
                    enterKeyHint="send"
                    aria-label={t('Composer.fdad68')}
                    aria-invalid={overLimit || undefined}
                    placeholder={t('Composer.placeholder')}
                    className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[15px] leading-6 text-secondary-100 placeholder:text-secondary-400 focus-visible:outline-none"
                    onInput={e => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                    }}
                />
                {streaming ? (
                    <button
                        type="button"
                        onClick={onStop}
                        aria-label={t('Composer.d2e7e7')}
                        className={cn(
                            ACTION_BUTTON,
                            'border border-border-control text-secondary-100 hover:bg-secondary-700'
                        )}
                    >
                        <StopIcon />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSend}
                        aria-label={t('Composer.4077ce')}
                        className={cn(
                            ACTION_BUTTON,
                            canSend
                                ? 'bg-primary-600 text-white hover:bg-primary-500'
                                : 'bg-secondary-700 text-secondary-400'
                        )}
                    >
                        <SendIcon />
                    </button>
                )}
            </div>
            <p className="mx-auto mt-1.5 flex w-full max-w-3xl items-baseline justify-between gap-3 text-xs text-secondary-400">
                <span className="truncate">
                    {overLimit ? (
                        <span className="text-ui-danger-text">
                            {t('Composer.tooLong', {
                                len: text.length.toLocaleString(),
                                max: MAX.toLocaleString(),
                            })}
                        </span>
                    ) : text.length >= COUNTER_VISIBLE_FROM ? (
                        <span className="tabular-nums">
                            {t('Composer.charCount', {
                                len: text.length.toLocaleString(),
                                max: MAX.toLocaleString(),
                            })}
                        </span>
                    ) : (
                        <span className="hidden sm:inline">
                            {t('Composer.keyHint')}
                        </span>
                    )}
                </span>
                <span className="shrink-0 text-right">
                    {remainingTurns !== null
                        ? t('Composer.remainingTurns', { n: remainingTurns })
                        : ''}
                    {t('Composer.betaNotice')}
                </span>
            </p>
        </div>
    );
}
