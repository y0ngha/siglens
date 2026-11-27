const mocks = vi.hoisted(() => ({ findShareableAt: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn().mockImplementation(function () {
        return { findShareableAt: mocks.findShareableAt };
    }),
}));

import { loadChartDrawings } from '@/app/api/email-report/chart/_lib/loadChartDrawings';

const AT = new Date('2026-11-25T00:00:00.000Z');
const OVERLAY = {
    id: 'tl',
    kind: 'trendline',
    skill: 'trendline',
    sourceRef: 'trendlines',
    variant: 'primary',
    segments: [],
    levels: [],
    labels: [],
};

describe('loadChartDrawings', () => {
    beforeEach(() => vi.clearAllMocks());

    it('행이 있으면 좁힌 작도를 돌려준다', async () => {
        mocks.findShareableAt.mockResolvedValue({
            status: 'found',
            row: { result: { chartOverlays: [OVERLAY] } },
        });

        const load = await loadChartDrawings('AAPL', AT);

        expect(load).toMatchObject({
            status: 'ok',
            drawings: { overlays: [{ id: 'tl' }] },
        });
        expect(mocks.findShareableAt).toHaveBeenCalledWith({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            generatedAt: AT,
        });
    });

    it('행이 없으면 ok(작도 없음)이고, 읽은 내용에 작도가 없어도 같다', async () => {
        mocks.findShareableAt.mockResolvedValueOnce({ status: 'absent' });
        expect(await loadChartDrawings('AAPL', AT)).toEqual({
            status: 'ok',
            drawings: null,
        });

        mocks.findShareableAt.mockResolvedValueOnce({
            status: 'found',
            row: { result: { summary: 'x' } },
        });
        expect(await loadChartDrawings('AAPL', AT)).toEqual({
            status: 'ok',
            drawings: null,
        });
    });

    it('읽기 실패는 failed이고, 던져도 failed다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.findShareableAt.mockResolvedValueOnce({ status: 'failed' });
        expect(await loadChartDrawings('AAPL', AT)).toEqual({
            status: 'failed',
        });

        mocks.findShareableAt.mockRejectedValueOnce(new Error('boom'));
        expect(await loadChartDrawings('AAPL', AT)).toEqual({
            status: 'failed',
        });
    });
});
