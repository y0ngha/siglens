/**
 * @file 설치 배너를 띄울 수 있는 환경인지(모바일·iOS·인앱 브라우저·이미 설치됨) 판정한다.
 */

import { type PwaEnvironment } from '@/shared/lib/types';

/** 브라우저 밖(SSR 프리렌더)의 환경 — 모든 플래그가 꺼져 배너 조건을 통과하지 않는다. */
export const SERVER_PWA_ENVIRONMENT: PwaEnvironment = {
    isMobile: false,
    isIos: false,
    isInAppBrowser: false,
    isStandalone: false,
};

/**
 * UA·표시 모드 신호에서 환경 플래그를 계산하는 순수 함수.
 *
 * `userAgentDataMobile`(Client Hints)이 있으면 UA 정규식보다 먼저 쓴다. 인앱 브라우저는
 * 홈 화면 추가를 지원하지 않아 따로 가린다.
 */
export function detectPwaEnvironment(
    ua: string,
    userAgentDataMobile: boolean | undefined,
    isStandaloneMQ: boolean,
    navigatorStandalone: boolean | undefined
): PwaEnvironment {
    const isMobile =
        userAgentDataMobile ?? /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isInAppBrowser = /KAKAOTALK|Instagram|FBAN|FBAV|Line|NaverApp/i.test(
        ua
    );
    const isStandalone = isStandaloneMQ || navigatorStandalone === true;

    return { isMobile, isIos, isInAppBrowser, isStandalone };
}

/**
 * 현재 브라우저의 `navigator`·`matchMedia`를 읽어 [[detectPwaEnvironment]]에 넘긴다.
 * `window`가 없으면(서버) [[SERVER_PWA_ENVIRONMENT]].
 */
export function readPwaEnvironment(): PwaEnvironment {
    if (typeof window === 'undefined') return SERVER_PWA_ENVIRONMENT;
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
