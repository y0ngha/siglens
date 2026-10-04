'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { IosInstallModal } from './IosInstallModal';
import { cn } from '@/shared/lib/cn';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

// CLS: 배너는 흐름에 삽입돼 아래를 3rem 민다. 그래도 CLS가 되지 않는 이유는 **첫 사용자
// 입력 직후에만** 나타나기 때문이다 — 입력 500ms 안의 레이아웃 이동은 CLS에서 제외된다
// (`usePwaInstall`의 `BANNER_TRIGGER_EVENTS` JSDoc). 그래서 숨김 상태에서는 아무것도
// 렌더하지 않는다. 예전에는 높이를 미리 잡는 빈 껍데기를 늘 렌더했는데, 배너를 보지
// 않을 대다수 방문자에게서 첫 화면 3rem을 빼앗았다. 방아쇠를 타이머·비입력 이벤트로
// 바꾸면 그 순간 다시 CLS가 된다.
//
// PWA_BANNER_HEIGHT_CSS와 BANNER_SHELL_CLASS의 h-12는 동일한 값(3rem)을 다른 형태로
// 표현한 것이다. /[symbol] 라우트의 sticky-footer jail이 `--pwa-banner-h` CSS variable을
// 통해 banner 높이를 차감하므로, banner shell의 height 클래스를 바꿀 때는 반드시
// PWA_BANNER_HEIGHT_CSS도 함께 갱신해야 한다.
const BANNER_SHELL_CLASS =
    'border-secondary-700 bg-secondary-800 flex h-12 items-center gap-2 border-b px-3';
const PWA_BANNER_HEIGHT_CSS = '3rem';

export function PwaBanner() {
    const t = useTranslations('features.pwa-install');
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
                <span className="min-w-0 flex-1 truncate text-xs text-secondary-200">
                    {t('PwaBanner.ba5aad')}
                </span>
                <button
                    type="button"
                    onClick={handleInstall}
                    tabIndex={showBanner ? 0 : -1}
                    className={cn(
                        BUTTON_PRIMARY,
                        'shrink-0 rounded-full px-3 py-1 text-xs'
                    )}
                >
                    {t('PwaBanner.15236a')}
                </button>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label={t('PwaBanner.9631f3')}
                    tabIndex={showBanner ? 0 : -1}
                    className="shrink-0 rounded text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <CloseIcon className="size-4" />
                </button>
            </div>
            {isIos && showIosModal && (
                <IosInstallModal onClose={handleModalClose} />
            )}
        </>
    );
}
