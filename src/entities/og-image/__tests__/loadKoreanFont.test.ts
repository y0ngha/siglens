import { vi } from 'vitest';
import { loadKoreanFont } from '../lib/loadKoreanFont';

describe('loadKoreanFont', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('fetch가 성공하면 ArrayBuffer를 반환한다', async () => {
        const mockBuffer = new ArrayBuffer(8);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
        });

        const result = await loadKoreanFont();

        expect(result).toBe(mockBuffer);
    });

    it('res.ok가 false면 null을 반환한다', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            arrayBuffer: vi.fn(),
        });

        const result = await loadKoreanFont();

        expect(result).toBeNull();
    });

    it('fetch가 throw하면 null을 반환해 graceful degrade한다', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

        const result = await loadKoreanFont();

        expect(result).toBeNull();
    });

    it('arrayBuffer()가 throw해도 null을 반환한다', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: vi.fn().mockRejectedValue(new Error('decode error')),
        });

        const result = await loadKoreanFont();

        expect(result).toBeNull();
    });
});
