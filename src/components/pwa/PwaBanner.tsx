'use client';

import { usePwaInstall } from '@/components/pwa/hooks/usePwaInstall';
import { IosInstallModal } from '@/components/pwa/IosInstallModal';

export function PwaBanner() {
    const {
        showBanner,
        showIosModal,
        isIos,
        handleInstall,
        handleDismiss,
        handleModalClose,
    } = usePwaInstall();

    if (!showBanner) return null;

    return (
        <>
            <div className="flex items-center gap-2 border-b border-secondary-700 bg-secondary-800 px-3 py-2">
                <span className="text-base" aria-hidden="true">
                    📈
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-secondary-200">
                    SigLens 앱으로 설치하면 더 빠르게 접속할 수 있어요
                </span>
                <button
                    onClick={handleInstall}
                    className="shrink-0 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    설치하기
                </button>
                <button
                    onClick={handleDismiss}
                    aria-label="배너 닫기"
                    className="shrink-0 text-lg leading-none text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
