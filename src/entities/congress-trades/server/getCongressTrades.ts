import { normalizeCongressTrades } from '@y0ngha/siglens-core';
import type { CongressTrade, RawCongressTrade } from '@y0ngha/siglens-core';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/** 챔버별 FMP 조회 상한. FMP가 100건 이상 돌려줄 수 있어 성능을 위해 50건으로 자른다. */
export const CONGRESS_TRADE_LIMIT = 50;

/**
 * 종목 상세 `congress` 탭과 에이전트 도구용 의회 거래 조회. 상원·하원 원본을
 * 각각 `staticSymbolCache`(24h)로 읽어 core `normalizeCongressTrades`로 한 번만
 * 정규화한다. 두 챔버가 `congress:<SYMBOL>` 그룹 태그를 공유해 한 번에 무효화할 수 있다.
 * 한쪽 챔버라도 실패하면 reject — 실패 처리는 `getCongressTradesResilient`가 맡는다.
 */
export async function getCongressTrades(
    symbol: string
): Promise<CongressTrade[]> {
    const upper = symbol.toUpperCase();
    const provider = getCongressTradesProvider();
    const groupTag = `congress:${upper}`;
    const fetchChamber = (
        chamber: 'senate' | 'house'
    ): Promise<RawCongressTrade[]> =>
        staticSymbolCache<RawCongressTrade[]>(
            [`congress:${chamber}`, upper],
            upper,
            () => provider.getTrades(upper, chamber, CONGRESS_TRADE_LIMIT),
            [groupTag],
            SECONDS_PER_DAY
        );

    const [senate, house] = await Promise.all([
        fetchChamber('senate'),
        fetchChamber('house'),
    ]);

    // 빈 입력이면 throw 없이 []를 돌려준다
    return normalizeCongressTrades(senate, house);
}
