'use client';

import { useRegisterServiceWorker } from './useRegisterServiceWorker';
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
 * 포인터 방아쇠는 `pointerdown`이 아니라 **탭이 끝난 뒤**다. `pointerdown`에서 띄우면 손가락이
 * 아직 닿아 있는 동안 배너가 커밋돼, 그 자리에 배너가 뜨는 경우(하단 입력창·상단 크롬 아래
 * 첫 카드) `pointerup`·`click`이 배너로 떨어져 사용자가 누르려던 것이 눌리지 않았다.
 * - `click`: 바로 띄운다. `window`의 버블 단계라 대상 요소의 처리가 이미 끝났다.
 * - `pointerup`: `POINTERUP_REVEAL_DELAY_MS` 뒤에 띄운다(그 사이 `click`이 오면 그때 바로).
 *   iOS Safari는 글자·빈 곳처럼 클릭할 수 없는 요소를 탭하면 `click`을 `window`까지 보내지
 *   않는다 — `click`만 기다리면 컨트롤을 누르지 않는 iPhone 사용자에게 배너가 영영 뜨지
 *   않는다. 지연은 그 탭의 (늦게 올 수도 있는) `click`이 먼저 끝나게 하는 여유다.
 * 스크롤 제스처는 브라우저가 `pointercancel`로 끝내 `pointerup`·`click`이 없으므로 배너는 첫
 * 실제 탭까지 기다린다.
 *
 * 분석 완료(`siglens:pwa-trigger`)는 방아쇠가 아니다. 그 경로는 입력과 무관하게
 * 열린다 — 회원은 마운트 시 분석이 자동으로 돌아 입력 없이 배너가 떴다.
 */
const BANNER_TRIGGER_EVENTS = ['click', 'keydown'] as const;

/** `pointerup`만 온 탭(iOS의 클릭 불가 요소)에서 배너를 띄우기까지의 여유. */
const POINTERUP_REVEAL_DELAY_MS = 500;

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

export interface UsePwaInstallOptions {
    /** Passed to `registerServiceWorker` — see its `reloadOnUpdate`. */
    readonly reloadOnServiceWorkerUpdate?: boolean;
}

export function usePwaInstall({
    reloadOnServiceWorkerUpdate = true,
}: UsePwaInstallOptions = {}): UsePwaInstallReturn {
    const [showBanner, setShowBanner] = useState(false);
    /** 첫 입력 방아쇠가 이미 발화했는가 — 배너를 닫은 뒤 다른 방아쇠가 다시 띄우지 않게. */
    const [triggered, setTriggered] = useState(false);
    /** `click` 없는 `pointerup`이 왔다 — 지연 후 띄울 차례. */
    const [revealPending, setRevealPending] = useState(false);
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

    useRegisterServiceWorker(reloadOnServiceWorkerUpdate);

    const canShow = env.isMobile && !env.isStandalone && !env.isInAppBrowser;

    // 설치 프롬프트는 방아쇠와 무관하게 받아 둔다 — 첫 탭 뒤에 와도 설치 버튼이 써야 한다.
    useEffect(() => {
        if (!canShow || readBannerDismissed()) return;
        const handlePrompt = (e: Event) => {
            e.preventDefault();
            // beforeinstallprompt 이벤트는 항상 BeforeInstallPromptEvent임이 보장됨
            deferredPromptRef.current = e as BeforeInstallPromptEvent;
        };
        window.addEventListener('beforeinstallprompt', handlePrompt);
        return () =>
            window.removeEventListener('beforeinstallprompt', handlePrompt);
    }, [canShow]);

    // 방아쇠는 합쳐서 한 번만 발화한다(`triggered`). 이벤트별 `once`만 걸면 한쪽이 배너를
    // 띄우고 사용자가 닫은 뒤, 남아 있던 다른 쪽이 배너를 다시 띄운다. `triggered`가 서면
    // 이 effect가 다시 돌며 리스너를 모두 걷는다.
    useEffect(() => {
        if (triggered || !canShow || readBannerDismissed()) return;

        // 캡처 단계로 듣는다 — 버블 단계면 `stopPropagation()`하는 컨트롤(팝오버 트리거·메뉴
        // 항목)을 누른 탭이 `window`까지 오지 않아 방아쇠를 놓친다. 캡처 단계에서 상태를 바꿔도
        // 그 탭의 `click`은 이미 정해진 대상에 그대로 전달된다(대상은 디스패치 시작 때 고정).
        const listenerOptions = { passive: true, capture: true } as const;
        const handleTrigger = () => {
            setTriggered(true);
            setShowBanner(true);
        };
        const handlePointerUp = () => setRevealPending(true);

        for (const type of BANNER_TRIGGER_EVENTS) {
            window.addEventListener(type, handleTrigger, listenerOptions);
        }
        window.addEventListener('pointerup', handlePointerUp, listenerOptions);
        return () => {
            for (const type of BANNER_TRIGGER_EVENTS) {
                window.removeEventListener(
                    type,
                    handleTrigger,
                    listenerOptions
                );
            }
            window.removeEventListener(
                'pointerup',
                handlePointerUp,
                listenerOptions
            );
        };
    }, [canShow, triggered]);

    // `click` 없이 `pointerup`만 온 탭(iOS의 클릭 불가 요소): 잠시 뒤에 띄운다. 그 사이 `click`이
    // 와서 `triggered`가 서면 타이머는 정리된다.
    useEffect(() => {
        if (!revealPending || triggered) return;
        const timer = setTimeout(() => {
            setTriggered(true);
            setShowBanner(true);
        }, POINTERUP_REVEAL_DELAY_MS);
        return () => clearTimeout(timer);
    }, [revealPending, triggered]);

    return {
        showBanner,
        showIosModal,
        isIos: env.isIos,
        handleInstall,
        handleDismiss,
        handleModalClose,
    };
}
