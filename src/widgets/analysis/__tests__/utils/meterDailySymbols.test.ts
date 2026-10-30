import { getMeteredRevealPolicy } from '@y0ngha/siglens-core';
import { resolveMeterDailySymbols } from '@/widgets/analysis/utils/meterDailySymbols';

vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<typeof import('@y0ngha/siglens-core')>()),
    getMeteredRevealPolicy: vi.fn(),
}));

const mockedPolicy = vi.mocked(getMeteredRevealPolicy);

describe('resolveMeterDailySymbols', () => {
    it('core free 정책의 dailySymbols를 쓴다', () => {
        mockedPolicy.mockReturnValue({ dailySymbols: 3, revealAs: 'member' });
        expect(resolveMeterDailySymbols()).toBe(3);
        expect(mockedPolicy).toHaveBeenCalledWith('free');
    });

    it('정책이 꺼져 있으면 폴백 1을 쓴다', () => {
        mockedPolicy.mockReturnValue(null);
        expect(resolveMeterDailySymbols()).toBe(1);
    });
});
