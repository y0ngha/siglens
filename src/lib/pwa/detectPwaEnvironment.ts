import { type PwaEnvironment } from '@/shared/lib/types';

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
