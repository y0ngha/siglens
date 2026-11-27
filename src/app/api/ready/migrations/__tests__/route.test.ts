vi.mock('@/app/api/ready/_lib/checkMigrations', () => ({
    checkMigrations: vi.fn(),
}));

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkMigrations } from '@/app/api/ready/_lib/checkMigrations';
import { GET, dynamic } from '../route';

describe('GET /api/ready/migrations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('force-dynamic이다', () => {
        expect(dynamic).toBe('force-dynamic');
    });

    it('판정의 HTTP 상태와 본문을 그대로 내고 no-store를 건다 (200)', async () => {
        vi.mocked(checkMigrations).mockResolvedValue({
            httpStatus: 200,
            body: { status: 'ok', expected: 3, postDeployPending: 0 },
        });

        const res = await GET(
            new Request('http://127.0.0.1:3000/api/ready/migrations')
        );

        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(await res.json()).toEqual({
            status: 'ok',
            expected: 3,
            postDeployPending: 0,
        });
    });

    it('누락이면 503과 개수만 낸다', async () => {
        vi.mocked(checkMigrations).mockResolvedValue({
            httpStatus: 503,
            body: { status: 'missing', missing: 2 },
        });

        const res = await GET(
            new Request('http://127.0.0.1:3000/api/ready/migrations')
        );

        expect(res.status).toBe(503);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(await res.json()).toEqual({ status: 'missing', missing: 2 });
    });

    it.each(['cf-ray', 'cf-connecting-ip'])(
        'Cloudflare를 거친 요청(%s)은 404이고 판정을 돌리지 않는다',
        async header => {
            const res = await GET(
                new Request('http://127.0.0.1:3000/api/ready/migrations', {
                    headers: { [header]: 'x' },
                })
            );

            expect(res.status).toBe(404);
            expect(res.headers.get('Cache-Control')).toBe('no-store');
            expect(checkMigrations).not.toHaveBeenCalled();
        }
    );
});
