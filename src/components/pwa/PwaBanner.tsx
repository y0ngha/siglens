'use client';

import { usePwaInstall } from './hooks/usePwaInstall';
import { IosInstallModal } from './IosInstallModal';

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
            <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-3 py-2">
                <span className="text-base" aria-hidden="true">
                    📈
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                    SigLens 앱으로 설치하면 더 빠르게 접속할 수 있어요
                </span>
                <button
                    onClick={handleInstall}
                    className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                >
                    설치하기
                </button>
                <button
                    onClick={handleDismiss}
                    aria-label="배너 닫기"
                    className="shrink-0 text-lg leading-none text-slate-500"
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
