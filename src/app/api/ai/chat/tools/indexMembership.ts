import 'server-only';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    fetchIndexConstituents,
    INDEX_IDS,
    normalizeIndexSymbol,
    type IndexId,
} from '@/shared/api/wikipedia/indexConstituents';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { ET_TIME_ZONE } from '@/entities/options-chain/lib/etTimeZone';
import { zonedDate } from '@/shared/lib/marketSessionDate';

export interface IndexMemberships {
    sp500: boolean;
    nasdaq100: boolean;
    dowJones: boolean;
    /** 목록을 읽은 날(`YYYY-MM-DD`, ET). 목록은 하루 캐시라 최대 하루 묵을 수 있다. */
    asOf: string;
    source: 'wikipedia';
}

const INDEX_CACHE_TTL_SECONDS = SECONDS_PER_DAY;
/**
 * 실패 sentinel(`null`)을 잠깐 캐시한다. 선택적 보강이 Wikipedia 장애·429 중에 호출마다 다시 읽어
 * 재시도 폭풍을 만들거나 도구 응답을 늦추지 않게 한다. 짧아서 복구는 곧 반영된다.
 */
export const INDEX_FAILURE_CACHE_TTL_SECONDS = 90;
// 캐시 키 버전 규칙: 파서 규칙이나 저장 값 형태(string[] | null)가 바뀌어 목록 의미가 달라지면 같은
// PR에서 `v1`을 올린다. 안 올리면 옛 형태가 TTL(하루) 동안 남는다.
const indexCacheKey = (index: IndexId): string =>
    `index-constituents:v1:${index}`;

/**
 * 지수당 Redis 키 하나(종목별 아님)에 하루 캐시한다. fetch가 실패하면(HTTP 오류·구조 변경·개수 이상)
 * 목록 대신 `null` sentinel을 짧게 캐시하고, 호출부는 이를 던져 `indexMemberships: null`로 degrade한다.
 */
function loadConstituents(index: IndexId): Promise<string[] | null> {
    return getOrSetCache<string[] | null>(
        indexCacheKey(index),
        list =>
            list === null
                ? INDEX_FAILURE_CACHE_TTL_SECONDS
                : INDEX_CACHE_TTL_SECONDS,
        () =>
            fetchIndexConstituents(index).catch((error: unknown) => {
                // 원인(429·표 구조 변경·개수 이상·타임아웃)을 지수 id와 함께 남긴다. 호출부 로그는
                // 일반 메시지뿐이라 이 줄이 없으면 어느 지수가 왜 실패했는지 볼 수 없다.
                console.error(
                    '[indexMembership] constituents fetch failed:',
                    index,
                    error instanceof Error ? error.name : 'unknown'
                );
                return null;
            })
    );
}

/**
 * 미국 종목의 S&P 500·Nasdaq-100·Dow 편입 여부. 한국 종목은 해당 없음이라 `null`이고, 세 목록 중
 * 하나라도 못 읽으면 일부만 `false`로 내보내 "미편입"으로 읽히지 않게 전체를 던진다(호출부가 `null`로 degrade).
 */
export async function loadIndexMemberships(
    symbol: string,
    now: Date = new Date()
): Promise<IndexMemberships | null> {
    if (isKrEquitySymbol(symbol)) return null;
    const lists = new Map(
        await Promise.all(
            INDEX_IDS.map(async id => [id, await loadConstituents(id)] as const)
        )
    );
    const target = normalizeIndexSymbol(symbol);
    // 지수 id로 조회한다(INDEX_IDS 순서에 기대지 않음). 목록 하나라도 없으면 부분 false가 아니라 전체를 던진다.
    const isMember = (id: IndexId): boolean => {
        const list = lists.get(id);
        if (list === null || list === undefined)
            throw new Error('index constituents unavailable');
        return list.includes(target);
    };
    return {
        sp500: isMember('sp500'),
        nasdaq100: isMember('nasdaq100'),
        dowJones: isMember('dowJones'),
        asOf: zonedDate(now, ET_TIME_ZONE),
        source: 'wikipedia',
    };
}
