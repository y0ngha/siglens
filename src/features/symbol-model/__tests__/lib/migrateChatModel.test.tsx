import { migrateLegacyChatModel } from '@/features/symbol-model/lib/migrateChatModel';
import {
    LOCAL_STORAGE_CHAT_MODEL_KEY,
    LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY,
    LOCAL_STORAGE_CHAT_MODEL_MIGRATION_V2_KEY,
} from '@/shared/lib/storageKeys';

const OLD_DEFAULT = 'gemini-2.5-flash';
const FLASH_LITE = 'gemini-2.5-flash-lite';
const NEW_DEFAULT = 'deepseek-v4-flash';

function readStored(): string | null {
    return localStorage.getItem(LOCAL_STORAGE_CHAT_MODEL_KEY);
}

function isFlagSet(): boolean {
    return (
        localStorage.getItem(LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY) !== null
    );
}

function isV2FlagSet(): boolean {
    return (
        localStorage.getItem(LOCAL_STORAGE_CHAT_MODEL_MIGRATION_V2_KEY) !== null
    );
}

/** Marks every pass as already run — the state of a fully migrated browser. */
function setAllFlags(): void {
    localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY, '1');
    localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_MIGRATION_V2_KEY, '1');
}

describe('migrateLegacyChatModel', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('migrates the old CHAT default (gemini-2.5-flash) to the new default and sets the flag', () => {
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, OLD_DEFAULT);

        migrateLegacyChatModel();

        expect(readStored()).toBe(NEW_DEFAULT);
        expect(isFlagSet()).toBe(true);
    });

    it('leaves a deliberate gemini-2.5-flash choice untouched once every pass has run', () => {
        // Picked deliberately after both passes → all flags already set.
        setAllFlags();
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, OLD_DEFAULT);

        migrateLegacyChatModel();

        expect(readStored()).toBe(OLD_DEFAULT);
    });

    /**
     * The whole reason pass 2 carries its own flag: browsers that already ran
     * pass 1 have that flag set, so widening pass 1's model list instead would
     * never execute for exactly the users holding a stale gemini choice.
     */
    it('still migrates flash-lite in a browser that already ran pass 1', () => {
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY, '1');
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, FLASH_LITE);

        migrateLegacyChatModel();

        expect(readStored()).toBe(NEW_DEFAULT);
        expect(isV2FlagSet()).toBe(true);
    });

    it('leaves the new default (deepseek-v4-flash) unchanged and sets the flag', () => {
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, NEW_DEFAULT);

        migrateLegacyChatModel();

        expect(readStored()).toBe(NEW_DEFAULT);
        expect(isFlagSet()).toBe(true);
    });

    it('leaves an unrelated stored model (gpt-5-mini) unchanged and sets the flag', () => {
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, 'gpt-5-mini');

        migrateLegacyChatModel();

        expect(readStored()).toBe('gpt-5-mini');
        expect(isFlagSet()).toBe(true);
    });

    it('migrates gemini-2.5-flash-lite to the new default and sets both flags', () => {
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, FLASH_LITE);

        migrateLegacyChatModel();

        expect(readStored()).toBe(NEW_DEFAULT);
        expect(isFlagSet()).toBe(true);
        expect(isV2FlagSet()).toBe(true);
    });

    it('leaves flash-lite alone after every pass has already run', () => {
        setAllFlags();
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, FLASH_LITE);

        migrateLegacyChatModel();

        expect(readStored()).toBe(FLASH_LITE);
    });

    it('does not error when there is no stored value and still sets the flag', () => {
        expect(readStored()).toBeNull();

        expect(() => migrateLegacyChatModel()).not.toThrow();

        expect(readStored()).toBeNull();
        expect(isFlagSet()).toBe(true);
    });

    it('is idempotent — a second call is a no-op', () => {
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, OLD_DEFAULT);

        migrateLegacyChatModel();
        expect(readStored()).toBe(NEW_DEFAULT);

        // Simulate the user deliberately switching back to gemini-2.5-flash after
        // the migration already ran — the second call must NOT re-migrate it.
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_KEY, OLD_DEFAULT);
        migrateLegacyChatModel();

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

        expect(() => migrateLegacyChatModel()).not.toThrow();

        expect(getItemSpy).not.toHaveBeenCalled();
        expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('silently no-ops when localStorage throws (SecurityError in incognito / storage-blocked browsers)', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Storage disabled', 'SecurityError');
        });
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        expect(() => migrateLegacyChatModel()).not.toThrow();
        expect(setItemSpy).not.toHaveBeenCalled();
    });
});
