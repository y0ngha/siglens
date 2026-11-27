import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/server/optionsDataCache';
import type { SlottedOptionsSnapshot } from '@/entities/options-chain/lib/optionsSlots';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * 옵션 탭 정적 캐시(`options:has`·`options:snapshot-v2`)의 revalidate. `[symbol]` 탭 revalidate clamp 가드가 이 값을 직접 읽는다.
 */
export const OPTIONS_REVALIDATE_SECONDS = SECONDS_PER_HALF_DAY;

/**
 * 옵션 시장 여부(`options:has`, 12h). `hasOptionsMarket`은 Yahoo 인프라 실패 시 throw하므로 여기서
 * 로그 후 `false`로 흡수한다 — 메타데이터는 cold-gen 500 대신 noindex로, 본문은 빈 상태 화면으로
 * 떨어진다. 둘이 같은 키라 한 렌더에서 같은 엔트리를 읽는다.
 *
 * @param failureLog 호출부(메타데이터·본문)를 구분하는 로그 접두.
 */
export function loadHasOptionsMarket(
    symbol: string,
    failureLog: string
): Promise<boolean> {
    return staticSymbolCache(
        ['options:has', symbol],
        symbol,
        () => hasOptionsMarket(symbol),
        [],
        OPTIONS_REVALIDATE_SECONDS
    ).catch((e: unknown) => {
        console.error(failureLog, redactDbErrorForLog(e));
        return false;
    });
}

/**
 * 옵션 체인 스냅샷(`options:snapshot-v2`, 12h). Yahoo 실패는 로그 후 `null`로 흡수해 본문이 빈 상태
 * 화면으로 떨어진다 — throw가 ISR 캐시에 빈 결과를 굳히지 않게 한다.
 *
 * `-v2`: 호가 없는·0에 가까운 체인의 IV를 `null`로 바꿨다(`yahooNormalize`) — 옛 엔트리는 가짜 IV를 담는다.
 */
export function loadOptionsSnapshot(
    symbol: string
): Promise<SlottedOptionsSnapshot | null> {
    return staticSymbolCache(
        ['options:snapshot-v2', symbol],
        symbol,
        () => fetchOptionsSnapshot(symbol),
        [],
        OPTIONS_REVALIDATE_SECONDS
    ).catch((e: unknown) => {
        console.error(
            '[OptionsPage] fetchOptionsSnapshot failed, degrading to null:',
            redactDbErrorForLog(e)
        );
        return null;
    });
}
