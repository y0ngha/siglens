const { mockLoadStaticChildEntries } = vi.hoisted(() => ({
    mockLoadStaticChildEntries: vi.fn(),
}));
vi.mock('@/app/api/sitemap/_shared/childEntries', () => ({
    loadStaticChildEntries: mockLoadStaticChildEntries,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadDeclaredUrls } from '@/app/api/rss/_lib/loadDeclaredUrls';

const NOW = new Date('2026-10-04T00:00:00.000Z');

describe('loadDeclaredUrls', () => {
    beforeEach(() => {
        mockLoadStaticChildEntries.mockReset();
    });

    it('정적 sitemap 엔트리의 URL 집합을 돌려준다', async () => {
        mockLoadStaticChildEntries.mockResolvedValue([
            { url: 'https://siglens.io/a' },
            { url: 'https://siglens.io/b' },
        ]);

        const urls = await loadDeclaredUrls(NOW);

        expect(urls).toEqual(
            new Set(['https://siglens.io/a', 'https://siglens.io/b'])
        );
        expect(mockLoadStaticChildEntries).toHaveBeenCalledWith(NOW);
    });

    it('엔트리를 못 읽으면 null을 돌려주고 로그를 남긴다', async () => {
        const failure = new Error('db down');
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockLoadStaticChildEntries.mockRejectedValue(failure);

        expect(await loadDeclaredUrls(NOW)).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(
            '[rss] static sitemap entries failed:',
            failure
        );
        errorSpy.mockRestore();
    });
});
