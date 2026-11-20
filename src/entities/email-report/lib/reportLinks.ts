import { localePath, type Locale } from '@/shared/i18n/locales';
import { signReportValue } from './reportSignature';

/** 서명된 차트 이미지 라우트 경로. */
export const REPORT_CHART_PATH = '/api/email-report/chart';
/** `List-Unsubscribe` 원클릭 POST 라우트 경로. */
export const REPORT_UNSUBSCRIBE_API_PATH = '/api/email-report/unsubscribe';
/** 본문 수신거부 링크가 여는 확인 페이지 경로(로케일 접두 전). */
export const REPORT_UNSUBSCRIBE_PAGE_PATH = '/email-report/unsubscribe';

/** 차트 서명 입력 — 심볼과 날짜를 함께 묶어 날짜만 바꾼 URL을 막는다. */
export function chartSignatureValue(symbol: string, date: string): string {
    return `${symbol}:${date}`;
}

/**
 * 메일에 넣는 차트 이미지 URL. 날짜가 경로 키라 같은 날 같은 종목을 가진 회원들이
 * 같은 URL을 받아 CDN 캐시를 나눠 쓴다.
 */
export function buildChartImageUrl(
    siteUrl: string,
    secret: string,
    symbol: string,
    date: string
): string {
    const params = new URLSearchParams({
        s: symbol,
        d: date,
        sig: signReportValue(
            secret,
            'chart',
            chartSignatureValue(symbol, date)
        ),
    });
    return `${siteUrl}${REPORT_CHART_PATH}?${params.toString()}`;
}

function unsubscribeParams(secret: string, userId: string): string {
    return new URLSearchParams({
        u: userId,
        sig: signReportValue(secret, 'unsubscribe', userId),
    }).toString();
}

/**
 * 본문의 수신거부 링크 — 확인 페이지로 간다. GET 한 번으로 끄지 않는 이유: 메일 보안
 * 스캐너가 링크를 미리 열어 회원이 누르지도 않았는데 수신이 꺼진다.
 */
export function buildUnsubscribePageUrl(
    siteUrl: string,
    secret: string,
    locale: Locale,
    userId: string
): string {
    return `${siteUrl}${localePath(locale, REPORT_UNSUBSCRIBE_PAGE_PATH)}?${unsubscribeParams(secret, userId)}`;
}

/** `List-Unsubscribe` 헤더용 원클릭(RFC 8058, POST) 엔드포인트. */
export function buildUnsubscribeApiUrl(
    siteUrl: string,
    secret: string,
    userId: string
): string {
    return `${siteUrl}${REPORT_UNSUBSCRIBE_API_PATH}?${unsubscribeParams(secret, userId)}`;
}

/**
 * 메일 본문 콘텐츠 링크가 공유하는 유입 추적 UTM. `utm_source`·`utm_medium=email`은 방문 비콘의
 * 출처 분류(`classifyEntrySource`)가 `email`로 읽는다. 계정 관리 링크(설정·수신거부)에는 붙이지 않는다.
 */
function emailUtmQuery(): string {
    return new URLSearchParams({
        utm_source: 'email',
        utm_medium: 'email',
        utm_campaign: 'email_report',
    }).toString();
}

/** 종목 페이지 절대 URL(유입 추적용 UTM 포함). */
export function buildSymbolPageUrl(
    siteUrl: string,
    locale: Locale,
    symbol: string
): string {
    return `${siteUrl}${localePath(locale, `/${encodeURIComponent(symbol)}`)}?${emailUtmQuery()}`;
}

/** 시장 페이지(`/market`) 절대 URL(유입 추적용 UTM 포함). 시장 브리핑 메일의 링크다. */
export function buildMarketPageUrl(siteUrl: string, locale: Locale): string {
    return `${siteUrl}${localePath(locale, '/market')}?${emailUtmQuery()}`;
}
