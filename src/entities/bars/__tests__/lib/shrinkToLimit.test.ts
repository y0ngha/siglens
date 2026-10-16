// @vitest-environment node
import { MAX_SHRINK_ATTEMPTS, shrinkToLimit } from '../../lib/shrinkToLimit';

/** 길이가 봉 수에 정확히 비례하는 결과: JSON 길이 = 고정 머리 + 봉당 4자. */
const build = (count: number) => ({
    bars: count,
    payload: 'x'.repeat(count * 4),
});
const lengthOf = (count: number): number => JSON.stringify(build(count)).length;

describe('shrinkToLimit', () => {
    it('상한 안이면 그대로 두고 limited는 false다', () => {
        const result = shrinkToLimit(build, 50, lengthOf(50));
        expect(result.limited).toBe(false);
        expect(result.data.bars).toBe(50);
    });

    it('상한을 넘으면 봉 수를 줄여 상한 안에 맞추고 limited는 true다', () => {
        const limit = lengthOf(100);
        const result = shrinkToLimit(build, 400, limit);
        expect(result.limited).toBe(true);
        expect(JSON.stringify(result.data).length).toBeLessThanOrEqual(limit);
        expect(result.data.bars).toBeLessThan(400);
        expect(result.data.bars).toBeGreaterThan(80);
    });

    it('줄일 때마다 build를 새 봉 수로 부른다(최대 시도 횟수 이내)', () => {
        const asked: number[] = [];
        shrinkToLimit(
            count => {
                asked.push(count);
                return build(count);
            },
            400,
            lengthOf(100)
        );
        expect(asked[0]).toBe(400);
        expect(asked.length).toBeLessThanOrEqual(MAX_SHRINK_ATTEMPTS + 1);
        expect(asked.slice(1).every((n, i) => n < (asked[i] ?? 0))).toBe(true);
    });

    it('상한이 한 봉보다도 작으면 한 봉에서 멈춘다(무한히 돌지 않는다)', () => {
        const result = shrinkToLimit(build, 300, 1);
        expect(result.data.bars).toBe(1);
        expect(result.limited).toBe(true);
    });

    it('추정이 계속 빗나가도 MAX_SHRINK_ATTEMPTS번 뒤에는 멈춘다', () => {
        let calls = 0;
        // 봉 수를 줄여도 길이가 줄지 않는 결과: 시도 횟수 상한이 없으면 끝나지 않는다.
        const stubborn = (count: number) => {
            calls += 1;
            return { bars: count, payload: 'x'.repeat(10_000) };
        };
        const result = shrinkToLimit(stubborn, 500, 9_990);
        expect(calls).toBe(MAX_SHRINK_ATTEMPTS + 1);
        expect(result.limited).toBe(true);
    });

    it('빈 요청(1봉)은 줄이지 않는다', () => {
        const result = shrinkToLimit(build, 1, 1);
        expect(result.limited).toBe(false);
        expect(result.data.bars).toBe(1);
    });
});
