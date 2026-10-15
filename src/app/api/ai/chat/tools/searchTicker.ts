import 'server-only';
import { searchTicker } from '@/entities/ticker/lib/searchTicker';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';

const MAX_RESULTS = 8;

/**
 * 0건일 때 모델에게 주는 재시도 지시. 모델은 `실SQ`·`엔비디아`처럼 사용자가 한글로 옮긴
 * 회사명의 영문 원명(`SEALSQ`)을 대개 알고 있는데, 지시가 없으면 0건을 받자마자
 * 사용자에게 "정확한 종목명을 알려 달라"고 되묻는다.
 */
const NO_MATCH_HINT =
    'No match. Before asking the user, call search_ticker again with the company’s original English name or ticker if you can infer it (e.g. 실SQ → SEALSQ, 엔비디아 → NVIDIA).';

export const searchTickerTool: ToolExecutor = async args => {
    const results = await searchTicker(String(args.query));
    return {
        asOf: new Date().toISOString(),
        source: 'SIGLENS ticker search',
        ...(results.length === 0 ? { hint: NO_MATCH_HINT } : {}),
        results: results.slice(0, MAX_RESULTS).map(r => ({
            symbol: r.symbol,
            name: r.name,
            koreanName: r.koreanName ?? null,
            exchange: r.exchange,
            marketProfile: r.marketProfile ?? null,
        })),
    };
};
