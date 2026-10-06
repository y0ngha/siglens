import { describe, expect, it } from 'vitest';
import { visibleLevelLabels } from '../../utils/levelLabelCulling';

describe('visibleLevelLabels', () => {
    it('서로 떨어진 라벨은 전부 보인다', () => {
        expect(
            visibleLevelLabels(
                [
                    { y: 10, priority: 1 },
                    { y: 50, priority: 1 },
                    { y: 90, priority: 1 },
                ],
                20
            )
        ).toEqual(new Set([0, 1, 2]));
    });

    it('겹치면 우선순위가 높은 쪽이 남는다', () => {
        expect(
            visibleLevelLabels(
                [
                    { y: 100, priority: 1 },
                    { y: 108, priority: 3 },
                ],
                20
            )
        ).toEqual(new Set([1]));
    });

    it('우선순위가 같으면 앞선 입력이 남는다', () => {
        expect(
            visibleLevelLabels(
                [
                    { y: 100, priority: 1 },
                    { y: 110, priority: 1 },
                ],
                20
            )
        ).toEqual(new Set([0]));
    });

    it('숨겨진 라벨은 자리를 차지하지 않는다', () => {
        // 1이 0에 밀려 숨으면, 1과만 겹치던 2는 보여야 한다.
        expect(
            visibleLevelLabels(
                [
                    { y: 100, priority: 2 },
                    { y: 115, priority: 1 },
                    { y: 130, priority: 1 },
                ],
                20
            )
        ).toEqual(new Set([0, 2]));
    });

    it('좌표를 모르는 라벨은 숨기지 않는다', () => {
        expect(
            visibleLevelLabels(
                [
                    { y: null, priority: 1 },
                    { y: 100, priority: 1 },
                ],
                20
            )
        ).toEqual(new Set([0, 1]));
    });
});
