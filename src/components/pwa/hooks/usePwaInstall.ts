'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    detectPwaEnvironment,
    type PwaEnvironment,
} from '@/components/pwa/utils/detectPwaEnvironment';
import { PWA_TRIGGER_EVENT } from '@/lib/pwaEvents';

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

const PWA_BANNER_FALLBACK_DELAY_MS = 30_000;

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
        // userAgentData는 WICG NavigatorUAData 스펙 확장; TS 표준 Navigator 타입에 미포함
        (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData
            ?.mobile,
        window.matchMedia('(display-mode: standalone)').matches,
        // standalone은 iOS Safari 전용 확장; TS 표준 Navigator 타입에 미포함
        (navigator as { standalone?: boolean }).standalone
    );
}

export function usePwaInstall(): UsePwaInstallReturn {
    // Hook order: useState → useRef → useCallback → useEffect
    const [showBanner, setShowBanner] = useState(false);
    const [showIosModal, setShowIosModal] = useState(false);
    // Lazy initializer: SSR returns EMPTY_ENV; re-runs on client with real window
    const [env] = useState<PwaEnvironment>(resolveEnv);
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleInstall = useCallback(async () => {
        if (env.isIos) {
            setShowIosModal(true);
        } else if (deferredPrompt) {
            await deferredPrompt.prompt();
            setDeferredPrompt(null);
            setShowBanner(false);
        }
    }, [env.isIos, deferredPrompt]);

    const handleDismiss = useCallback(() => {
        setShowBanner(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const handleModalClose = useCallback(() => setShowIosModal(false), []);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .catch(err => console.warn('[PWA] SW 등록 실패', err));
        }
    }, []);

    useEffect(() => {
        const canShow =
            env.isMobile && !env.isStandalone && !env.isInAppBrowser;
        if (!canShow) return;

        const handlePrompt = (e: Event) => {
            e.preventDefault();
            // beforeinstallprompt 이벤트는 항상 BeforeInstallPromptEvent임이 보장됨
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        const handleTrigger = () => {
            setShowBanner(true);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        window.addEventListener('beforeinstallprompt', handlePrompt);
        window.addEventListener(PWA_TRIGGER_EVENT, handleTrigger);

        timerRef.current = setTimeout(() => {
            setShowBanner(true);
            timerRef.current = null;
        }, PWA_BANNER_FALLBACK_DELAY_MS);

        return () => {
            window.removeEventListener('beforeinstallprompt', handlePrompt);
            window.removeEventListener(PWA_TRIGGER_EVENT, handleTrigger);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [env.isMobile, env.isStandalone, env.isInAppBrowser]);

    return {
        showBanner,
        showIosModal,
        isIos: env.isIos,
        handleInstall,
        handleDismiss,
        handleModalClose,
    };
}
