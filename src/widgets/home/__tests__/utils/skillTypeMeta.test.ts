import { SKILL_TYPE_META } from '../../utils/skillTypeMeta';

describe('SKILL_TYPE_META', () => {
    it('모든 타입이 탭·배지 키와 배지 클래스를 갖는다', () => {
        Object.entries(SKILL_TYPE_META).forEach(([type, meta]) => {
            expect(meta.tabLabelKey).toBe(`skillFilter.${type}`);
            expect(meta.badgeLabelKey).toBe(`skillBadge.${type}`);
            expect(meta.badgeClassName).not.toBe('');
        });
    });
});
