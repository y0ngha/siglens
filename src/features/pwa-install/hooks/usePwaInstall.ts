'use client';

/**
 * @file PWA 설치 배너의 상태 훅과 그 옵션·반환 모양.
 */

import { useCallback, useState } from 'react';
import { type PwaEnvironment } from '@/shared/lib/types';
import { useRegisterServiceWorker } from './useRegisterServiceWorker';
import { useFirstInputReveal } from './useFirstInputReveal';
import { useDeferredInstallPrompt } from './useDeferredInstallPrompt';
import { readPwaEnvironment } from '../lib/detectPwaEnvironment';
import {
    readBannerDismissed,
    writeBannerDismissed,
} from '../lib/bannerDismissal';

/** [[usePwaInstall]]이 `PwaBanner`에 넘기는 상태와 안정적인 핸들러. */
export interface UsePwaInstallReturn {
    /** 첫 입력이 끝났고, 사용자가 닫거나 설치를 수락하지 않았다. */
    showBanner: boolean;
    /** iOS에서 설치 버튼을 눌러 홈 화면 추가 안내 모달이 열려 있다. */
    showIosModal: boolean;
    /** iOS는 설치 프롬프트가 없어 버튼이 안내 모달을 연다. */
    isIos: boolean;
    /** iOS면 안내 모달을 열고, 아니면 받아 둔 브라우저 설치 프롬프트를 띄운다. */
    handleInstall: () => Promise<void>;
    /** 배너를 닫고 이 브라우저에 기억해 다음 로드부터 띄우지 않는다. */
    handleDismiss: () => void;
    /** iOS 안내 모달을 닫는다(배너는 남는다). */
    handleModalClose: () => void;
}

/** [[usePwaInstall]] 옵션. */
export interface UsePwaInstallOptions {
    /** Passed to `registerServiceWorker` — see its `reloadOnUpdate`. */
    readonly reloadOnServiceWorkerUpdate?: boolean;
}

/**
 * PWA 설치 배너의 상태 기계 — 서비스 워커 등록, 환경 판정, 첫 입력 방아쇠, 설치 프롬프트,
 * 닫기 기억을 묶는다.
 *
 * 배너는 홈 화면 추가가 가능한 모바일 브라우저(이미 설치된 standalone·인앱 브라우저 제외)에서,
 * 이 브라우저에서 닫거나 설치를 수락한 적이 없을 때만 첫 입력 뒤에 뜬다.
 */
export function usePwaInstall({
    reloadOnServiceWorkerUpdate = true,
}: UsePwaInstallOptions = {}): UsePwaInstallReturn {
    /** 이번 페이지에서 닫았거나 설치를 수락했다. */
    const [hidden, setHidden] = useState(false);
    const [showIosModal, setShowIosModal] = useState(false);
    // Lazy initializer: SSR prerender returns the server environment (window undefined);
    // the client's hydration render runs it again with the real window. Neither value
    // reaches the markup before the first input, so the two never mismatch.
    const [env] = useState<PwaEnvironment>(readPwaEnvironment);
    // 마운트 때 한 번 읽는다 — 이번 페이지에서 닫으면 `hidden`이 맡고, 방아쇠는 이미 발화했다.
    const [dismissedBefore] = useState(readBannerDismissed);

    useRegisterServiceWorker(reloadOnServiceWorkerUpdate);
    // 아래 두 훅의 입력이라 그 직전에 둔다(`REACT.md#HK-1`의 예외).
    const enabled =
        env.isMobile &&
        !env.isStandalone &&
        !env.isInAppBrowser &&
        !dismissedBefore;
    const revealed = useFirstInputReveal(enabled);
    const promptInstall = useDeferredInstallPrompt(enabled);

    const handleDismiss = useCallback(() => {
        setHidden(true);
        writeBannerDismissed();
    }, []);

    const handleInstall = useCallback(async () => {
        if (env.isIos) {
            setShowIosModal(true);
            return;
        }
        if (await promptInstall()) handleDismiss();
    }, [env.isIos, promptInstall, handleDismiss]);

    const handleModalClose = useCallback(() => setShowIosModal(false), []);

    return {
        showBanner: revealed && !hidden,
        showIosModal,
        isIos: env.isIos,
        handleInstall,
        handleDismiss,
        handleModalClose,
    };
}
