/**
 * 최근 본 종목의 localStorage 저장/조회. 관심종목 로컬 저장(`localWatchlist.ts`)과 같은 방식이다 —
 * 저장소를 인자로 받아 SSR·테스트에서 주입하고, 읽기 파서는 방어적이다.
 *
 * "최근 검색"(`entities/ticker/lib/recentSearches.ts`)과는 다른 목록이다. 그쪽은 검색 결과를
 * **골랐을 때**만 남고, 이쪽은 어떤 경로로든 종목 페이지에 **들어갔을 때** 남는다.
 */
import { RECENT_SYMBOLS_MAX } from '@/shared/config/watchlist';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';
import { getDefaultLocalStorage, type StorageLike } from './browserStorage';

/** 최근 본 종목 한 건(저장 형식 그대로). `viewedAt`은 epoch ms. */
export interface RecentSymbolEntry {
    symbol: string;
    label: string;
    viewedAt: number;
}

function toEntry(item: unknown): RecentSymbolEntry[] {
    if (item === null || typeof item !== 'object') return [];
    if (!('symbol' in item) || typeof item.symbol !== 'string') return [];
    const symbol = item.symbol.trim().toUpperCase();
    if (symbol.length === 0) return [];
    const label =
        'label' in item && typeof item.label === 'string'
            ? item.label.trim()
            : '';
    const viewedAt =
        'viewedAt' in item &&
        typeof item.viewedAt === 'number' &&
        Number.isFinite(item.viewedAt)
            ? item.viewedAt
            : 0;
    return [{ symbol, label: label.length > 0 ? label : symbol, viewedAt }];
}

/** 저장된 원문을 최근 본 순 목록으로(심볼 중복 제거·상한까지). 깨진 값은 빈 목록이다. */
export function parseRecentSymbols(raw: string | null): RecentSymbolEntry[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const newestFirst = parsed
            .flatMap(toEntry)
            .toSorted((a, b) => b.viewedAt - a.viewedAt);
        // 같은 심볼은 가장 최근 것 하나만 — 최신순이라 첫 등장이 그것이다.
        return newestFirst
            .filter(
                (entry, index) =>
                    newestFirst.findIndex(e => e.symbol === entry.symbol) ===
                    index
            )
            .slice(0, RECENT_SYMBOLS_MAX);
    } catch {
        return [];
    }
}

/** 저장소에서 읽어 파싱한다. 저장소가 없거나 읽기가 던지면 빈 목록. */
export function readRecentSymbols(
    storage: StorageLike | null = getDefaultLocalStorage()
): RecentSymbolEntry[] {
    if (!storage) return [];
    try {
        return parseRecentSymbols(
            storage.getItem(LOCAL_STORAGE_RECENT_SYMBOLS_KEY)
        );
    } catch {
        return [];
    }
}

/**
 * 한 번 본 것으로 기록한다. 이미 있으면 맨 앞으로 옮기고(라벨은 새 값으로), 상한을 넘으면 가장
 * 오래된 것을 버린다. 저장에 실패하면 false — 기록은 보조 기능이라 호출부는 무시해도 된다.
 * `now`는 호출자가 넘긴다(테스트가 시계를 잡지 않게).
 */
export function recordRecentSymbol(
    entry: { symbol: string; label: string },
    now: number,
    storage: StorageLike | null = getDefaultLocalStorage()
): boolean {
    if (!storage) return false;
    const symbol = entry.symbol.trim().toUpperCase();
    if (symbol.length === 0) return false;
    const label = entry.label.trim();
    const next = [
        { symbol, label: label.length > 0 ? label : symbol, viewedAt: now },
        ...readRecentSymbols(storage).filter(item => item.symbol !== symbol),
    ].slice(0, RECENT_SYMBOLS_MAX);
    try {
        storage.setItem(LOCAL_STORAGE_RECENT_SYMBOLS_KEY, JSON.stringify(next));
        return true;
    } catch {
        return false;
    }
}
