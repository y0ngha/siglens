vi.mock('@/entities/sitemap-entry', () => ({
    buildCryptoPopularEntries: vi.fn().mockReturnValue([]),
    buildPopularEntries: vi.fn().mockReturnValue([]),
    buildStaticEntries: vi.fn().mockReturnValue([]),
    maxLastModified: vi.fn().mockReturnValue(new Date()),
    toSitemapIndexXml: vi.fn().mockReturnValue('<?xml version="1.0"?>'),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));
vi.mock('@/entities/sitemap-entry/server', () => ({
    loadRemovalSitemapEntries: vi.fn(),
}));

import { describe, expect, it } from 'vitest';
import { GET as getIndex } from '@/app/api/sitemap/route';
import { GET as getCrypto } from '@/app/api/sitemap/crypto/route';
import { GET as getPopular } from '@/app/api/sitemap/popular/route';
import { GET as getStatic } from '@/app/api/sitemap/static/route';
import { GET as getLongtail } from '@/app/api/sitemap/longtail/[page]/route';
import { GET as getRemoval } from '@/app/api/sitemap/removal/[kind]/route';

function aiHostRequest(path: string): Request {
    return new Request(`https://ai.siglens.io${path}`, {
        headers: { host: 'ai.siglens.io' },
    });
}

describe('sitemap on ai host — 스펙 §9-1: 전 sitemap 라우트 404', () => {
    it.each([
        ['index', () => getIndex(aiHostRequest('/api/sitemap'))],
        ['crypto', () => getCrypto(aiHostRequest('/api/sitemap/crypto'))],
        ['popular', () => getPopular(aiHostRequest('/api/sitemap/popular'))],
        ['static', () => getStatic(aiHostRequest('/api/sitemap/static'))],
        [
            'longtail',
            () => getLongtail(aiHostRequest('/api/sitemap/longtail/1')),
        ],
        [
            'removal',
            () =>
                getRemoval(aiHostRequest('/api/sitemap/removal/chart'), {
                    params: Promise.resolve({ kind: 'chart' }),
                }),
        ],
    ])('%s — ai 호스트 요청은 404', async (_name, callGet) => {
        const res = await callGet();
        expect(res.status).toBe(404);
    });
});
