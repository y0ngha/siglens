import { GET } from '@/app/api/sitemap/longtail/[page]/route';

function callGET(_page: string): Promise<Response> {
    return GET();
}

describe('GET /api/sitemap/longtail/[page]', () => {
    it('returns 410 Gone for a formerly valid longtail sitemap page', async () => {
        const res = await callGET('1');

        expect(res.status).toBe(410);
        await expect(res.text()).resolves.toBe('Longtail sitemap retired');
    });

    it('returns 410 Gone even for old or malformed page requests', async () => {
        await expect(callGET('2')).resolves.toHaveProperty('status', 410);
        await expect(callGET('abc')).resolves.toHaveProperty('status', 410);
        await expect(callGET('10001')).resolves.toHaveProperty('status', 410);
    });
});
