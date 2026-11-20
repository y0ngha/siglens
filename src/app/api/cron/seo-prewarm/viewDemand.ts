import 'server-only';
import type { SymbolViewRepository } from '@/entities/symbol-view/api';
import type { SymbolViewTally } from '@/entities/symbol-view/types';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';

/**
 * 프리웜이 "실제로 조회가 있는 심볼"을 가리는 데 쓰는 조회 창(KST 일 수).
 *
 * 창은 **오늘(KST)과 그 앞 6개 날짜**다(`fromDate = 오늘 - (7 - 1)일`). 프리웜 창(UTC 20:30~00:59·
 * 04:05~05:55·10:05~12:55 = KST 05:30~09:59·13:05~14:55·19:05~21:55)에는 오늘 하루가 아직 부분
 * 집계라, 실효 창은 6일에 오늘 몇 시간을 더한 약 6.2~6.6일이다. "7일치"가 아니다.
 *
 * 입력은 `symbol_views_daily`의 일자별 합계뿐이다 — 방문자 식별자·IP·UA가 없는 집계 값이라
 * 크론 작업 순서를 정하는 데 읽어도 새로 처리하는 개인 정보가 없다.
 */
export const VIEW_DEMAND_LOOKBACK_DAYS = 7;
/** 창 안 합계가 이 값 이상이면 활성. 비콘이 브라우저당 심볼당 하루 한 번이라 "서로 다른 브라우저·날 2회". */
export const ACTIVE_MIN_VIEWS = 2;
/**
 * 활성 집합의 상한 — 조회수를 부풀려도 비용이 종전(전 심볼 매 세션)을 넘지 않게 하는 쪽의 안전판이다.
 * 상한 경계의 동률은 심볼 오름차순으로 끊긴다(저장소 `topViewed`의 정렬: 조회수 내림차순, 심볼 오름차순).
 */
export const ACTIVE_MAX_SYMBOLS = 120;
/** 종합 탭 사전 생성 대상의 상한(조회 많은 순). */
export const OVERALL_WARM_MAX_SYMBOLS = 20;

export interface ViewDemand {
    /** null = 집계를 읽지 못했다: 모든 심볼을 활성으로 본다(종전 동작). */
    readonly active: ReadonlySet<string> | null;
    /** 조회 많은 순 상위 심볼. 집계를 모르면 빈 배열. */
    readonly overallWarm: readonly string[];
}

/** 집계를 읽지 못한 때의 값 — 전부 활성, 종합 사전 생성 없음. */
export const VIEW_DEMAND_UNKNOWN: ViewDemand = {
    active: null,
    overallWarm: [],
};

/**
 * 집계 행에서 활성 집합과 종합 사전 생성 대상을 고른다. 순수 함수다.
 *
 * `tallies`는 저장소가 정렬한 순서를 그대로 믿고 다시 정렬하지 않는다(상한 동률 처리는
 * `ACTIVE_MAX_SYMBOLS` 주석). 유니버스 밖 심볼은 버린다
 * (프리웜이 만들지 않는 심볼이 상한 자리를 차지하면 안 된다).
 */
export function selectViewDemand(
    tallies: readonly SymbolViewTally[],
    universe: readonly string[]
): ViewDemand {
    const inUniverse = new Set(universe.map(symbol => symbol.toUpperCase()));
    const ranked = tallies
        .map(tally => tally.symbol.toUpperCase())
        .filter(symbol => inUniverse.has(symbol))
        .slice(0, ACTIVE_MAX_SYMBOLS);
    return {
        active: new Set(ranked),
        overallWarm: ranked.slice(0, OVERALL_WARM_MAX_SYMBOLS),
    };
}

/**
 * 조회 집계를 읽어 `ViewDemand`를 만든다. 어떤 오류든 삼키고 "전부 활성"으로 되돌린다 —
 * 집계는 비용을 줄이는 보조 입력이라, 못 읽는 날에 색인 대상이 묵는 쪽이 더 나쁘다.
 */
export async function loadViewDemand(
    repo: SymbolViewRepository,
    universe: readonly string[],
    now: Date
): Promise<ViewDemand> {
    try {
        const fromDate = kstDateKeyDaysBefore(
            kstDateKey(now),
            VIEW_DEMAND_LOOKBACK_DAYS - 1
        );
        const tallies = await repo.topViewed(fromDate, ACTIVE_MIN_VIEWS);
        // 창 안에 조회가 한 건도 없는 집계(유니버스 필터 **전**)는 "아무도 안 봤다"가 아니라 "비콘이 죽었다"로 본다.
        // 그대로 두면 7일 안에 전 심볼이 조용한 심볼이 되어 종전 동작으로 돌아간다는 약속이 깨지고, 신호는
        // `activeSymbols: 0` 하나뿐이다. 읽기 오류와 구분되도록 문구를 달리한다.
        if (tallies.length === 0) {
            console.warn(
                '[seo-prewarm] view tally empty, treating all symbols as active'
            );
            return VIEW_DEMAND_UNKNOWN;
        }
        return selectViewDemand(tallies, universe);
    } catch (error) {
        console.warn(
            '[seo-prewarm] view tally unavailable, treating all symbols as active',
            redactDbErrorForLog(error)
        );
        return VIEW_DEMAND_UNKNOWN;
    }
}
