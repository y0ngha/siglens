import { constants } from 'node:http2';
import { loadBarsData } from '@/entities/bars/server/loadBarsData';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { barsUpToDate } from '@/entities/email-report/lib/barsUpToDate';
import { REPORT_CHART_MA_PERIODS } from '@/entities/email-report/lib/chartGeometry';
import {
    CHART_ANALYSIS_AT_RE,
    chartSignatureValue,
} from '@/entities/email-report/lib/reportLinks';
import { verifyReportValue } from '@/entities/email-report/lib/reportSignature';
import { buildReportChartImage } from '@/entities/email-report/server/buildReportChartImage';
import { loadChartDrawings } from '@/app/api/email-report/chart/_lib/loadChartDrawings';
import { SYMBOL_EDGE_RE } from '@/shared/config/ticker';
import { runAsBatchWork } from '@/shared/lib/renderBudget';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

const { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_NOT_FOUND } = constants;

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * URL이 `(symbol, date, 분석 시각)`으로 고정되고 그날까지의 봉과 그 분석의 작도만 그리므로 내용이 바뀌지 않는다 —
 * CDN·메일 클라이언트 프록시(Gmail 등)가 오래 들고 있어도 된다.
 */
const CHART_CACHE_CONTROL = 'public, max-age=604800, immutable'; // 7d
const NO_STORE = { 'cache-control': 'no-store' };

/**
 * 메일 리포트의 일봉 차트 PNG.
 *
 * 로그인 없이 열린다(메일 클라이언트는 쿠키 없이 이미지를 받는다). 대신 발송 cron이
 * 서명한 `(symbol, date[, a])`만 그린다 — 서명이 없으면 아무 종목이나 FMP 조회와 이미지
 * 렌더를 시킬 수 있는 공개 엔드포인트가 된다.
 *
 * `a`(분석 시각, epoch 밀리초)가 있으면 발송 때 고른 분석의 작도를 함께 그린다 — 최신 분석이 아니라 그 행이다.
 * `a`가 없는 옛 메일의 URL은 작도 없이 캔들·이동평균만 그린다. 행이 없어도(보존 기간 경과) 같은 이미지(200, 불변 캐시)다.
 * 행을 읽다 실패하면 작도 없는 이미지를 `no-store`로 보낸다 — 다음에 열 때 다시 읽는다.
 */
export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('s') ?? '';
    const date = url.searchParams.get('d') ?? '';
    const analysisAt = url.searchParams.get('a');
    const signature = url.searchParams.get('sig') ?? '';
    const secret = readEmailReportSecret();

    if (
        secret === null ||
        !SYMBOL_EDGE_RE.test(symbol) ||
        !DATE_RE.test(date) ||
        (analysisAt !== null && !CHART_ANALYSIS_AT_RE.test(analysisAt)) ||
        !verifyReportValue(
            secret,
            'chart',
            chartSignatureValue(symbol, date, analysisAt),
            signature
        )
    ) {
        return new Response(null, {
            status: HTTP_STATUS_FORBIDDEN,
            headers: NO_STORE,
        });
    }

    try {
        const [{ bars, indicators }, load] = await Promise.all([
            runAsBatchWork(() => loadBarsData(symbol, '1Day')),
            analysisAt === null
                ? null
                : loadChartDrawings(symbol, new Date(Number(analysisAt))),
        ]);
        // 작도를 못 읽은 이미지는 불변으로 캐시하면 CDN·메일 프록시에 영원히 남는다 — 이번 응답만 쓰게 한다.
        const drawingsFailed = load?.status === 'failed';
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
            drawings: load?.status === 'ok' ? load.drawings : null,
            cacheControl: drawingsFailed
                ? NO_STORE['cache-control']
                : CHART_CACHE_CONTROL,
        });
        return (
            image ??
            new Response(null, {
                status: HTTP_STATUS_NOT_FOUND,
                headers: NO_STORE,
            })
        );
    } catch (error) {
        console.warn(
            `[email-report] chart render failed for ${symbol}`,
            redactDbErrorForLog(error)
        );
        return new Response(null, {
            status: HTTP_STATUS_NOT_FOUND,
            headers: NO_STORE,
        });
    }
}
