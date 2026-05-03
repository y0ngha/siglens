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
            <div className="border-secondary-700 bg-secondary-800 flex items-center gap-2 border-b px-3 py-2">
                <span className="text-base" aria-hidden="true">
                    📈
                </span>
                <span className="text-secondary-200 min-w-0 flex-1 truncate text-xs">
                    SigLens 앱으로 설치하면 더 빠르게 접속할 수 있어요
                </span>
                <button
                    onClick={handleInstall}
                    className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white transition-colors focus-visible:ring-1 focus-visible:outline-none"
                >
                    설치하기
                </button>
                <button
                    onClick={handleDismiss}
                    aria-label="배너 닫기"
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
