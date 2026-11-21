import { constants } from 'node:http2';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';
import { SITEMAP_RETRY_AFTER_SECONDS } from '@/app/api/sitemap/_shared/constants';
import { FEAR_GREED_DATA_LOADERS } from '@/app/api/fear-greed/data/_lib/loaders';
import {
    FEAR_GREED_DATA_CACHE_CONTROL,
    toFearGreedCsv,
    toFearGreedJson,
} from '@/app/api/fear-greed/data/_lib/fearGreedDataFiles';
import { publishableHistory } from '@/entities/market-fear-greed/lib/publishableHistory';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import {
    fearGreedDataFileName,
    parseFearGreedDataParams,
} from '@/shared/config/fearGreedData';

const { HTTP_STATUS_NOT_FOUND, HTTP_STATUS_SERVICE_UNAVAILABLE } = constants;

// 허브와 같은 정적 캐시를 읽지만 응답은 요청마다 만든다. 빌드 시점에 굳히면 점수가 낡는다.
export const dynamic = 'force-dynamic';

const UNAVAILABLE_BODY = 'Fear and greed data temporarily unavailable';

/** 파일은 허브와 별개로 색인되면 안 된다(원본 데이터 파일이 검색 결과에 뜬다). */
const NOINDEX = { 'X-Robots-Tag': 'noindex' } as const;

const CONTENT_TYPE = {
    csv: 'text/csv; charset=utf-8',
    json: 'application/json; charset=utf-8',
} as const;

/**
 * 공포·탐욕 지수 기록 파일. `/fear-greed/data.csv` 등 여섯 공개 경로가 rewrite로 여기 닿는다
 * (`shared/config/fearGreedData.ts`).
 *
 * 기록이 공개 하한(`hasPublishableHistory`)을 못 넘으면 빈 파일을 200으로 내지 않고 503 +
 * `Retry-After`로 답한다. 장애 응답에는 `Cache-Control: no-store`를 둬 CDN이 굳히지 않게 한다.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ market: string; format: string }> }
): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) {
        // 호스트 거절도 모든 상태가 noindex를 달도록 같은 헤더를 붙인다.
        return new Response(null, {
            status: aiHostRejection.status,
            headers: NOINDEX,
        });
    }

    const { market: rawMarket, format: rawFormat } = await params;
    const parsed = parseFearGreedDataParams(rawMarket, rawFormat);
    if (parsed === null) {
        return new Response(null, {
            status: HTTP_STATUS_NOT_FOUND,
            headers: NOINDEX,
        });
    }
    const { market, format } = parsed;

    const view = await FEAR_GREED_DATA_LOADERS[market]().catch((e: unknown) => {
        console.error(
            '[fear-greed-data] load failed:',
            market,
            redactDbErrorForLog(e)
        );
        return null;
    });

    const history = view === null ? null : publishableHistory(view);
    if (history === null) {
        return new Response(UNAVAILABLE_BODY, {
            status: HTTP_STATUS_SERVICE_UNAVAILABLE,
            headers: {
                'Retry-After': SITEMAP_RETRY_AFTER_SECONDS,
                'Cache-Control': 'no-store',
                ...NOINDEX,
            },
        });
    }

    const body =
        format === 'csv'
            ? toFearGreedCsv(history.points)
            : JSON.stringify(toFearGreedJson(market, history));
    return new Response(body, {
        headers: {
            'Content-Type': CONTENT_TYPE[format],
            'Cache-Control': FEAR_GREED_DATA_CACHE_CONTROL,
            ...NOINDEX,
            'Content-Disposition': `inline; filename="${fearGreedDataFileName(market, format)}"`,
        },
    });
}
