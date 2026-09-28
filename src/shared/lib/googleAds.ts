import { SIGNUP_CONVERSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import {
    GOOGLE_ADS_CONVERSION_LABELS,
    GOOGLE_ADS_ID,
    SIGNUP_CONVERSION_COOKIE_DOMAIN,
    SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS,
    type AdsConversion,
} from '@/shared/config/googleAds';

declare global {
    interface Window {
        dataLayer?: unknown[];
    }
}

/**
 * gtag.js 명령 큐에 넣는다. gtag.js는 배열이 아니라 `arguments` 객체만 명령으로
 * 해석하므로 화살표 함수나 rest 인자 배열로 바꾸면 조용히 무시된다.
 * `window.gtag` 대신 dataLayer에 직접 넣는 이유: 스크립트 로드 전에 불려도 큐에
 * 쌓였다가 로드 후 전송된다.
 */
function gtag(..._args: unknown[]): void {
    (window.dataLayer ??= []).push(arguments);
}

/**
 * 전환 1건을 기록한다. ID·라벨이 비었거나 서버에서 불리면 아무것도 하지 않는다.
 * 광고 측정 실패가 가입·질문·검색을 깨면 안 되므로 던지지 않는다.
 */
export function trackAdsConversion(conversion: AdsConversion): void {
    const label = GOOGLE_ADS_CONVERSION_LABELS[conversion];
    if (!GOOGLE_ADS_ID || !label || typeof window === 'undefined') return;
    gtag('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${label}` });
}

export interface SignupConversionCookie {
    name: string;
    value: string;
    maxAge: number;
    path: string;
    domain: string;
    sameSite: 'lax';
    secure: boolean;
    httpOnly: false;
}

/**
 * 가입 서버 액션이 세팅하는 1회용 플래그. 다음 페이지의 `GoogleAdsTag`가 읽고
 * 지워야 하므로 httpOnly가 아니다.
 */
export function createSignupConversionCookie(params: {
    secure: boolean;
}): SignupConversionCookie {
    return {
        name: SIGNUP_CONVERSION_COOKIE_NAME,
        value: '1',
        maxAge: SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS,
        path: '/',
        domain: SIGNUP_CONVERSION_COOKIE_DOMAIN,
        sameSite: 'lax',
        secure: params.secure,
        httpOnly: false,
    };
}

/**
 * 가입 플래그가 있으면 지우고 true. 세팅할 때와 같은 Domain·Path로 만료시켜야
 * 지워진다(다르면 브라우저가 별개 쿠키로 본다).
 */
export function consumeSignupConversionFlag(): boolean {
    if (typeof document === 'undefined') return false;
    const present = document.cookie
        .split('; ')
        .includes(`${SIGNUP_CONVERSION_COOKIE_NAME}=1`);
    if (present) {
        document.cookie = `${SIGNUP_CONVERSION_COOKIE_NAME}=; Max-Age=0; Path=/; Domain=${SIGNUP_CONVERSION_COOKIE_DOMAIN}`;
    }
    return present;
}
