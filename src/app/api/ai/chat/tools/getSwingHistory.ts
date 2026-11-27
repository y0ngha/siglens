import 'server-only';
import {
    SWING_LOOKBACK_YEARS,
    SWING_MIN_PCT,
    computeSwingHistory,
    type SwingHistory,
} from '@y0ngha/siglens-core';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { loadDailyCloseHistory } from '@/entities/bars/server/loadDailyCloseHistory';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { profileIdForSymbol } from '@/shared/config/marketProfile/registry';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import { logToolDegrade } from './logToolDegrade';
import {
    resolveAssetInfoOrNull,
    resolvedInstrumentFields,
} from './resolveAssetInfo';

const TOOL = 'get_swing_history';
const SOURCE = 'SIGLENS daily closes (price only)';
/**
 * 결과 캐시 TTL. 키에 마지막 마감 세션 날짜(EOD 게시 여유 포함)가 들어가 새 종가가 확정되면 키가 바뀐다. TTL은 같은 세션
 * 안에서 FMP가 그 세션 행을 늦게 고친 경우를 한 시간 안에 반영하는 상한이다. 실패는 캐시되지 않는다(`getOrSetCache`가 던진
 * fetcher를 저장하지 않는다).
 */
const RESULT_TTL_SECONDS = SECONDS_PER_HOUR;

/** 정수 인자를 범위 안에서 읽는다. 없으면 `fallback`, 범위 밖·정수 아님은 `null`(잘못된 인자). */
function integerArg<F extends number | undefined>(
    value: unknown,
    bounds: { min: number; max: number },
    fallback: F
): number | F | null {
    if (value === undefined) return fallback;
    return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= bounds.min &&
        value <= bounds.max
        ? value
        : null;
}

/**
 * 한 종목의 과거 스윙 통계(core `computeSwingHistory`: 완결된 하락·상승 구간과 지금 구간). 완결 일봉 종가 전체 이력을
 * 엔티티가 읽고(미국·크립토 FMP, 한국 Yahoo), 결과는 심볼·인자·세션 날짜 키로 한 시간 캐시한다. 이력이 없거나 core가
 * `null`(종가 둘 미만)이면 `found: false`, 로드 실패는 `provider_failed`다. 절대 던지지 않는다.
 */
export const getSwingHistoryTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    const minSwingPct = integerArg(
        args.minSwingPct,
        SWING_MIN_PCT,
        SWING_MIN_PCT.default
    );
    const lookbackYears = integerArg(
        args.lookbackYears,
        SWING_LOOKBACK_YEARS,
        undefined
    );
    if (minSwingPct === null || lookbackYears === null)
        return { error: 'invalid_args' };

    const asset = await resolveAssetInfoOrNull(symbol, TOOL);
    // 자산 조회가 실패하면 심볼 형상으로 시장을 고른다(한국 종목은 형상으로 알 수 있다). 크립토는 형상으로 알 수 없어 미국
    // 세션으로 떨어지므로, 그 결과는 캐시하지 않고 키에도 시장을 넣어 정상 조회 키와 섞이지 않게 한다(SERVER.md#DC-1).
    const profile =
        asset === null
            ? profileIdForSymbol(symbol)
            : marketProfileForAssetInfo(asset);
    const session = sessionSpecFor(profile);
    const now = new Date();
    const providerSymbol = asset?.fmpSymbol ?? symbol;
    const key = `agent:swing-history:v3:${profile}:${providerSymbol}:${minSwingPct}:${lookbackYears ?? 'all'}:${lastClosedSessionDate(session, now)}`;

    const history = await getOrSetCache<SwingHistory | null>(
        key,
        RESULT_TTL_SECONDS,
        async () =>
            computeSwingHistory(
                await loadDailyCloseHistory({
                    symbol: providerSymbol,
                    source: profile === 'kr-equity' ? 'yahoo' : 'fmp',
                    session,
                    now,
                }),
                {
                    minSwingPct,
                    ...(lookbackYears === undefined ? {} : { lookbackYears }),
                }
            ),
        () => asset !== null
    ).catch((error: unknown) => {
        logToolDegrade(TOOL, 'daily closes', error);
        return undefined;
    });
    if (history === undefined)
        return { symbol, available: false, reason: 'provider_failed' };
    if (history === null) return { symbol, found: false };
    return {
        asOf: history.lastDate,
        source: SOURCE,
        symbol,
        ...resolvedInstrumentFields(asset),
        ...history,
    };
};
