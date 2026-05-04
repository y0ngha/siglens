'use client';

import { usePwaInstall } from '@/components/pwa/hooks/usePwaInstall';
import { IosInstallModal } from '@/components/pwa/IosInstallModal';
import { cn } from '@/lib/cn';

// Pattern A (CLS prevention): always render a fixed-height shell so
// the layout below does not shift when the 30s fallback timer or the
// `pwa-trigger` event flips `showBanner` from false → true.
// Hidden state uses `aria-hidden` + `invisible` to keep height while
// removing the banner from the accessibility tree and pointer events.
const BANNER_SHELL_CLASS =
    'border-secondary-700 bg-secondary-800 flex h-12 items-center gap-2 border-b px-3';

export function PwaBanner() {
    const {
        showBanner,
        showIosModal,
        isIos,
        handleInstall,
        handleDismiss,
        handleModalClose,
    } = usePwaInstall();

    if (!showBanner) {
        return null;
    }

    return (
        <>
            <div
                data-testid="pwa-banner-shell"
                aria-hidden={!showBanner}
                className={cn(
                    BANNER_SHELL_CLASS,
                    !showBanner && 'pointer-events-none invisible'
                )}
            >
                <span className="text-base" aria-hidden="true">
                    📈
                </span>
                <span className="text-secondary-200 min-w-0 flex-1 truncate text-xs">
                    앱으로 설치하면 더 빠르게 접속할 수 있어요
                </span>
                <button
                    type="button"
                    onClick={handleInstall}
                    tabIndex={showBanner ? 0 : -1}
                    className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white transition-colors focus-visible:ring-1 focus-visible:outline-none"
                >
                    설치하기
                </button>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="배너 닫기"
                    tabIndex={showBanner ? 0 : -1}
                    className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-primary-500 shrink-0 text-lg leading-none transition-colors focus-visible:ring-1 focus-visible:outline-none"
                >
                    ×
                </button>
            </div>
            {isIos && showIosModal && (
                <IosInstallModal onClose={handleModalClose} />
            )}
        </>
    );
}
