import { describe, expect, it } from 'vitest';
import { resolveCtaBuilding } from '@/widgets/portfolio-position/utils/ctaBuilding';

describe('resolveCtaBuilding', () => {
    describe('입력이 비었을 때', () => {
        it.each([
            ['low52w', null, 200, 150],
            ['high52w', 100, null, 150],
            ['lastClose', 100, 200, null],
        ])('%s가 null이면 null이다', (_name, low, high, last) => {
            expect(resolveCtaBuilding(low, high, last)).toBeNull();
        });
    });

    describe('퇴화 입력', () => {
        it('고점이 저점 이하면 null이다', () => {
            expect(resolveCtaBuilding(200, 200, 200)).toBeNull();
        });

        it('현재가가 0 이하면 null이다', () => {
            expect(resolveCtaBuilding(100, 200, 0)).toBeNull();
        });
    });

    describe('정상 입력', () => {
        it('범위·현재가를 그대로 담고 현재가 위치 모델을 만든다', () => {
            const result = resolveCtaBuilding(100, 200, 175);
            expect(result).not.toBeNull();
            expect(result?.low52w).toBe(100);
            expect(result?.high52w).toBe(200);
            expect(result?.current).toBe(175);
            expect(result?.model.currentPos).toBe(0.75);
            expect(result?.model.currentClamped).toBeNull();
        });

        it('범위 밖 현재가는 clamp 방향을 표시한다', () => {
            expect(
                resolveCtaBuilding(100, 200, 250)?.model.currentClamped
            ).toBe('above');
            expect(resolveCtaBuilding(100, 200, 50)?.model.currentClamped).toBe(
                'below'
            );
        });
    });
});
