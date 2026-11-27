import 'server-only';
import {
    __resetMemoryLruForTests,
    createMemoryLru,
} from '@/shared/cache/memoryLru';
import { MS_PER_MINUTE } from '@/shared/config/time';

/**
 * `web_search` 결과의 프로세스 로컬 일시 캐시.
 *
 * Brave 약관은 검색 결과를 "일시 저장" 밖으로 보관·캐시하는 것을 막는다. 그래서 이 캐시는 인스턴스 메모리의 LRU
 * 하나뿐이다 — Redis·DB에 넣지 않고, TTL은 15분(`freshness: day`는 5분), 200항목이다. 프로세스가 내려가면 사라지고
 * 인스턴스끼리 공유되지 않는다. 목적은 같은 질의를 한 대화 안에서 다시 보낼 때(재생성, 편집)와 한 단계 안의 동일한
 * 병렬 호출에서 Brave 요청과 페이지 발췌를 아끼는 것이다.
 *
 * 저장하는 것은 성공한 결과뿐이다(오류·`unavailable`은 저장하지 않는다).
 */
const MAX_ENTRIES = 200;
const DEFAULT_TTL_MS = 15 * MS_PER_MINUTE;
const DAY_FRESHNESS_TTL_MS = 5 * MS_PER_MINUTE;

const lru = createMemoryLru<unknown>(MAX_ENTRIES);
const inFlight = new Map<string, Promise<unknown>>();

export interface SearchCacheKeyParts {
    query: string;
    freshness: unknown;
    /** Brave `search_lang`. */
    searchLang: 'ko' | 'en';
    braveConfigured: boolean;
    naverConfigured: boolean;
}

/**
 * 키 = 정규화한 질의(앞뒤 공백 제거, 연속 공백 접기, ASCII만 소문자) + freshness + `search_lang` + 어떤 제공자가
 * 켜져 있는지. 제공자 구성이 키에 들어가므로 키가 없던 때 저장된 Naver-only 결과가 키가 생긴 뒤에도 나가지 않는다.
 */
export function searchCacheKey(parts: SearchCacheKeyParts): string {
    const query = parts.query
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[A-Z]/g, c => c.toLowerCase());
    const freshness =
        parts.freshness === 'day' ||
        parts.freshness === 'week' ||
        parts.freshness === 'month'
            ? parts.freshness
            : 'any';
    const providers = `${parts.braveConfigured ? 'b' : '-'}${parts.naverConfigured ? 'n' : '-'}`;
    return `${providers}|${parts.searchLang}|${freshness}|${query}`;
}

export function ttlMsFor(freshness: unknown): number {
    return freshness === 'day' ? DAY_FRESHNESS_TTL_MS : DEFAULT_TTL_MS;
}

export function getCachedSearch<T>(key: string): T | undefined {
    return lru.get(key) as T | undefined;
}

export function setCachedSearch<T>(
    key: string,
    value: T,
    freshness: unknown
): void {
    lru.set(key, value, ttlMsFor(freshness));
}

/**
 * 같은 키의 진행 중인 조회를 하나로 접는다. 소유자의 인자(신호·예산 청구)가 대기자 전원에게 적용된다 —
 * 소유자 턴이 중단되면 대기자도 그 결과를 받는다(`getOrSetCache`의 in-flight 공유와 같은 결합).
 * @returns `shared`: 다른 호출이 이미 진행 중이어서 기다렸는가.
 */
export async function shareInFlight<T>(
    key: string,
    produce: () => Promise<T>
): Promise<{ value: T; shared: boolean }> {
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing !== undefined) return { value: await existing, shared: true };
    const pending = produce();
    inFlight.set(key, pending);
    try {
        return { value: await pending, shared: false };
    } finally {
        inFlight.delete(key);
    }
}

/** 테스트 전용 — 캐시와 진행 중 맵을 비운다. */
export function __resetWebSearchCacheForTests(): void {
    inFlight.clear();
    __resetMemoryLruForTests(lru);
}
