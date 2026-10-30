import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTierOnly } from '@/shared/lib/byokGate';
import { e2eTechnicalResponse } from '../e2eTechnicalResponse';

const { findByUserAndSymbol } = vi.hoisted(() => ({
    findByUserAndSymbol: vi.fn(),
}));

vi.mock('@/shared/lib/byokGate', () => ({ resolveTierOnly: vi.fn() }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: 'db-handle' }),
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn(function Repo() {
        return { findByUserAndSymbol };
    }),
}));
vi.mock('@/shared/api/e2eAnalysisStub', () => ({
    e2eCachedTechnical: (tier: string) => ({ status: 'cached', tier }),
    e2eGeneratedTechnical: (tier: string) => ({ status: 'done', tier }),
}));

const readResult = async (res: Response): Promise<unknown> => {
    const text = await res.text();
    const line = text
        .split('\n')
        .find((l, i, all) => all[i - 1] === 'event: done');
    return JSON.parse(String(line?.replace(/^data: /, ''))).result;
};

const input = {
    userId: 'u1' as string | null,
    symbol: 'aapl',
    reanalyze: undefined as boolean | undefined,
    genericErrorMessage: 'generic',
};

describe('e2eTechnicalResponse', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(resolveTierOnly).mockResolvedValue('member');
        findByUserAndSymbol.mockResolvedValue({ id: 'h1' });
    });

    it('재분석 의도가 없으면 캐시된 fixture를 돌려준다', async () => {
        const res = await e2eTechnicalResponse(input);
        expect(res.headers.get('Content-Type')).toBe(
            'text/event-stream; charset=utf-8'
        );
        expect(await readResult(res)).toMatchObject({
            status: 'cached',
            tier: 'member',
        });
    });

    it('재분석 의도가 있으면 새로 생성된 fixture(done)를 돌려준다', async () => {
        const res = await e2eTechnicalResponse({ ...input, reanalyze: true });
        expect(await readResult(res)).toMatchObject({ status: 'done' });
    });

    it('회원이 보유 중인 종목이면 심볼을 대문자로 조회해 personalized를 켠다', async () => {
        const res = await e2eTechnicalResponse(input);
        expect(findByUserAndSymbol).toHaveBeenCalledWith('u1', 'AAPL');
        expect(await readResult(res)).toMatchObject({ personalized: true });
    });

    it('보유하지 않은 종목이면 personalized가 꺼진다', async () => {
        findByUserAndSymbol.mockResolvedValue(null);
        const res = await e2eTechnicalResponse(input);
        expect(await readResult(res)).toMatchObject({ personalized: false });
    });

    it('free 등급은 보유 조회 없이 personalized가 꺼진다', async () => {
        vi.mocked(resolveTierOnly).mockResolvedValue('free');
        const res = await e2eTechnicalResponse(input);
        expect(findByUserAndSymbol).not.toHaveBeenCalled();
        expect(await readResult(res)).toMatchObject({ personalized: false });
    });

    it('비회원은 보유 조회 없이 personalized가 꺼진다', async () => {
        const res = await e2eTechnicalResponse({ ...input, userId: null });
        expect(findByUserAndSymbol).not.toHaveBeenCalled();
        expect(await readResult(res)).toMatchObject({ personalized: false });
    });

    it('보유 조회가 실패하면 personalized를 끄고 계속한다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        findByUserAndSymbol.mockRejectedValue(new Error('db down'));
        const res = await e2eTechnicalResponse(input);
        expect(await readResult(res)).toMatchObject({ personalized: false });
        expect(spy).toHaveBeenCalledWith(
            '[streamAnalysisRoute] E2E personalized-flag holding read failed, degrading to false:',
            expect.any(Object)
        );
        spy.mockRestore();
    });
});
