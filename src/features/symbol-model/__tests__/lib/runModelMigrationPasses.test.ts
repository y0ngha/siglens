// @vitest-environment jsdom
import { runModelMigrationPasses } from '@/features/symbol-model/lib/runModelMigrationPasses';

const KEY = 'test.model';
const FLAG_1 = 'test.model.migrated';
const FLAG_2 = 'test.model.migrated.v2';

function run(): void {
    runModelMigrationPasses({
        storageKey: KEY,
        to: 'new',
        passes: [
            { flag: FLAG_1, from: ['old'] },
            { flag: FLAG_2, from: ['older', 'old'] },
        ],
    });
}

describe('runModelMigrationPasses', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('rewrites a listed value and sets every pass flag', () => {
        localStorage.setItem(KEY, 'old');
        run();
        expect(localStorage.getItem(KEY)).toBe('new');
        expect(localStorage.getItem(FLAG_1)).toBe('1');
        expect(localStorage.getItem(FLAG_2)).toBe('1');
    });

    it('leaves an unlisted value intact but still sets the flags', () => {
        localStorage.setItem(KEY, 'other');
        run();
        expect(localStorage.getItem(KEY)).toBe('other');
        expect(localStorage.getItem(FLAG_1)).toBe('1');
        expect(localStorage.getItem(FLAG_2)).toBe('1');
    });

    it('skips a pass whose flag is already set', () => {
        localStorage.setItem(FLAG_1, '1');
        localStorage.setItem(FLAG_2, '1');
        localStorage.setItem(KEY, 'old');
        run();
        expect(localStorage.getItem(KEY)).toBe('old');
    });

    it('runs only the pending pass for a partially migrated browser', () => {
        localStorage.setItem(FLAG_1, '1');
        localStorage.setItem(KEY, 'older');
        run();
        expect(localStorage.getItem(KEY)).toBe('new');
    });

    it('swallows storage errors', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new DOMException('blocked', 'SecurityError');
            });
        expect(run).not.toThrow();
        spy.mockRestore();
    });
});
