import { describe, expect, it } from 'vitest';
import type { OfferingKind } from '../../model';
import {
    DILUTION_BADGE_LOOKBACK_DAYS,
    pickRecentDilutionEvent,
} from '../../lib/recentDilutionEvent';
import { addDays } from '../../lib/investorFlowsDates';

const TODAY = '2026-10-16';

const filing = (kind: OfferingKind, daysAgo: number) => ({
    kind,
    filingDate: addDays(TODAY, -daysAgo),
});

describe('pickRecentDilutionEvent', () => {
    it.each<[OfferingKind, 'atm' | 'priced']>([
        ['atm', 'atm'],
        ['underwritten', 'priced'],
        ['best_efforts', 'priced'],
    ])('%s 공시는 배지 사건(%s)이 된다', (kind, expected) => {
        expect(pickRecentDilutionEvent([filing(kind, 7)], TODAY)).toEqual({
            kind: expected,
            filingDate: '2026-10-09',
        });
    });

    it.each<OfferingKind>([
        'shelf',
        'registration',
        'prospectus',
        'private_placement',
        'other',
    ])('용량 공시(%s)만 있으면 null이다', kind => {
        expect(pickRecentDilutionEvent([filing(kind, 3)], TODAY)).toBeNull();
    });

    it('90일 창의 경계: 정확히 90일 전은 포함, 91일 전은 제외한다', () => {
        expect(
            pickRecentDilutionEvent(
                [filing('atm', DILUTION_BADGE_LOOKBACK_DAYS)],
                TODAY
            )
        ).toEqual({ kind: 'atm', filingDate: '2026-07-18' });
        expect(
            pickRecentDilutionEvent(
                [filing('atm', DILUTION_BADGE_LOOKBACK_DAYS + 1)],
                TODAY
            )
        ).toBeNull();
    });

    it('오늘 이후 날짜는 무시한다', () => {
        expect(
            pickRecentDilutionEvent([filing('underwritten', -1)], TODAY)
        ).toBeNull();
    });

    it('입력 순서와 무관하게 가장 최신 공급 공시가 이긴다(용량 공시는 더 최신이어도 무시)', () => {
        const result = pickRecentDilutionEvent(
            [
                filing('atm', 60),
                filing('shelf', 1),
                filing('underwritten', 21),
                filing('atm', 40),
            ],
            TODAY
        );
        expect(result).toEqual({ kind: 'priced', filingDate: '2026-09-25' });
    });

    it('같은 신고일이면 가격이 정해진 공모를 고른다(순서 무관)', () => {
        const atm = filing('atm', 5);
        const priced = filing('best_efforts', 5);
        expect(pickRecentDilutionEvent([atm, priced], TODAY)?.kind).toBe(
            'priced'
        );
        expect(pickRecentDilutionEvent([priced, atm], TODAY)?.kind).toBe(
            'priced'
        );
    });

    it('빈 입력은 null이다', () => {
        expect(pickRecentDilutionEvent([], TODAY)).toBeNull();
    });
});
