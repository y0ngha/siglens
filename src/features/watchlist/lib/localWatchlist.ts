/**
 * 비회원 관심종목의 localStorage 저장/조회. `entities/watchlist/lib`가 아니라 여기인 이유:
 * localStorage는 부수효과라 entity `lib/`에 둘 수 없다(EN-1). 저장소를 인자로 받아
 * SSR·테스트에서 주입 가능하게 한다(`entities/ticker/lib/recentSearches.ts` 패턴).
 *
 * 저장 형식 `Array<{ symbol, label, addedAt }>` — `addedAt`은 epoch ms. 읽기 파서는 방어적이다:
 * 손으로 고친 값·옛 번들이 쓴 값이 와도 빈 칩이나 예외가 아니라 살릴 수 있는 항목만 살린다.
 */
import { WATCHLIST_MAX_LOCAL } from '@/shared/config/watchlist';
import { LOCAL_STORAGE_WATCHLIST_KEY } from '@/shared/lib/storageKeys';
import type { WatchlistItemView } from '@/entities/watchlist/model';

/** `Date`가 표현하는 최대 epoch ms. 넘으면 `toISOString()`이 RangeError를 던진다(NaN·Infinity는 이 비교에서 걸러진다). */
const MAX_DATE_MS = 8.64e15;

export interface LocalWatchlistEntry {
    symbol: string;
    label: string;
    addedAt: number;
}

export interface LocalWatchlistAddResult {
    entries: LocalWatchlistEntry[];
    /** 새로 들어갔는가. 이미 있거나 상한이면 false. */
    added: boolean;
}

export interface LocalWatchlistRemoveResult {
    entries: LocalWatchlistEntry[];
    /** 저장까지 끝났는가. 쓰기에 실패하면 false(목록은 그대로). */
    removed: boolean;
}

export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function toEntry(item: unknown): LocalWatchlistEntry[] {
    if (item === null || typeof item !== 'object') return [];
    if (!('symbol' in item) || typeof item.symbol !== 'string') return [];
    const symbol = item.symbol.trim().toUpperCase();
    if (symbol.length === 0) return [];
    const label =
        'label' in item && typeof item.label === 'string'
            ? item.label.trim()
            : '';
    const addedAt =
        'addedAt' in item &&
        typeof item.addedAt === 'number' &&
        Math.abs(item.addedAt) <= MAX_DATE_MS
            ? item.addedAt
            : 0;
    return [{ symbol, label: label.length > 0 ? label : symbol, addedAt }];
}

/** 최신 것만 남기며 심볼 중복을 제거한다(입력은 addedAt 내림차순이어야 한다). */
function dedupeNewest(entries: LocalWatchlistEntry[]): LocalWatchlistEntry[] {
    const seen = new Set<string>();
    return entries.filter(entry => {
        if (seen.has(entry.symbol)) return false;
        seen.add(entry.symbol);
        return true;
    });
}

export function parseLocalWatchlist(raw: string | null): LocalWatchlistEntry[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // `toSorted`는 `legacyBrowserPolyfills`가 채운다(Chrome 109·iOS 15).
        const sorted = parsed
            .flatMap(toEntry)
            .toSorted((a, b) => b.addedAt - a.addedAt);
        return dedupeNewest(sorted).slice(0, WATCHLIST_MAX_LOCAL);
    } catch {
        return [];
    }
}

export function readLocalWatchlist(
    storage: StorageLike | null = getDefaultStorage()
): LocalWatchlistEntry[] {
    if (!storage) return [];
    try {
        return parseLocalWatchlist(
            storage.getItem(LOCAL_STORAGE_WATCHLIST_KEY)
        );
    } catch {
        return [];
    }
}

/** 저장 성공 여부. quota 초과·차단된 저장소면 false — 호출부가 성공으로 보고하지 않게 한다. */
function write(storage: StorageLike, entries: LocalWatchlistEntry[]): boolean {
    try {
        storage.setItem(LOCAL_STORAGE_WATCHLIST_KEY, JSON.stringify(entries));
        return true;
    } catch {
        return false;
    }
}

/**
 * 한 건 담는다. `now`는 호출자가 넘긴다(`Date.now()`를 여기서 부르면 테스트가 시계를 잡아야 한다).
 * 라벨이 비면 정규화한 심볼이 라벨이다 — `aapl`처럼 소문자 입력이 칩에 그대로 뜨지 않게.
 */
export function addLocalWatchlistEntry(
    entry: { symbol: string; label: string },
    now: number,
    storage: StorageLike | null = getDefaultStorage()
): LocalWatchlistAddResult {
    if (!storage) return { entries: [], added: false };
    const symbol = entry.symbol.trim().toUpperCase();
    const current = readLocalWatchlist(storage);
    if (symbol.length === 0 || current.some(item => item.symbol === symbol)) {
        return { entries: current, added: false };
    }
    if (current.length >= WATCHLIST_MAX_LOCAL) {
        return { entries: current, added: false };
    }
    const label = entry.label.trim();
    const next = [
        { symbol, label: label.length > 0 ? label : symbol, addedAt: now },
        ...current,
    ];
    if (!write(storage, next)) return { entries: current, added: false };
    return { entries: next, added: true };
}

export function removeLocalWatchlistEntry(
    symbol: string,
    storage: StorageLike | null = getDefaultStorage()
): LocalWatchlistRemoveResult {
    if (!storage) return { entries: [], removed: false };
    const upper = symbol.trim().toUpperCase();
    const current = readLocalWatchlist(storage);
    const next = current.filter(item => item.symbol !== upper);
    if (!write(storage, next)) return { entries: current, removed: false };
    return { entries: next, removed: true };
}

export function clearLocalWatchlist(
    storage: StorageLike | null = getDefaultStorage()
): void {
    if (!storage) return;
    try {
        storage.removeItem(LOCAL_STORAGE_WATCHLIST_KEY);
    } catch {
        // ignore
    }
}

/** 로컬 항목을 회원 목록과 같은 뷰 모양으로 — 소비자가 회원 여부를 모르게 하는 수렴점. */
export function toWatchlistViews(
    entries: readonly LocalWatchlistEntry[]
): WatchlistItemView[] {
    return entries.map(entry => ({
        symbol: entry.symbol,
        companyName: entry.label === entry.symbol ? null : entry.label,
        addedAt: new Date(entry.addedAt).toISOString(),
    }));
}
