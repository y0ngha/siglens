import {
    formatCooldown,
    selectReanalyzeLabelKind,
} from '@/widgets/analysis/utils/reanalyzeLabel';

describe('formatCooldown', () => {
    it.each([
        [0, '0:00'],
        [1, '0:01'],
        [59_001, '1:00'],
        [125_000, '2:05'],
    ])('%dms → %s', (ms, expected) => {
        expect(formatCooldown(ms)).toBe(expected);
    });
});

describe('selectReanalyzeLabelKind', () => {
    it('분석 중이 쿨다운보다 우선한다', () => {
        expect(selectReanalyzeLabelKind(true, 30_000)).toBe('analyzing');
    });

    it('쿨다운 중이면 cooldown이다', () => {
        expect(selectReanalyzeLabelKind(false, 30_000)).toBe('cooldown');
    });

    it('그 외에는 idle이다', () => {
        expect(selectReanalyzeLabelKind(false, 0)).toBe('idle');
    });
});
