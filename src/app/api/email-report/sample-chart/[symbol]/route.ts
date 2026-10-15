import { constants } from 'node:http2';
import { buildReportChartImage } from '@/entities/email-report/lib/buildReportChartImage';
import {
    buildSampleBars,
    buildSampleChartMa,
    isSampleChartSymbol,
    SAMPLE_CHART_SYMBOLS,
    SAMPLE_REPORT_DATE,
} from '@/entities/email-report/lib/sampleReportData';

const { HTTP_STATUS_NOT_FOUND } = constants;

/**
 * 비회원용 샘플 메일의 차트 이미지. 데이터 제공자를 부르지 않는다 — 봉은 저장소에 박힌
 * 고정 샘플이고 심볼 두 개뿐이라 빌드 때 정적으로 만들어 CDN이 그대로 서빙한다.
 * 실제 메일의 `/api/email-report/chart`와 달리 서명이 필요 없다: 입력이 닫힌 집합이라
 * 임의 종목 조회·렌더를 시킬 방법이 없다.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

const SAMPLE_CHART_CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400'; // 1d

export function generateStaticParams(): Array<{ symbol: string }> {
    return SAMPLE_CHART_SYMBOLS.map(symbol => ({ symbol }));
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ symbol: string }> }
): Promise<Response> {
    const { symbol } = await params;
    if (!isSampleChartSymbol(symbol)) {
        return new Response(null, { status: HTTP_STATUS_NOT_FOUND });
    }
    const bars = buildSampleBars(symbol);
    const image = buildReportChartImage({
        symbol,
        date: SAMPLE_REPORT_DATE,
        bars,
        ma: buildSampleChartMa(bars),
        cacheControl: SAMPLE_CHART_CACHE_CONTROL,
    });
    return image ?? new Response(null, { status: HTTP_STATUS_NOT_FOUND });
}
