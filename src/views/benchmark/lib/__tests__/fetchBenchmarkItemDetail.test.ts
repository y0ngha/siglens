import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BENCHMARK_DETAIL_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import { fetchBenchmarkItemDetail } from '../fetchBenchmarkItemDetail';

describe('fetchBenchmarkItemDetail', () => {
    // 구현 없는 fetch 스파이는 원본을 호출한다 — 기본값은 거부형이다.
    const fetchStub = vi.fn<typeof fetch>(() =>
        Promise.reject(new Error('unexpected fetch'))
    );

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchStub);
    });

    afterEach(() => {
        fetchStub.mockClear();
        vi.unstubAllGlobals();
    });

    it('returns the parsed detail for the requested qid', async () => {
        fetchStub.mockResolvedValueOnce(
            new Response(JSON.stringify(BENCHMARK_DETAIL_FIXTURE))
        );
        await expect(
            fetchBenchmarkItemDetail('2099-01', 'q-001')
        ).resolves.toEqual(BENCHMARK_DETAIL_FIXTURE);
        expect(fetchStub).toHaveBeenCalledWith(
            '/benchmark/2099-01/items/q-001.json',
            { signal: undefined }
        );
    });

    it('throws on a non-ok response', async () => {
        fetchStub.mockResolvedValueOnce(new Response('nope', { status: 404 }));
        await expect(
            fetchBenchmarkItemDetail('2099-01', 'q-001')
        ).rejects.toThrow('request failed: 404');
    });

    it('throws when the file describes another qid', async () => {
        fetchStub.mockResolvedValueOnce(
            new Response(JSON.stringify(BENCHMARK_DETAIL_FIXTURE))
        );
        await expect(
            fetchBenchmarkItemDetail('2099-01', 'q-002')
        ).rejects.toThrow('unexpected shape');
    });

    it('throws when the body is not a detail document', async () => {
        fetchStub.mockResolvedValueOnce(new Response('{"qid":"q-001"}'));
        await expect(
            fetchBenchmarkItemDetail('2099-01', 'q-001')
        ).rejects.toThrow('unexpected shape');
    });
});
