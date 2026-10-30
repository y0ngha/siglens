import { releaseReanalyzeCooldown } from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseCooldownQuietly } from '../releaseCooldown';

vi.mock('@y0ngha/siglens-core', () => ({
    releaseReanalyzeCooldown: vi.fn(),
}));

describe('releaseCooldownQuietly', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('심볼과 타임프레임으로 쿨다운을 해제한다', async () => {
        vi.mocked(releaseReanalyzeCooldown).mockResolvedValue(undefined);
        await releaseCooldownQuietly('AAPL', '1Day', 'tag');
        expect(releaseReanalyzeCooldown).toHaveBeenCalledWith('AAPL', '1Day');
    });

    it('해제가 성공하면 로그를 남기지 않는다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(releaseReanalyzeCooldown).mockResolvedValue(undefined);
        await releaseCooldownQuietly('AAPL', '1Day', 'tag');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('해제가 실패해도 throw하지 않고 지정한 태그로 기록한다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const failure = new Error('redis down');
        vi.mocked(releaseReanalyzeCooldown).mockRejectedValue(failure);
        await expect(
            releaseCooldownQuietly('AAPL', '1Day', '[tag] release failed:')
        ).resolves.toBeUndefined();
        expect(spy).toHaveBeenCalledWith('[tag] release failed:', failure);
        spy.mockRestore();
    });
});
