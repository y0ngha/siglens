import 'server-only';
import {
    findAgentTheme,
    summarizeTheme,
    type ThemeMemberCloses,
} from '@y0ngha/siglens-core';
import { lastBarIsForming } from '@/entities/bars/lib/quantizeBars';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { MS_PER_DAY, MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { logToolDegrade } from './logToolDegrade';
import { resolveAssetInfoOrNull } from './resolveAssetInfo';

const TOOL = 'get_theme_snapshot';
const SOURCE = 'SIGLENS theme basket (daily closes)';
/**
 * 동시에 읽는 종목 수(SERVER.md#CC-1). 바스켓이 최대 8종목이라 두 묶음이면 끝나고, 일봉은 종목별 캐시(EOD 이력 +
 * 오늘 시세)를 거치므로 따뜻한 캐시에서는 외부 요청이 거의 없다.
 */
const BARS_CONCURRENCY = 4;
/** 52주(252거래일) 고점과 20거래일 등락률을 덮는 달력 일수. 휴장일을 감안해 넉넉히 잡는다. */
const LOOKBACK_DAYS = 400;

/**
 * 종목 하나의 완결 일봉 종가(오래된 → 최신). 정규장 중이면 마지막 봉은 아직 끝나지 않은 봉이라 뺀다 —
 * core 집계의 "1일" 등락률은 완결된 두 종가 사이여야 한다. 실패는 빈 종가로 돌려 `missing`에 들어가게 한다.
 */
async function loadMemberCloses(
    symbol: string,
    market: 'us' | 'kr',
    now: Date
): Promise<ThemeMemberCloses> {
    const session = sessionSpecFor(market === 'kr' ? 'kr-equity' : 'us-equity');
    const provider = getCachedMarketDataProvider(session);
    const [bars, asset] = await Promise.all([
        provider
            .getBars({
                symbol,
                timeframe: '1Day',
                from: new Date(
                    now.getTime() - LOOKBACK_DAYS * MS_PER_DAY
                ).toISOString(),
            })
            .catch((error: unknown) => {
                logToolDegrade(TOOL, 'daily bars', error);
                return [];
            }),
        resolveAssetInfoOrNull(symbol, TOOL),
    ]);
    const completed = lastBarIsForming(bars, session, now)
        ? bars.slice(0, -1)
        : bars;
    const last = completed.at(-1);
    return {
        symbol,
        name: asset?.koreanName ?? asset?.name ?? null,
        closes: completed.map(bar => bar.close),
        lastDate:
            last === undefined
                ? null
                : toUtcIsoDate(new Date(last.time * MS_PER_SECOND)),
    };
}

/**
 * SIGLENS가 고른 테마 바스켓의 최근 흐름(core `summarizeTheme`). 종목별 완결 일봉 종가를 읽어 넘기고, 집계·정렬은
 * core가 한다. 일부 종목을 못 읽으면 `missing`에 실리고, 하나도 못 읽으면 `provider_failed`다. 절대 던지지 않는다.
 */
export const getThemeSnapshotTool: ToolExecutor = async args => {
    const theme =
        typeof args.theme === 'string' ? findAgentTheme(args.theme) : undefined;
    if (theme === undefined) return { error: 'invalid_args' };
    const now = new Date();
    const settled = await withConcurrencyLimit(
        theme.symbols,
        BARS_CONCURRENCY,
        symbol => loadMemberCloses(symbol, theme.market, now)
    );
    const members = theme.symbols.map((symbol, index): ThemeMemberCloses => {
        const result = settled[index];
        if (result?.status === 'fulfilled') return result.value;
        logToolDegrade(TOOL, 'member', result?.reason);
        return { symbol, name: null, closes: [], lastDate: null };
    });
    const snapshot = summarizeTheme(theme, members);
    if (snapshot.members.length === 0)
        return { theme: theme.id, available: false, reason: 'provider_failed' };
    return {
        asOf: now.toISOString(),
        source: SOURCE,
        available: true,
        ...snapshot,
    };
};
