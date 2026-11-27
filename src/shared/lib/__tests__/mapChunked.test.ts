import { mapChunked } from '../mapChunked';

describe('mapChunked', () => {
    it('입력 순서대로 결과를 돌려준다', async () => {
        await expect(
            mapChunked([1, 2, 3, 4, 5], 2, async n => n * 10)
        ).resolves.toEqual([10, 20, 30, 40, 50]);
    });

    it('빈 입력은 작업 없이 빈 배열이다', async () => {
        const work = vi.fn();

        await expect(mapChunked([], 3, work)).resolves.toEqual([]);
        expect(work).not.toHaveBeenCalled();
    });

    it('동시에 떠 있는 작업이 청크 크기를 넘지 않는다', async () => {
        const state = { running: 0, peak: 0 };
        const work = async (n: number): Promise<number> => {
            state.running += 1;
            state.peak = Math.max(state.peak, state.running);
            await new Promise<void>(resolve => setTimeout(resolve, 1));
            state.running -= 1;
            return n;
        };

        await mapChunked([1, 2, 3, 4, 5, 6, 7], 3, work);

        expect(state.peak).toBe(3);
    });

    it('앞 청크가 끝나기 전에는 다음 청크를 시작하지 않는다', async () => {
        const started = new Set<number>();
        const release = new Promise<void>(resolve => setTimeout(resolve, 5));
        const work = async (n: number): Promise<number> => {
            started.add(n);
            if (n === 1) await release;
            return n;
        };

        const done = mapChunked([1, 2, 3], 2, work);
        await Promise.resolve();

        expect(started.has(3)).toBe(false);
        await done;
        expect(started.has(3)).toBe(true);
    });
});
