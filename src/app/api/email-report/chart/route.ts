import { constants } from 'node:http2';
import { loadBarsData } from '@/entities/bars/lib/loadBarsData';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import {
    buildReportChartImage,
    REPORT_CHART_MA_PERIODS,
} from '@/entities/email-report/lib/buildReportChartImage';
import { barsUpToDate } from '@/entities/email-report/lib/barsUpToDate';
import { chartSignatureValue } from '@/entities/email-report/lib/reportLinks';
import { verifyReportValue } from '@/entities/email-report/lib/reportSignature';
import { SYMBOL_EDGE_RE } from '@/shared/config/ticker';
import { runAsBatchWork } from '@/shared/lib/renderBudget';

const { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_NOT_FOUND } = constants;

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * URL이 `(symbol, date)`로 고정되고 그날까지의 봉만 그리므로 내용이 바뀌지 않는다 —
 * CDN·메일 클라이언트 프록시(Gmail 등)가 오래 들고 있어도 된다.
 */
const CHART_CACHE_CONTROL = 'public, max-age=604800, immutable'; // 7d
const NO_STORE = { 'cache-control': 'no-store' };

/**
 * 메일 리포트의 일봉 차트 PNG.
 *
 * 로그인 없이 열린다(메일 클라이언트는 쿠키 없이 이미지를 받는다). 대신 발송 cron이
 * 서명한 `(symbol, date)`만 그린다 — 서명이 없으면 아무 종목이나 FMP 조회와 이미지
 * 렌더를 시킬 수 있는 공개 엔드포인트가 된다.
 */
export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('s') ?? '';
    const date = url.searchParams.get('d') ?? '';
    const signature = url.searchParams.get('sig') ?? '';
    const secret = readEmailReportSecret();

    if (
        secret === null ||
        !SYMBOL_EDGE_RE.test(symbol) ||
        !DATE_RE.test(date) ||
        !verifyReportValue(
            secret,
            'chart',
            chartSignatureValue(symbol, date),
            signature
        )
    ) {
        return new Response(null, {
            status: HTTP_STATUS_FORBIDDEN,
            headers: NO_STORE,
        });
    }

    try {
        const { bars, indicators } = await runAsBatchWork(() =>
            loadBarsData(symbol, '1Day')
        );
        const { bars: visible, count } = barsUpToDate(bars, date);
        const ma = Object.fromEntries(
            REPORT_CHART_MA_PERIODS.map(p => [
                p,
                (indicators.ma[p] ?? []).slice(0, count),
            ])
        );
        const image = buildReportChartImage({
            symbol,
            date,
            bars: visible,
            ma,
            cacheControl: CHART_CACHE_CONTROL,
        });
        return (
            image ??
            new Response(null, {
                status: HTTP_STATUS_NOT_FOUND,
                headers: NO_STORE,
            })
        );
    } catch (error) {
        console.warn(`[email-report] chart render failed for ${symbol}`, error);
        return new Response(null, {
            status: HTTP_STATUS_NOT_FOUND,
            headers: NO_STORE,
        });
    }
}
