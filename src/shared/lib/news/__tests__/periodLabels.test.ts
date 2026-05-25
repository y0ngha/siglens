import {
    NEWS_LIST_PERIOD_LABEL,
    NEWS_ANALYSIS_PERIOD_LABEL,
} from '@/shared/lib/news/periodLabels';

describe('NEWS_LIST_PERIOD_LABEL', () => {
    it('is the expected Korean label for 6-month period', () => {
        expect(NEWS_LIST_PERIOD_LABEL).toBe('최근 6개월');
    });
});

describe('NEWS_ANALYSIS_PERIOD_LABEL', () => {
    it('is the expected Korean label for 30-day period', () => {
        expect(NEWS_ANALYSIS_PERIOD_LABEL).toBe('최근 30일');
    });
});
