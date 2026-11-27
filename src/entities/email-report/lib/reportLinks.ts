import { localePath, type Locale } from '@/shared/i18n/locales';
import { signReportValue } from './reportSignature';

/** 서명된 차트 이미지 라우트 경로. */
export const REPORT_CHART_PATH = '/api/email-report/chart';
/** `List-Unsubscribe` 원클릭 POST 라우트 경로. */
export const REPORT_UNSUBSCRIBE_API_PATH = '/api/email-report/unsubscribe';
/** 본문 수신거부 링크가 여는 확인 페이지 경로(로케일 접두 전). */
export const REPORT_UNSUBSCRIBE_PAGE_PATH = '/email-report/unsubscribe';

/**
 * 차트 서명 입력 — 심볼과 날짜를 함께 묶어 날짜만 바꾼 URL을 막는다. 작도를 가져온 분석 시각(`analysisAt`,
 * epoch 밀리초)이 있으면 그것도 묶는다 — 같은 서명으로 다른 분석의 작도를 받지 못하게 한다. 없으면 작도 도입 전
 * 메일이 쓰던 `symbol:date` 그대로다(이미 나간 메일의 URL이 계속 동작한다).
 */
export function chartSignatureValue(
    symbol: string,
    date: string,
    analysisAt: string | null = null
): string {
    return analysisAt === null
        ? `${symbol}:${date}`
        : `${symbol}:${date}:${analysisAt}`;
}

/** 이미지 URL의 `a`(분석 시각, epoch 밀리초) 모양 — 서명 전에 걸러 쓰레기 입력이 조회에 닿지 않게 한다. */
export const CHART_ANALYSIS_AT_RE = /^\d{10,14}$/;

/**
 * 메일에 넣는 차트 이미지 URL. 날짜가 경로 키라 같은 날 같은 종목을 가진 회원들이
 * 같은 URL을 받아 CDN 캐시를 나눠 쓴다. `analysisAt`이 있으면 그 분석의 작도를 그린다 — 시각이 URL에 박혀
 * 이미지가 영원히 같은 분석을 가리킨다(캐시를 불변으로 둘 수 있는 이유).
 */
export function buildChartImageUrl(
    siteUrl: string,
    secret: string,
    symbol: string,
    date: string,
    analysisAt: Date | null = null
): string {
    const at = analysisAt === null ? null : String(analysisAt.getTime());
    const params = new URLSearchParams({
        s: symbol,
        d: date,
        ...(at === null ? {} : { a: at }),
        sig: signReportValue(
            secret,
            'chart',
            chartSignatureValue(symbol, date, at)
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
