import { describe, expect, it } from 'vitest';
import { selectLockedCardBodyKind } from '@/widgets/analysis/utils/lockedCardCopy';

describe('selectLockedCardBodyKind', () => {
    it('미터가 소진되면 스킬 수와 상관없이 소진 문구다', () => {
        expect(
            selectLockedCardBodyKind({ isMeterExhausted: true, skillCount: 12 })
        ).toBe('meterExhausted');
    });

    it('소진이 아니고 잠긴 스킬이 있으면 스킬 업셀 문구다', () => {
        expect(
            selectLockedCardBodyKind({ isMeterExhausted: false, skillCount: 7 })
        ).toBe('skillUpsell');
    });

    it('둘 다 아니면 기본 문구다', () => {
        expect(
            selectLockedCardBodyKind({ isMeterExhausted: false, skillCount: 0 })
        ).toBe('default');
    });
});
