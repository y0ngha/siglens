import { summarizeReportPreview } from '@/features/email-report-settings/lib/reportPreviewSummary';

describe('summarizeReportPreview', () => {
    it('담기는 종목이 있으면 전체·상세·요약 수를 돌려준다', () => {
        expect(
            summarizeReportPreview({ full: 2, brief: 3, excluded: 1 })
        ).toEqual({ kind: 'counts', total: 5, full: 2, brief: 3 });
    });

    it('담긴 종목 없이 뺀 종목만 있으면 allExcluded', () => {
        expect(
            summarizeReportPreview({ full: 0, brief: 0, excluded: 2 })
        ).toEqual({ kind: 'allExcluded' });
    });

    it('아무 종목도 없으면 empty', () => {
        expect(
            summarizeReportPreview({ full: 0, brief: 0, excluded: 0 })
        ).toEqual({ kind: 'empty' });
    });
});
