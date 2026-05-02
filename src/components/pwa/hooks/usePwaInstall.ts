'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    detectPwaEnvironment,
    type PwaEnvironment,
} from '@/components/pwa/utils/detectPwaEnvironment';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface UsePwaInstallReturn {
    showBanner: boolean;
    showIosModal: boolean;
    isIos: boolean;
    handleInstall: () => Promise<void>;
    handleDismiss: () => void;
    handleModalClose: () => void;
}

const EMPTY_ENV: PwaEnvironment = {
    isMobile: false,
    isIos: false,
    isInAppBrowser: false,
    isStandalone: false,
};

function resolveEnv(): PwaEnvironment {
    if (typeof window === 'undefined') return EMPTY_ENV;
    return detectPwaEnvironment(
        navigator.userAgent,
        (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData
            ?.mobile,
        window.matchMedia('(display-mode: standalone)').matches,
        (navigator as { standalone?: boolean }).standalone
    );
}

export function usePwaInstall(): UsePwaInstallReturn {
    const [showBanner, setShowBanner] = useState(false);
    const [showIosModal, setShowIosModal] = useState(false);
    // Lazy initializer: runs once on mount, avoids setState-in-effect
    const [env] = useState<PwaEnvironment>(resolveEnv);
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }

        const canShow =
            env.isMobile && !env.isStandalone && !env.isInAppBrowser;

        const handlePrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        const handleTrigger = () => {
            if (canShow) setShowBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handlePrompt);
        window.addEventListener('siglens:pwa-trigger', handleTrigger);

        // 30s fallback: trigger banner if analysis doesn't fire the event first
        const fallbackId = setTimeout(() => {
            if (canShow) setShowBanner(true);
        }, 30_000);

        return () => {
            window.removeEventListener('beforeinstallprompt', handlePrompt);
            window.removeEventListener('siglens:pwa-trigger', handleTrigger);
            clearTimeout(fallbackId);
        };
    }, [env.isMobile, env.isStandalone, env.isInAppBrowser]);

    const handleInstall = useCallback(async () => {
        if (env.isIos) {
            setShowIosModal(true);
        } else if (deferredPrompt) {
            await deferredPrompt.prompt();
            setDeferredPrompt(null);
            setShowBanner(false);
        }
    }, [env.isIos, deferredPrompt]);

    const handleDismiss = useCallback(() => setShowBanner(false), []);
    const handleModalClose = useCallback(() => setShowIosModal(false), []);

    return {
        showBanner,
        showIosModal,
        isIos: env.isIos,
        handleInstall,
        handleDismiss,
        handleModalClose,
    };
}
