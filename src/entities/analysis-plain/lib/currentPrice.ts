import 'server-only';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { collectNumbers } from './collectFacts';

/**
 * 시세 조회 상한. `resolveHoldingPositionBucket`과 같은 값이다. 시세가 느릴 때
 * 평이화 마감(15초)을 잠식하면 안 된다.
 */
const QUOTE_LOOKUP_TIMEOUT_MS = 5_000;

/**
 * 평이화 프롬프트에 실을 현재 주가. 실패하면 `undefined`.
 *
 * `fundamental`·`news`·`financials` payload에는 숫자 필드가 하나도 없어, 이 값이
 * 없으면 모델이 현재가를 쓸 방법이 없다. 블라인드 평가자 둘 다 같은 지점에서
 * 막혔다 — "목표주가는 나오는데 현재 주가가 없어서 싸다는 말이 진짜인지 판단이
 * 안 된다."
 *
 * ⚠️ **SSE 라우트와 프리웜 harvest가 함께 쓴다.** 라우트에만 있던 때 프리웜이
 * 이 값을 넘기지 않았고, 그 결과 프리웜이 구운 fundamental 평이화가
 * `"현재 주가가 어느 수준인지는 제시된 자료에 명시되어 있지 않지만"`으로
 * 시작했다 — 그 문장이 그대로 검색 스니펫에 실린다. 두 경로가 갈리지 않도록
 * 여기 한 곳에 둔다.
 *
 * **payload에 숫자가 하나라도 있으면 조회하지 않는다.** `technical`은
 * `planCheck.currentPrice`를 이미 담고 있어(실측 74/86) 조회가 순수 낭비다.
 * 이 가드가 없으면 모든 분석이 시세를 한 번씩 더 부른다.
 *
 * 조회 실패는 평이화를 막지 않는다 — 현재가 없이 그대로 진행한다.
 */
export async function resolveCurrentPrice(
    symbol: string,
    payload: unknown
): Promise<number | undefined> {
    if (collectNumbers(payload).size > 0) return undefined;
    try {
        const profile = await resolveMarketProfile(symbol);
        const provider = getCachedMarketDataProvider(sessionSpecFor(profile));
        const quote = await Promise.race([
            provider.getQuote(symbol),
            new Promise<null>(resolve => {
                setTimeout(
                    () => resolve(null),
                    QUOTE_LOOKUP_TIMEOUT_MS
                ).unref();
            }),
        ]);
        const price = quote?.price;
        return typeof price === 'number' && Number.isFinite(price) && price > 0
            ? price
            : undefined;
    } catch {
        return undefined;
    }
}
