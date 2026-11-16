import type { GradesEvent } from '@y0ngha/siglens-core';
import { fromGradesEvent } from '@/widgets/news/utils/analystActionItems';
import { gradeRowKey } from '@/widgets/news/utils/gradeRows';

const EVENT: GradesEvent = {
    symbol: 'AAPL',
    date: '2025-01-15',
    action: 'upgrade',
    gradingCompany: 'Goldman Sachs',
    previousGrade: 'Neutral',
    newGrade: 'Buy',
};

describe('gradeRowKey', () => {
    it('내용이 같은 두 행도 인덱스로 구분한다', () => {
        const item = fromGradesEvent(EVENT);
        expect(gradeRowKey(item, 0)).not.toBe(gradeRowKey({ ...item }, 1));
    });
});
