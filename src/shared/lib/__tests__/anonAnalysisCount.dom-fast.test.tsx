import {
    recordAnonSymbolAnalysis,
    hasNudgeShownToday,
    markNudgeShownToday,
    nextAnonNudgeVariant,
    ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD,
} from '@/shared/lib/anonAnalysisCount';
import {
    LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY,
    LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY,
    LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY,
} from '@/shared/lib/storageKeys';

const DAY_1 = new Date('2026-07-10T12:00:00.000Z');
const DAY_1_LATER = new Date('2026-07-10T23:00:00.000Z');
const DAY_2 = new Date('2026-07-11T00:30:00.000Z');

describe('recordAnonSymbolAnalysis', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('문턱은 1이다 — 그날 첫 분석이 곧 문턱을 넘는다', () => {
        expect(ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD).toBe(1);
        const result = recordAnonSymbolAnalysis('AAPL', DAY_1);
        expect(result).toEqual({ distinctCount: 1, crossedThreshold: true });
    });

    it('dedups the same symbol analyzed twice (distinctCount stays 1)', () => {
        recordAnonSymbolAnalysis('AAPL', DAY_1);
        const result = recordAnonSymbolAnalysis('AAPL', DAY_1_LATER);
        expect(result).toEqual({ distinctCount: 1, crossedThreshold: false });
    });

    it('dedups case-insensitively (AAPL === aapl)', () => {
        recordAnonSymbolAnalysis('AAPL', DAY_1);
        const result = recordAnonSymbolAnalysis('aapl', DAY_1);
        expect(result.distinctCount).toBe(1);
    });

    it('crossedThreshold=true exactly on the call that reaches the threshold', () => {
        const symbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT'].slice(
            0,
            ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD
        );
        const results = symbols.map(symbol =>
            recordAnonSymbolAnalysis(symbol, DAY_1)
        );
        expect(results.at(-1)).toEqual({
            distinctCount: ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD,
            crossedThreshold: true,
        });
        expect(results.slice(0, -1).every(r => !r.crossedThreshold)).toBe(true);
    });

    it('does not re-fire crossedThreshold on a 4th distinct symbol', () => {
        recordAnonSymbolAnalysis('AAPL', DAY_1);
        recordAnonSymbolAnalysis('TSLA', DAY_1);
        recordAnonSymbolAnalysis('NVDA', DAY_1);
        const fourth = recordAnonSymbolAnalysis('MSFT', DAY_1);
        expect(fourth).toEqual({ distinctCount: 4, crossedThreshold: false });
    });

    it('does not re-fire crossedThreshold on a repeat of an already-counted symbol past the threshold', () => {
        recordAnonSymbolAnalysis('AAPL', DAY_1);
        recordAnonSymbolAnalysis('TSLA', DAY_1);
        recordAnonSymbolAnalysis('NVDA', DAY_1);
        const repeat = recordAnonSymbolAnalysis('AAPL', DAY_1);
        expect(repeat).toEqual({ distinctCount: 3, crossedThreshold: false });
    });

    it('resets the counter on a UTC date change', () => {
        recordAnonSymbolAnalysis('AAPL', DAY_1);
        recordAnonSymbolAnalysis('TSLA', DAY_1);
        const nextDay = recordAnonSymbolAnalysis('NVDA', DAY_2);
        // 새 날의 첫 종목이라 다시 1부터 세고, 문턱(1)을 다시 넘는다.
        expect(nextDay).toEqual({ distinctCount: 1, crossedThreshold: true });
    });

    it('persists the record to localStorage under the documented key', () => {
        recordAnonSymbolAnalysis('AAPL', DAY_1);
        const raw = localStorage.getItem(
            LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY
        );
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw!)).toEqual({
            dateUtc: '2026-07-10',
            symbols: ['AAPL'],
        });
    });

    it('is SSR-safe: returns a no-op result when window is undefined', () => {
        const originalWindow = globalThis.window;
        // @ts-expect-error -- simulating an SSR environment for this assertion
        delete globalThis.window;
        try {
            const result = recordAnonSymbolAnalysis('AAPL', DAY_1);
            expect(result).toEqual({
                distinctCount: 0,
                crossedThreshold: false,
            });
        } finally {
            globalThis.window = originalWindow;
        }
    });

    it('degrades to a no-op when localStorage throws (blocked storage)', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('storage blocked');
            });
        try {
            const result = recordAnonSymbolAnalysis('AAPL', DAY_1);
            expect(result).toEqual({
                distinctCount: 0,
                crossedThreshold: false,
            });
        } finally {
            spy.mockRestore();
        }
    });

    it('degrades to a no-op when stored JSON is corrupted', () => {
        localStorage.setItem(
            LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY,
            'not-json{{'
        );
        const result = recordAnonSymbolAnalysis('AAPL', DAY_1);
        expect(result).toEqual({ distinctCount: 0, crossedThreshold: false });
    });

    it('treats a tampered record with non-string symbols as absent (starts fresh)', () => {
        localStorage.setItem(
            LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY,
            JSON.stringify({ dateUtc: '2026-07-10', symbols: [1, 2, 3] })
        );
        const result = recordAnonSymbolAnalysis('AAPL', DAY_1);
        expect(result).toEqual({ distinctCount: 1, crossedThreshold: true });
    });
});

describe('nextAnonNudgeVariant', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('기록이 없으면 메일 리포트부터, 이후로는 번갈아 고른다', () => {
        expect(nextAnonNudgeVariant()).toBe('emailReport');
        expect(nextAnonNudgeVariant()).toBe('reasoning');
        expect(nextAnonNudgeVariant()).toBe('emailReport');
    });

    it('고른 문구를 문서화된 키에 기록한다', () => {
        nextAnonNudgeVariant();
        expect(localStorage.getItem(LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY)).toBe(
            'emailReport'
        );
    });

    it('알 수 없는 값이 저장돼 있으면 메일 리포트로 시작한다', () => {
        localStorage.setItem(LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY, 'garbage');
        expect(nextAnonNudgeVariant()).toBe('emailReport');
    });

    it('저장소가 막혀 있으면 던지지 않고 메일 리포트로 고정된다', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('storage blocked');
            });
        try {
            expect(nextAnonNudgeVariant()).toBe('emailReport');
        } finally {
            spy.mockRestore();
        }
    });
});

describe('hasNudgeShownToday / markNudgeShownToday', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns false when nothing has been marked', () => {
        expect(hasNudgeShownToday(DAY_1)).toBe(false);
    });

    it('returns true after marking shown the same day', () => {
        markNudgeShownToday(DAY_1);
        expect(hasNudgeShownToday(DAY_1_LATER)).toBe(true);
    });

    it('returns false again after a UTC date change (nag-prevention resets daily)', () => {
        markNudgeShownToday(DAY_1);
        expect(hasNudgeShownToday(DAY_2)).toBe(false);
    });

    it('persists the shown flag under the documented key', () => {
        markNudgeShownToday(DAY_1);
        const raw = localStorage.getItem(LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY);
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw!)).toEqual({ dateUtc: '2026-07-10' });
    });

    it('hasNudgeShownToday is SSR-safe (returns false when window is undefined)', () => {
        const originalWindow = globalThis.window;
        // @ts-expect-error -- simulating an SSR environment for this assertion
        delete globalThis.window;
        try {
            expect(hasNudgeShownToday(DAY_1)).toBe(false);
        } finally {
            globalThis.window = originalWindow;
        }
    });

    it('markNudgeShownToday is SSR-safe (no-op when window is undefined)', () => {
        const originalWindow = globalThis.window;
        // @ts-expect-error -- simulating an SSR environment for this assertion
        delete globalThis.window;
        try {
            expect(() => markNudgeShownToday(DAY_1)).not.toThrow();
        } finally {
            globalThis.window = originalWindow;
        }
    });

    it('hasNudgeShownToday degrades to false when localStorage throws', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('storage blocked');
            });
        try {
            expect(hasNudgeShownToday(DAY_1)).toBe(false);
        } finally {
            spy.mockRestore();
        }
    });

    it('markNudgeShownToday degrades to a no-op when localStorage throws', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('storage blocked');
            });
        try {
            expect(() => markNudgeShownToday(DAY_1)).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('hasNudgeShownToday degrades to false when stored JSON is corrupted', () => {
        localStorage.setItem(LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY, '{{bad');
        expect(hasNudgeShownToday(DAY_1)).toBe(false);
    });
});
