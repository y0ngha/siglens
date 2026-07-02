'use client';

import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { cn } from '@/shared/lib/cn';
import { buildTweetIntentUrl } from '@/shared/lib/share';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon, LinkIcon, XLogoIcon } from './icons';

interface ShareSheetProps {
    shareUrl: string;
    tweetText: string;
    title: string;
    description: string;
    onClose: () => void;
}

const ROW_BASE =
    'flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-secondary-200 hover:bg-secondary-800 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none transition-colors';

/**
 * Desktop popover panel listing share actions.
 * Focus management: first actionable item receives focus on mount; Escape triggers onClose.
 * Click-outside dismissal: pointerdown anywhere outside the panel calls onClose (Spec §9-4).
 *
 * The component is "always-open presentational" — open/close state lives in the parent
 * (ShareButton via usePopoverToggle). ShareSheet only manages internal item focus.
 *
 * NON-modal popover: dismissed via click-outside (useOnClickOutside) + Escape
 * (useEscapeKey). Does NOT use a focus trap — unlike ShareTriggerDialog and
 * SharePreparingModal (which are true modal dialogs) this is an inline popover
 * where users can tab through OS affordances freely. The absence of useFocusTrap
 * is intentional, not an oversight.
 */
export function ShareSheet({
    shareUrl,
    tweetText,
    title,
    description,
    onClose,
}: ShareSheetProps) {
    const { copied, copy } = useCopyToClipboard();
    const [copyFailed, setCopyFailed] = useState(false);
    const firstItemRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Escape key closes the popover.
    useEscapeKey(onClose, true);

    // Click/tap outside the panel closes the popover (Spec §9-4).
    useOnClickOutside([panelRef], onClose, { enabled: true });

    // Focus the first actionable item on mount (a11y: keyboard users land here).
    useEffect(() => {
        firstItemRef.current?.focus();
    }, []);

    async function handleCopy() {
        setCopyFailed(false);
        try {
            await copy(shareUrl);
        } catch {
            setCopyFailed(true);
        }
    }

    const tweetUrl = buildTweetIntentUrl({ text: tweetText, shareUrl });

    return (
        <div
            ref={panelRef}
            className="bg-secondary-900 border-secondary-800 absolute right-0 z-50 mt-2 w-72 rounded-lg border p-2 shadow-2xl"
            role="dialog"
            aria-label={title}
        >
            {/* Accessible live region for copy announcement */}
            <div aria-live="polite" className="sr-only">
                {copied ? '링크를 복사했어요' : ''}
            </div>

            {/* 1. Copy link */}
            <button
                ref={firstItemRef}
                type="button"
                onClick={handleCopy}
                className={cn(ROW_BASE, 'touch-manipulation')}
            >
                {copied ? (
                    <CheckIcon className="text-primary-300 h-5 w-5" />
                ) : (
                    <LinkIcon className="h-5 w-5" />
                )}
                <span>{copied ? '복사됨' : '링크 복사'}</span>
            </button>

            {/* Fallback: selectable readonly input when clipboard API fails */}
            {copyFailed && (
                <div className="px-3 py-2">
                    <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="bg-secondary-800 border-secondary-700 text-secondary-200 w-full rounded border px-2 py-1 text-xs"
                        onClick={e => (e.target as HTMLInputElement).select()}
                        aria-label="공유 링크 (직접 복사)"
                    />
                </div>
            )}

            {/* 2. X share */}
            <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(ROW_BASE, 'touch-manipulation')}
                aria-label="X(트위터)에 공유"
            >
                <XLogoIcon className="h-5 w-5" />
                <span>X에 공유</span>
            </a>

            {/* Screen-reader-only description */}
            <p className="sr-only">{description}</p>
        </div>
    );
}
