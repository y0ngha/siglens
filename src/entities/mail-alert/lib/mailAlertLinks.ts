import type { SignalType } from '@y0ngha/siglens-core';
import { emailUtmQuery } from '@/entities/email-report/lib/reportLinks';
import {
    signReportValue,
    verifyReportValue,
} from '@/entities/email-report/lib/reportSignature';
import {
    SIGNAL_HUBS,
    signalHubPath,
} from '@/entities/signal-history/lib/signalHubs';
import { localePath, type Locale } from '@/shared/i18n/locales';
import type { MailAlertFearGreedMarket } from '../model';
import { isSubscriberId } from './mailAlertCookie';

/** 알림 설정 페이지의 앱 경로(로케일 접두사 없음). 앱 라우트의 `MAIL_ALERTS_PATH`와 같은 값이어야 한다(테스트가 고정). */
export const MAIL_ALERT_MANAGE_PATH = '/email-report/alerts';

/** `List-Unsubscribe` 원클릭 POST 라우트 경로. */
export const MAIL_ALERT_UNSUBSCRIBE_API_PATH = '/api/mail-alert/unsubscribe';

/** 알림 메일 본문 링크의 `utm_campaign`. */
export const MAIL_ALERT_UTM_CAMPAIGN = 'mail_alert';

/** 메일 하단 수신거부 링크가 설정 페이지에서 열어 줄 구역(`MailAlertManage`의 `id="unsubscribe"`). */
const UNSUBSCRIBE_FRAGMENT = 'unsubscribe';

const FEAR_GREED_PATH: Record<MailAlertFearGreedMarket, string> = {
    us: '/fear-greed',
    kr: '/fear-greed/kr',
    crypto: '/fear-greed/crypto',
};

function signedParams(
    purpose: 'alert-manage' | 'alert-unsubscribe',
    secret: string,
    subscriberId: string
): string {
    return new URLSearchParams({
        s: subscriberId,
        sig: signReportValue(secret, purpose, subscriberId),
    }).toString();
}

/**
 * 메일 속 설정 링크. 서명은 구독자 id에만 걸려 있고 만료가 없다(`reportSignature.ts`의 만료 결정 참고).
 * 링크가 가리키는 권한은 그 구독자의 항목을 지우거나 구독자를 지우는 것뿐이다.
 */
export function buildMailAlertManageUrl(
    siteUrl: string,
    secret: string,
    locale: Locale,
    subscriberId: string
): string {
    return `${siteUrl}${localePath(locale, MAIL_ALERT_MANAGE_PATH)}?${signedParams('alert-manage', secret, subscriberId)}`;
}

/** 본문의 수신거부 링크 — 같은 설정 페이지의 "모두 그만 받기" 구역으로 간다. 열기만 해서는 아무것도 지워지지 않는다. */
export function buildMailAlertUnsubscribePageUrl(
    siteUrl: string,
    secret: string,
    locale: Locale,
    subscriberId: string
): string {
    return `${buildMailAlertManageUrl(siteUrl, secret, locale, subscriberId)}#${UNSUBSCRIBE_FRAGMENT}`;
}

/**
 * `List-Unsubscribe` 원클릭(RFC 8058, POST) 엔드포인트. 설정 링크와 서명 용도가 달라 서로 대신 쓸 수 없다.
 * `l`(로케일)은 서명 대상이 아니다 — 브라우저로 직접 연 GET이 설정 페이지를 그 언어로 열어 주는 데만 쓰이고,
 * 권한을 주지 않으므로 바꿔도 얻는 것이 없다.
 */
export function buildMailAlertUnsubscribeApiUrl(
    siteUrl: string,
    secret: string,
    subscriberId: string,
    locale: Locale
): string {
    return `${siteUrl}${MAIL_ALERT_UNSUBSCRIBE_API_PATH}?${signedParams('alert-unsubscribe', secret, subscriberId)}&l=${locale}`;
}

/** 원클릭 수신거부 요청의 서명 검증. 형식이 깨진 id·서명도 던지지 않고 `false`다. */
export function verifyMailAlertUnsubscribe(
    secret: string,
    subscriberId: string,
    signature: string
): boolean {
    return (
        isSubscriberId(subscriberId) &&
        verifyReportValue(secret, 'alert-unsubscribe', subscriberId, signature)
    );
}

function contentUrl(siteUrl: string, locale: Locale, path: string): string {
    return `${siteUrl}${localePath(locale, path)}?${emailUtmQuery(MAIL_ALERT_UTM_CAMPAIGN)}`;
}

/** 종목 페이지(유입 추적 UTM 포함). */
export function buildMailAlertSymbolUrl(
    siteUrl: string,
    locale: Locale,
    symbol: string
): string {
    return contentUrl(siteUrl, locale, `/${encodeURIComponent(symbol)}`);
}

/** 신호별 종목 페이지. 허브가 없는 유형이면 `null`이라 호출자가 링크를 생략한다. */
export function buildMailAlertHubUrl(
    siteUrl: string,
    locale: Locale,
    signalType: SignalType
): string | null {
    const hub = SIGNAL_HUBS.find(
        candidate => candidate.signalType === signalType
    );
    return hub === undefined
        ? null
        : contentUrl(siteUrl, locale, signalHubPath(hub.slug));
}

/** 공포·탐욕 지수 허브 페이지. */
export function buildMailAlertFearGreedUrl(
    siteUrl: string,
    locale: Locale,
    market: MailAlertFearGreedMarket
): string {
    return contentUrl(siteUrl, locale, FEAR_GREED_PATH[market]);
}
