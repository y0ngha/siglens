import {
    isNudgeExcludedPath,
    NUDGE_EXCLUDED_PATH_PREFIXES,
} from '@/features/email-report-nudge/lib/nudgePaths';

describe('isNudgeExcludedPath', () => {
    it.each(NUDGE_EXCLUDED_PATH_PREFIXES)('%s 자체는 제외한다', prefix => {
        expect(isNudgeExcludedPath(prefix)).toBe(true);
    });

    it('하위 경로도 제외한다', () => {
        expect(isNudgeExcludedPath('/email-report/unsubscribe')).toBe(true);
    });

    it('이름만 겹치는 경로는 제외하지 않는다', () => {
        expect(isNudgeExcludedPath('/accounting')).toBe(false);
    });

    it('종목 페이지는 제외하지 않는다', () => {
        expect(isNudgeExcludedPath('/AAPL')).toBe(false);
    });
});
