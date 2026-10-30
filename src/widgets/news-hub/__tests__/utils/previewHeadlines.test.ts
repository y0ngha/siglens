import { describe, expect, it } from 'vitest';
import { distinctPreviewHeadlines } from '../../utils/previewHeadlines';

describe('distinctPreviewHeadlines', () => {
    it('입력이 모두 다르고 비어 있지 않으면 그대로 돌려준다', () => {
        expect(distinctPreviewHeadlines(['연준 동결', '유가 반등'])).toEqual([
            '연준 동결',
            '유가 반등',
        ]);
    });

    /** 제목 컬럼이 빈 행은 `resolveNewsTitle`이 `''`를 돌려준다. */
    it('빈 문자열과 공백뿐인 헤드라인을 버린다', () => {
        expect(distinctPreviewHeadlines(['', '  ', '달러 약세'])).toEqual([
            '달러 약세',
        ]);
    });

    it('같은 헤드라인은 처음 것 하나만 남기고 순서를 유지한다', () => {
        expect(
            distinctPreviewHeadlines(['엔화 급등', '금값 최고', '엔화 급등'])
        ).toEqual(['엔화 급등', '금값 최고']);
    });

    it('꼬리 공백만 다른 헤드라인은 같은 것으로 보고 공백을 걷어낸 값을 돌려준다', () => {
        expect(
            distinctPreviewHeadlines([
                ' 국채 금리 상승',
                '국채 금리 상승  ',
                '원유 재고',
            ])
        ).toEqual(['국채 금리 상승', '원유 재고']);
    });

    it('남는 것이 없으면 빈 배열이다', () => {
        expect(distinctPreviewHeadlines(['', ''])).toEqual([]);
    });
});
