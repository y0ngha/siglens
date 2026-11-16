import 'server-only';
import { getYahooClient } from './createYahooClient';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { sym } from '@/shared/api/fmp/symKey';
import { toFiniteNumber } from '@/shared/api/fmp/toFiniteNumber';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { isRecord } from '@/shared/lib/isRecord';
import { toYahooSymbol } from '@/shared/lib/yahooSymbol';
import { fractionToPct } from './yahooValues';

const yahooFinance = getYahooClient();

/** 보유 비율은 분기 보고(13F 등)를 모은 값이라 하루에 한 번이면 충분하다. */
const OWNERSHIP_TTL_SECONDS = SECONDS_PER_DAY;

/** Yahoo `majorHoldersBreakdown` — 비율은 퍼센트(71.2 = 71.2%)로 바꿔 둔다. */
export interface YahooOwnershipShares {
    institutionsPct: number | null;
    institutionsFloatPct: number | null;
    insidersPct: number | null;
    institutionCount: number | null;
}

function mapOwnership(raw: unknown): YahooOwnershipShares | null {
    const record = isRecord(raw) ? raw.majorHoldersBreakdown : undefined;
    if (!isRecord(record)) return null;
    const shares = {
        institutionsPct: fractionToPct(record.institutionsPercentHeld),
        institutionsFloatPct: fractionToPct(
            record.institutionsFloatPercentHeld
        ),
        insidersPct: fractionToPct(record.insidersPercentHeld),
        institutionCount: toFiniteNumber(record.institutionsCount),
    };
    return Object.values(shares).every(value => value === null) ? null : shares;
}

/**
 * 기관·내부자 보유 비율과 보유 기관 수(Yahoo Finance 집계, 미국 종목용). 비공식 출처라 공개 API 경로에서는 부르지 않는다
 * (호출부의 `allowUnofficialSources` 게이트). 던지지 않는다: 실패는 경고를 남기고 `null`("이번에는 못 읽음")이며 캐시하지
 * 않는다. 값이 하나도 없는 응답도 `null`이다. E2E fake 모드에서는 네트워크에 나가지 않는다.
 */
export async function getYahooOwnershipShares(
    symbol: string
): Promise<YahooOwnershipShares | null> {
    if (isE2EFakeMode()) return null;
    const yahooSymbol = toYahooSymbol(sym(symbol));
    try {
        return await getOrSetCache<YahooOwnershipShares | null>(
            `yahoo:ownership-shares:v1:${sym(symbol)}`,
            OWNERSHIP_TTL_SECONDS,
            async () =>
                mapOwnership(
                    await yahooFinance.quoteSummary(
                        yahooSymbol,
                        { modules: ['majorHoldersBreakdown'] },
                        { validateResult: false }
                    )
                ),
            value => value !== null
        );
    } catch (error) {
        console.warn('[yahooOwnership] lookup failed', yahooSymbol, {
            errorName: error instanceof Error ? error.name : 'unknown',
        });
        return null;
    }
}
