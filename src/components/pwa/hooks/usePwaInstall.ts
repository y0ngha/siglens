'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type PwaEnvironment } from '@/domain/types';
import { detectPwaEnvironment } from '@/lib/pwa/detectPwaEnvironment';
import { PWA_TRIGGER_EVENT } from '@/lib/pwaEvents';

type PromptOutcome = 'accepted' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: PromptOutcome }>;
}

export interface UsePwaInstallReturn {
    showBanner: boolean;
    showIosModal: boolean;
    isIos: boolean;
    handleInstall: () => Promise<void>;
    handleDismiss: () => void;
    handleModalClose: () => void;
}

export const PWA_BANNER_FALLBACK_DELAY_MS = 30_000;

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
    const [showBanner, setShowBanner] = useState(false);
    const [showIosModal, setShowIosModal] = useState(false);
    // Lazy initializer: SSR prerender returns EMPTY_ENV (window undefined); client mount re-runs with real window
    const [env] = useState<PwaEnvironment>(resolveEnv);

    const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleInstall = useCallback(async () => {
        if (env.isIos) {
            setShowIosModal(true);
        } else if (deferredPromptRef.current) {
            try {
                await deferredPromptRef.current.prompt();
            } catch (err) {
                console.warn('[PWA] prompt 실패', err);
            }
            deferredPromptRef.current = null;
            setShowBanner(false);
        }
    }, [env.isIos]);

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
            deferredPromptRef.current = e as BeforeInstallPromptEvent;
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
