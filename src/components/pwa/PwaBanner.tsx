'use client';

import { useEffect } from 'react';
import { usePwaInstall } from '@/components/pwa/hooks/usePwaInstall';
import { IosInstallModal } from '@/components/pwa/IosInstallModal';
import { cn } from '@/lib/cn';

// Pattern A (CLS prevention): always render a fixed-height shell so
// the layout below does not shift when the 30s fallback timer or the
// `pwa-trigger` event flips `showBanner` from false → true.
// Hidden state uses `aria-hidden` + `invisible` to keep height while
// removing the banner from the accessibility tree and pointer events.
//
// PWA_BANNER_HEIGHT_CSS와 BANNER_SHELL_CLASS의 h-12는 동일한 값(3rem)을 다른 형태로
// 표현한 것이다. /[symbol] 라우트의 sticky-footer jail이 `--pwa-banner-h` CSS variable을
// 통해 banner 높이를 차감하므로, banner shell의 height 클래스를 바꿀 때는 반드시
// PWA_BANNER_HEIGHT_CSS도 함께 갱신해야 한다.
const BANNER_SHELL_CLASS =
    'border-secondary-700 bg-secondary-800 flex h-12 items-center gap-2 border-b px-3';
const PWA_BANNER_HEIGHT_CSS = '3rem';

export function PwaBanner() {
    const {
        showBanner,
        showIosModal,
        isIos,
        handleInstall,
        handleDismiss,
        handleModalClose,
    } = usePwaInstall();

    // Banner가 보일 때 root에 --pwa-banner-h를 3rem(=h-12)으로 set한다.
    // /[symbol] 라우트의 sticky-footer jail이 `calc(100dvh - 3.5rem - var(--pwa-banner-h, 0px))`로
    // chrome 높이를 차감하므로, banner 토글이 jail viewport-fill과 일관되게 동작한다.
    useEffect(() => {
        const root = document.documentElement;
        if (showBanner) {
            root.style.setProperty('--pwa-banner-h', PWA_BANNER_HEIGHT_CSS);
            return () => {
                root.style.removeProperty('--pwa-banner-h');
            };
        }
        return undefined;
    }, [showBanner]);

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
                    ✕
                </button>
            </div>
            {isIos && showIosModal && (
                <IosInstallModal onClose={handleModalClose} />
            )}
        </>
    );
}
