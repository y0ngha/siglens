import { gradeRowKey } from '@/widgets/news/utils/gradeRows';
import type { GradesEvent } from '@y0ngha/siglens-core';

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
        expect(gradeRowKey(EVENT, 0)).not.toBe(gradeRowKey({ ...EVENT }, 1));
    });
});
