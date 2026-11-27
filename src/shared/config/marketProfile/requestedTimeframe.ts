import type { Timeframe } from '@y0ngha/siglens-core';
import { DEFAULT_TIMEFRAME, isValidTimeframe } from '@/shared/config/market';

/**
 * `?tf=` 쿼리를 차트·종합 탭이 쓸 타임프레임으로 정한다. 유효하지 않거나 종목의 시장 프로필이
 * 허용하지 않는 프레임(한국 종목의 `4Hour`, 크립토의 `15Min` 등 — 제공처가 빈 봉을 돌려준다)은
 * 기본 프레임으로 떨어뜨린다. 두 탭이 같은 규칙을 쓰도록 한 곳에 둔다.
 *
 * @param allowedTimeframes - 시장 프로필 `allowedTimeframes`.
 */
export function requestedTimeframeOf(
    tf: string | null | undefined,
    allowedTimeframes: readonly Timeframe[]
): Timeframe {
    return isValidTimeframe(tf) && allowedTimeframes.includes(tf)
        ? tf
        : DEFAULT_TIMEFRAME;
}
