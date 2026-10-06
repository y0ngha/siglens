'use client';

import { registerServiceWorker } from '../lib/registerServiceWorker';
import { type PwaEnvironment } from '@/shared/lib/types';
import { detectPwaEnvironment } from '../lib/detectPwaEnvironment';
import {
    readBannerDismissed,
    writeBannerDismissed,
} from '../lib/bannerDismissal';
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
 * 배너는 이제 하단 고정 오버레이라(`PwaBanner` JSDoc) 나타나도 레이아웃이 밀리지
 * 않는다 — 예전처럼 흐름에 삽입되던 시절에는 이 입력 게이트가 CLS 방지 장치였다
 * (입력 500ms 안의 이동은 CLS에서 제외. 2026-09-18 모바일 실측: 타이머로 띄우면
 * 종목 페이지 0.0605). 다만 스크롤 시작의 `pointerdown`도 입력으로 치는지는
 * 브라우저 판정에 달려 있어 그 보호가 완전하지 않았고, 그래서 오버레이로 바꿨다.
 *
 * 게이트 자체는 남긴다. **첫 화면을 배너가 가리지 않는다** — 검색 유입의 첫인상과
 * 구글 모바일 인터스티셜 판정(진입 직후 본문을 가리는 오버레이) 양쪽에 낫다.
 * `scroll`은 입력 이벤트가 아니라 넣지 않는다.
 *
 * 분석 완료(`siglens:pwa-trigger`)는 방아쇠가 아니다. 그 경로는 입력과 무관하게
 * 열린다 — 회원은 마운트 시 분석이 자동으로 돌아 입력 없이 배너가 떴다.
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
                    writeBannerDismissed();
                }
            } catch (err) {
                console.warn('[PWA] prompt 실패', err);
            }
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        writeBannerDismissed();
    };

    const handleModalClose = () => setShowIosModal(false);

    useEffect(() => {
        registerServiceWorker();
    }, []);

    useEffect(() => {
        const canShow =
            env.isMobile && !env.isStandalone && !env.isInAppBrowser;
        if (!canShow || readBannerDismissed()) return;

        const handlePrompt = (e: Event) => {
            e.preventDefault();
            // beforeinstallprompt 이벤트는 항상 BeforeInstallPromptEvent임이 보장됨
            deferredPromptRef.current = e as BeforeInstallPromptEvent;
        };

        const detachTriggers = () => {
            for (const type of BANNER_TRIGGER_EVENTS) {
                window.removeEventListener(type, handleTrigger);
            }
        };

        // 방아쇠는 합쳐서 한 번만 발화한다. 이벤트별 `once`만 걸면 한쪽이 배너를
        // 띄우고 사용자가 닫은 뒤, 남아 있던 다른 쪽이 배너를 다시 띄운다.
        function handleTrigger() {
            detachTriggers();
            setShowBanner(true);
        }

        window.addEventListener('beforeinstallprompt', handlePrompt);
        for (const type of BANNER_TRIGGER_EVENTS) {
            window.addEventListener(type, handleTrigger, { passive: true });
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handlePrompt);
            detachTriggers();
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
