import 'server-only';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import {
    resolveKrPageValuation,
    type KrPageValuation,
} from './withKrValuation';

/**
 * 로더가 "일시적 대체 값"(DART 오류·시한·종가 없음으로 제공처 값이 나온 결과)을 데이터 캐시에 넣지 않으려고 던지는 내부 신호. 던진 값은
 * `unstable_cache`가 저장하지 않으므로 이 값이 페이지 캐시(24h)에 굳지 않는다.
 */
class TransientKrValuation extends Error {
    constructor(readonly page: KrPageValuation) {
        super('kr valuation fell back transiently; not cached by the page');
        this.name = 'TransientKrValuation';
    }
}

/**
 * 펀더멘털 탭 한국 종목 밸류에이션 카드의 **페이지 캐시 로더** — 지표와 계산 기준이 한 캐시 엔트리(`fundamental:kr-valuation-v1`)에서 같이 나온다.
 * 일시적 대체 값은 캐시에 넣지 않고 `transient: true`로 돌려주므로 호출부가 이 렌더의 revalidate를 낮춘다(`loadPageGradesConsensus`와 같은 방식).
 * 반드시 서버 렌더에서만(데이터 캐시 스코프 안) 부른다.
 */
export async function loadPageKrValuation(
    symbol: string
): Promise<KrPageValuation> {
    try {
        return await staticSymbolCache(
            ['fundamental:kr-valuation-v1', symbol],
            symbol,
            async () => {
                const page = await resolveKrPageValuation(
                    getFundamentalDataProvider(symbol),
                    symbol
                );
                if (page.transient) throw new TransientKrValuation(page);
                return page;
            },
            [],
            SECONDS_PER_DAY
        );
    } catch (error) {
        if (error instanceof TransientKrValuation) return error.page;
        throw error;
    }
}
