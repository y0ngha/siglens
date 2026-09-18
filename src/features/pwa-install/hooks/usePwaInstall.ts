'use client';

import { registerServiceWorker } from '../lib/registerServiceWorker';
import { type PwaEnvironment } from '@/shared/lib/types';
import { detectPwaEnvironment } from '../lib/detectPwaEnvironment';
import { useEffect, useRef, useState } from 'react';

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

/**
 * 배너를 띄우는 **첫 사용자 입력** 이벤트.
 *
 * 예전에는 마운트 100ms 뒤 타이머로 띄웠다. 배너가 흐름에 삽입되면서 본문이
 * 3rem 밀리는데, 그 시점이 하이드레이션 직후(실측 약 2초)라 그대로 CLS가 됐다
 * (2026-09-18 모바일 실측: 종목 페이지 0.0605, 홈 0).
 *
 * 레이아웃 이동은 **사용자 입력 500ms 안에 일어나면 CLS에서 제외**된다. 그래서
 * 첫 `pointerdown`/`keydown`까지 기다린다 — 모바일 스크롤도 `pointerdown`으로
 * 시작하므로 사실상 첫 상호작용 시점이다. `scroll`은 이 목적의 "입력"으로 치지
 * 않으므로 넣지 않는다(넣으면 제외되지 않는 이동이 다시 생긴다).
 *
 * 예전에는 분석 완료(`siglens:pwa-trigger`)도 방아쇠였는데 함께 없앴다. 그 경로는
 * 입력과 무관하게 열린다 — 회원(tier !== 'free')은 마운트 시 `restartAnalysis()`가
 * 자동으로 돌고, 서버 초기 분석이 실패한 페이지도 자동 재시도한다. 두 경우 모두
 * SSE 완료 시점에 배너가 삽입돼 제외 창 밖의 이동이 된다. 입력 게이트가 생긴 뒤로는
 * 중복이기도 하다 — 분석을 돌리려면 어차피 탭을 해야 하고, 그 탭이 이미 배너를 띄운다.
 *
 * 부수 효과로 첫 화면을 배너가 가리지 않는다 — 검색 유입 첫인상에도 낫다.
 */
const BANNER_TRIGGER_EVENTS = ['pointerdown', 'keydown'] as const;

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

    const handleInstall = async () => {
        if (env.isIos) {
            setShowIosModal(true);
        } else if (deferredPromptRef.current) {
            const prompt = deferredPromptRef.current;
            deferredPromptRef.current = null;
            try {
                await prompt.prompt();
                const { outcome } = await prompt.userChoice;
                if (outcome === 'accepted') {
                    setShowBanner(false);
                }
            } catch (err) {
                console.warn('[PWA] prompt 실패', err);
            }
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
    };

    const handleModalClose = () => setShowIosModal(false);

    useEffect(() => {
        registerServiceWorker();
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
        };

        window.addEventListener('beforeinstallprompt', handlePrompt);
        for (const type of BANNER_TRIGGER_EVENTS) {
            window.addEventListener(type, handleTrigger, {
                once: true,
                passive: true,
            });
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handlePrompt);
            for (const type of BANNER_TRIGGER_EVENTS) {
                window.removeEventListener(type, handleTrigger);
            }
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
