import { migrateLegacyAnalysisModel } from '@/features/symbol-model/lib/migrateAnalysisModel';
import {
    LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
    LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY,
} from '@/shared/lib/storageKeys';

const OLD_DEFAULT = 'gemini-2.5-flash-lite';
const NEW_DEFAULT = 'deepseek-v4-flash';

function readStored(): string | null {
    return localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY);
}

function isFlagSet(): boolean {
    return (
        localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY) !==
        null
    );
}

describe('migrateLegacyAnalysisModel', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('migrates the old default (gemini-2.5-flash-lite) to the new default and sets the flag', () => {
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, OLD_DEFAULT);

        migrateLegacyAnalysisModel();

        expect(readStored()).toBe(NEW_DEFAULT);
        expect(isFlagSet()).toBe(true);
    });

    it('leaves a deliberate post-flip flash-lite choice untouched when the flag is already set', () => {
        // User deliberately picked flash-lite AFTER the flip → flag already set.
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY, '1');
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, OLD_DEFAULT);

        migrateLegacyAnalysisModel();

        expect(readStored()).toBe(OLD_DEFAULT);
    });

    it('leaves the new default (deepseek-v4-flash) unchanged and sets the flag', () => {
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, NEW_DEFAULT);

        migrateLegacyAnalysisModel();

        expect(readStored()).toBe(NEW_DEFAULT);
        expect(isFlagSet()).toBe(true);
    });

    it('leaves an unrelated stored model (gpt-5-mini) unchanged and sets the flag', () => {
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, 'gpt-5-mini');

        migrateLegacyAnalysisModel();

        expect(readStored()).toBe('gpt-5-mini');
        expect(isFlagSet()).toBe(true);
    });

    it('does NOT migrate gemini-2.5-flash (the old CHAT default, not the analysis default)', () => {
        localStorage.setItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
            'gemini-2.5-flash'
        );

        migrateLegacyAnalysisModel();

        expect(readStored()).toBe('gemini-2.5-flash');
        expect(isFlagSet()).toBe(true);
    });

    it('does not error when there is no stored value and still sets the flag', () => {
        expect(readStored()).toBeNull();

        expect(() => migrateLegacyAnalysisModel()).not.toThrow();

        expect(readStored()).toBeNull();
        expect(isFlagSet()).toBe(true);
    });

    it('is idempotent — a second call is a no-op', () => {
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, OLD_DEFAULT);

        migrateLegacyAnalysisModel();
        expect(readStored()).toBe(NEW_DEFAULT);

        // Simulate the user deliberately switching back to flash-lite after the
        // migration already ran — the second call must NOT re-migrate it.
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, OLD_DEFAULT);
        migrateLegacyAnalysisModel();

        expect(readStored()).toBe(OLD_DEFAULT);
    });

    it('no-ops under SSR (window undefined) without touching localStorage', () => {
        // The function accesses `localStorage` directly (a global), so if the SSR
        // guard did NOT return early these spies would fire. Assert they never do —
        // proving the `typeof window === 'undefined'` branch short-circuits before
        // any storage access.
        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        vi.stubGlobal('window', undefined);

        expect(() => migrateLegacyAnalysisModel()).not.toThrow();

        expect(getItemSpy).not.toHaveBeenCalled();
        expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('silently no-ops when localStorage throws (SecurityError in incognito / storage-blocked browsers)', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Storage disabled', 'SecurityError');
        });
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        expect(() => migrateLegacyAnalysisModel()).not.toThrow();
        expect(setItemSpy).not.toHaveBeenCalled();
    });
});
