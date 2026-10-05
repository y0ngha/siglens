vi.mock('@/entities/sitemap-entry/server', () => ({
    loadRemovalSitemapEntries: vi.fn(),
}));

import { constants } from 'node:http2';
import { dynamic, GET } from '@/app/api/sitemap/removal/[kind]/route';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { REMOVAL_SITEMAP_KINDS } from '@/entities/sitemap-entry/model';
import { loadRemovalSitemapEntries } from '@/entities/sitemap-entry/server';

const { HTTP_STATUS_GONE, HTTP_STATUS_NOT_FOUND } = constants;

function callGET(kind: string): Promise<Response> {
    return GET(new Request(`https://siglens.io/api/sitemap/removal/${kind}`), {
        params: Promise.resolve({ kind }),
    });
}

describe('GET /api/sitemap/removal/[kind]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forces dynamic rendering', () => {
        expect(dynamic).toBe('force-dynamic');
    });

    // 2026-10-05: 제거 sitemap은 §8이 금지한 82K 롱테일 재발견을 계속 먹이는 표면이라 은퇴했다.
    it.each(REMOVAL_SITEMAP_KINDS)(
        'returns 410 Gone for the retired %s removal sitemap',
        async kind => {
            const response = await callGET(kind);

            expect(response.status).toBe(HTTP_STATUS_GONE);
            expect(response.headers.get('Cache-Control')).toBe(
                SITEMAP_CACHE_CONTROL
            );
            await expect(response.text()).resolves.toBe(
                'Removal sitemap retired'
            );
        }
    );

    it('does not read the database or build any entry (the builder is kept, the route no longer calls it)', async () => {
        await callGET('chart');

        expect(loadRemovalSitemapEntries).not.toHaveBeenCalled();
    });

    it('keeps 404 for a kind that never existed', async () => {
        const response = await callGET('invalid');

        expect(response.status).toBe(HTTP_STATUS_NOT_FOUND);
    });
});
