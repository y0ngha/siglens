// @vitest-environment jsdom
import { deliverShare } from '@/features/share/lib/deliverShare';

const PAYLOAD = {
    title: 'AAPL',
    text: 'AAPL analysis',
    url: 'https://siglens.io/share/x',
};

function stubDevice(share: unknown, coarsePointer: boolean): void {
    vi.stubGlobal('navigator', { ...navigator, share });
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({ matches: coarsePointer })
    );
}

describe('deliverShare', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('네이티브 공유가 없으면 시트를 요구한다', async () => {
        stubDevice(undefined, true);
        await expect(deliverShare(PAYLOAD)).resolves.toBe('sheet');
    });

    it('데스크톱(정밀 포인터)에서는 navigator.share를 부르지 않고 시트를 요구한다', async () => {
        const share = vi.fn();
        stubDevice(share, false);
        await expect(deliverShare(PAYLOAD)).resolves.toBe('sheet');
        expect(share).not.toHaveBeenCalled();
    });

    it('네이티브 공유가 끝나면 done이고 payload를 그대로 넘긴다', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        stubDevice(share, true);
        await expect(deliverShare(PAYLOAD)).resolves.toBe('done');
        expect(share).toHaveBeenCalledWith(PAYLOAD);
    });

    it('사용자가 OS 시트를 닫으면(AbortError) done이다', async () => {
        stubDevice(
            vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')),
            true
        );
        await expect(deliverShare(PAYLOAD)).resolves.toBe('done');
    });

    it('그 밖의 네이티브 공유 실패는 시트로 넘긴다', async () => {
        stubDevice(vi.fn().mockRejectedValue(new Error('boom')), true);
        await expect(deliverShare(PAYLOAD)).resolves.toBe('sheet');
    });
});
