import { NextResponse } from 'next/server';
import { buildStaticEntries, toUrlSetXml } from '@/entities/sitemap-entry';
import { loadStaticSitemapInputs } from '@/entities/sitemap-entry/server';
import {
    deriveBacktestStats,
    validateBacktestData,
} from '@/entities/backtest-case';
import backtestData from '@/app/[locale]/backtesting/data.json';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

// lastmod가 "직전 마감 세션"과 DB의 콘텐츠 갱신 시각에서 나오므로 빌드 시점
// prerender 불가. CDN max-age 1h + SWR 1h로 traffic 보호.
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    const inputs = await loadStaticSitemapInputs();
    const xml = toUrlSetXml(
        buildStaticEntries(new Date(), {
            ...inputs,
            // 화면이 쓰는 것과 같은 파생값 — `/backtesting` 본문은 이 정적 데이터가
            // 전부라 마지막 케이스 진입일이 곧 콘텐츠 갱신 시각이다.
            backtestingDataDate: backtestingDataDate(),
        })
    );
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}

/**
 * `data.json`의 마지막 진입일(`YYYY-MM-DD`)을 Date로. 비어 있으면 `undefined`를
 * 돌려 빌더가 `SITE_BUILD_DATE`로 폴백한다.
 */
function backtestingDataDate(): Date | undefined {
    const { periodEnd } = deriveBacktestStats(
        validateBacktestData(backtestData).cases
    );
    if (periodEnd === '') return undefined;
    const parsed = new Date(`${periodEnd}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
