import { describe, it, expect } from 'vitest';
import { GET } from '../route';

describe('GET /api/health', () => {
    it('200과 { status: "ok" }를 반환한다', async () => {
        const res = GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: 'ok' });
    });
});
