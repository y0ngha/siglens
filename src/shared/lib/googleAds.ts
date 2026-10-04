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
 * 전환을 큐에 넣었다는 신호. `GoogleAdsTag`가 받아 gtag.js를 **바로** 불러온다 — 평소엔
 * 페이지가 다 뜬 뒤 한가할 때 불러오는데, 그 전에 사용자가 다른 문서로 떠나면 큐에만
 * 쌓인 전환이 사라진다.
 */
export const ADS_CONVERSION_QUEUED_EVENT = 'siglens:ads-conversion-queued';

/**
 * 이 문서에서 전환이 한 번이라도 큐에 들어갔는가. 이벤트만으로는 태그가 마운트되기 **전에**
 * 일어난 전환을 놓치므로 상태로도 남긴다(`useSyncExternalStore`로 읽는다).
 */
let conversionQueuedInDocument = false;

export function hasQueuedAdsConversion(): boolean {
    return conversionQueuedInDocument;
}

export function subscribeAdsConversionQueued(onChange: () => void): () => void {
    window.addEventListener(ADS_CONVERSION_QUEUED_EVENT, onChange);
    return () =>
        window.removeEventListener(ADS_CONVERSION_QUEUED_EVENT, onChange);
}

/**
 * gtag 초기 명령(`js`·`config`)을 큐에 넣는다. 한 문서에서 한 번만 넣는다.
 *
 * 전환 이벤트보다 **반드시 먼저** 들어가야 한다 — `allow_ad_personalization_signals:false`가
 * 담긴 `config`가 뒤에 오면 그 앞의 전환은 개인화 끔 설정 없이 처리될 수 있다. 개인정보처리방침
 * v5가 "맞춤형 광고에 이용하지 않음"을 약속하므로 이 순서가 깨지면 방침이 거짓이 된다.
 */
export function initAdsCommandQueue(id: string): void {
    if (typeof window === 'undefined') return;
    const flagged = window as Window & { __siglensAdsInit?: boolean };
    if (flagged.__siglensAdsInit) return;
    flagged.__siglensAdsInit = true;
    gtag('js', new Date());
    gtag('config', id, { allow_ad_personalization_signals: false });
}

/**
 * 문서가 열린 순간의 URL에 클릭 식별자가 있었는가. 처음 읽을 때 고정한다 — SPA 이동이나
 * `replaceState`로 쿼리가 사라져도 "광고 클릭으로 들어온 문서"라는 사실은 바뀌지 않는다.
 */
let openedFromAdClick: boolean | null = null;

export function wasOpenedFromAdClick(): boolean {
    openedFromAdClick ??= hasAdClickId(window.location.search);
    return openedFromAdClick;
}

/** 광고 클릭으로 들어온 문서인가 — URL에 클릭 식별자가 있다. */
export function hasAdClickId(search: string): boolean {
    const params = new URLSearchParams(search);
    return ['gclid', 'gbraid', 'wbraid'].some(key => params.has(key));
}

/**
 * 전환 1건을 기록한다. ID·라벨이 비었거나 서버에서 불리면 아무것도 하지 않는다.
 * 광고 측정 실패가 가입·질문·검색을 깨면 안 되므로 던지지 않는다.
 */
export function trackAdsConversion(conversion: AdsConversion): void {
    const label = GOOGLE_ADS_CONVERSION_LABELS[conversion];
    if (!GOOGLE_ADS_ID || !label || typeof window === 'undefined') return;
    initAdsCommandQueue(GOOGLE_ADS_ID);
    gtag('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${label}` });
    conversionQueuedInDocument = true;
    window.dispatchEvent(new Event(ADS_CONVERSION_QUEUED_EVENT));
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
