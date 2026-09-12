'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';

const MAX = 4_000;

interface Props {
    readonly disabled: boolean;
    readonly streaming: boolean;
    readonly remainingTurns: number | null;
    readonly onSend: (text: string) => void;
    readonly onStop: () => void;
}

export function Composer({
    disabled,
    streaming,
    remainingTurns,
    onSend,
    onStop,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const canSend =
        !disabled && !streaming && text.trim().length > 0 && text.length <= MAX;
    const submit = (): void => {
        if (!canSend) return;
        onSend(text.trim());
        setText('');
        // Focus stays on the composer after send so the user can keep typing
        // without reaching for the mouse while the reply streams in.
        textareaRef.current?.focus();
    };
    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };
    return (
        <div className="border-control sticky bottom-0 border-t bg-secondary-900 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    disabled={disabled}
                    aria-label={t('Composer.fdad68')}
                    placeholder={t('Composer.0aef61')}
                    className="border-control max-h-40 min-h-11 flex-1 resize-none rounded-lg border bg-secondary-800 px-3 py-2 text-sm text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500"
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
                        className="border-control rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                        {t('Composer.d2e7e7')}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSend}
                        className={cn(
                            'rounded-lg bg-primary-500 px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-primary-500',
                            !canSend && 'bg-secondary-700 text-secondary-400'
                        )}
                    >
                        {t('Composer.4077ce')}
                    </button>
                )}
            </div>
            <p className="mx-auto mt-1 flex w-full max-w-3xl justify-between text-xs text-secondary-400">
                <span>
                    {text.length > MAX
                        ? t('Composer.tooLong', {
                              len: text.length.toLocaleString(),
                              max: MAX.toLocaleString(),
                          })
                        : t('Composer.charCount', {
                              len: text.length.toLocaleString(),
                              max: MAX.toLocaleString(),
                          })}
                </span>
                <span>
                    {remainingTurns !== null
                        ? t('Composer.remainingTurns', { n: remainingTurns })
                        : ''}
                    {t('Composer.b21dfd')}
                </span>
            </p>
        </div>
    );
}
