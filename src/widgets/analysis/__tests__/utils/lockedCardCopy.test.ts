import { describe, expect, it } from 'vitest';
import { selectLockedCardCopy } from '@/widgets/analysis/utils/lockedCardCopy';

describe('selectLockedCardCopy', () => {
    it('미터가 소진되면 스킬 수와 상관없이 소진 문구와 하루 종목 수를 고른다', () => {
        expect(
            selectLockedCardCopy({
                isMeterExhausted: true,
                skillCount: 12,
                meterDailySymbols: 1,
            })
        ).toEqual({
            title: 'meterExhausted',
            body: { kind: 'meterExhausted', count: 1 },
        });
    });

    it('소진이 아니고 잠긴 스킬이 있으면 스킬 업셀 문구를 고른다', () => {
        expect(
            selectLockedCardCopy({
                isMeterExhausted: false,
                skillCount: 7,
                meterDailySymbols: 1,
            })
        ).toEqual({
            title: 'default',
            body: { kind: 'skillUpsell', count: 7 },
        });
    });

    it('둘 다 아니면 기본 문구를 고른다', () => {
        expect(
            selectLockedCardCopy({
                isMeterExhausted: false,
                skillCount: 0,
                meterDailySymbols: 1,
            })
        ).toEqual({ title: 'default', body: { kind: 'default' } });
    });
});
