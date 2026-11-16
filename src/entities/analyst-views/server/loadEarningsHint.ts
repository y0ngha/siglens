import 'server-only';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { withTimeout } from '@/shared/lib/withTimeout';
import type { AnalystEarningsHint } from '../model';
import { getAnalystViews } from './getAnalystViews';

/** 실적 힌트(Yahoo) 보강에 기다리는 최대 시간. 페이지·분석이 보강 때문에 8초씩 기다리지 않게 한다. */
export const EARNINGS_HINT_BUDGET_MS = 2_500;

/**
 * 12시간 캐시 키. 펀더멘털 탭 사실 블록이 먼저 쓰던 이름을 그대로 둔다 — 이미 쌓인 엔트리를 재사용하고, 세 표면
 * (사실 블록·뉴스 탭 실적 카드·AI 분석)이 같은 엔트리를 읽어 같은 날짜를 말한다.
 */
const EARNINGS_HINT_CACHE_KEY = 'fundamental-facts:earnings-hint';

/**
 * `staticSymbolCache` 안에서만 돈다. Yahoo가 실패하면 던져서 `null`이 12시간 캐시에 굳지 않게 한다("힌트 없음"은
 * 정상 `null`).
 */
async function loadEarningsHint(
    symbol: string
): Promise<AnalystEarningsHint | null> {
    const views = await getAnalystViews(symbol, { detail: 'lite' });
    if (views.degraded.includes('yahoo')) {
        throw new Error(`Yahoo earnings hint unavailable for ${symbol}`);
    }
    return views.earnings;
}

/**
 * Yahoo 실적 힌트(확정 여부·세션). DB/FMP 일정과 `resolveNextEarnings`로 대조하는 보강 전용 입력이다 — 한국
 * 종목(프로바이더가 이미 Yahoo)과 E2E에서는 부르지 않고, 실패·시간 초과는 `null`이라 호출자는 기존 일정을 그대로
 * 쓴다. 시간 초과 뒤에도 로드는 뒤에서 마저 돌아 캐시를 채운다(`withTimeout`은 취소하지 않는다).
 */
export async function loadEarningsHintBounded(
    symbol: string
): Promise<AnalystEarningsHint | null> {
    if (isKrEquitySymbol(symbol) || isE2EFakeMode()) return null;
    try {
        return await withTimeout(
            staticSymbolCache(
                [EARNINGS_HINT_CACHE_KEY, symbol],
                symbol,
                () => loadEarningsHint(symbol),
                [],
                SECONDS_PER_HALF_DAY
            ),
            EARNINGS_HINT_BUDGET_MS,
            null
        );
    } catch (err) {
        console.warn(`[loadEarningsHint] failed for ${symbol}:`, err);
        return null;
    }
}
