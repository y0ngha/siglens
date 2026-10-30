import {
    VARIANT_BORDER,
    VARIANT_COUNT_DIM,
    VARIANT_LABEL,
} from '@/widgets/dashboard/utils/subsectionStyles';

describe('subsectionStyles', () => {
    it('조짐(expected) 소절만 점선 경계를 쓴다', () => {
        expect(VARIANT_BORDER.expected).toContain('border-dashed');
        expect(VARIANT_BORDER.confirmed).not.toContain('border-dashed');
        expect(VARIANT_BORDER.mixed).not.toContain('border-dashed');
    });

    it.each(['confirmed', 'expected', 'mixed'] as const)(
        '%s: 종목 수 불투명도는 제목과 같은 값이다',
        variant => {
            const labelOpacity = VARIANT_LABEL[variant].match(/opacity-\d+/);
            expect(labelOpacity?.[0]).toBeDefined();
            expect(VARIANT_COUNT_DIM[variant]).toBe(labelOpacity?.[0]);
        }
    );

    it('종목 수 스타일은 제목의 굵기 클래스를 섞지 않는다', () => {
        for (const dim of Object.values(VARIANT_COUNT_DIM)) {
            expect(dim).not.toMatch(/font-/);
        }
    });
});
