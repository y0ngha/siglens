import { describe, expect, it } from 'vitest';
import {
    SALVAGE_BEFORE_RETRY_MAX_LOSS,
    isSalvageableFailure,
    salvageBeforeRetry,
} from '../lib/salvageBeforeRetry';

const unsupported = {
    kind: 'unsupported_numbers',
    tokens: ['999.99'],
} as const;

describe('SALVAGE_BEFORE_RETRY_MAX_LOSS', () => {
    it('원문의 25%다', () => {
        expect(SALVAGE_BEFORE_RETRY_MAX_LOSS).toBe(0.25);
    });
});

describe('isSalvageableFailure', () => {
    it.each(['unsupported_numbers', 'advice'] as const)(
        '%s는 도려내서 고친다',
        kind => {
            expect(isSalvageableFailure({ kind, tokens: ['x'] })).toBe(true);
        }
    );

    it.each(['magnitude_suffix', 'foreign_script', 'stale_deixis'] as const)(
        '%s는 도려내지 않는다',
        kind => {
            expect(isSalvageableFailure({ kind, tokens: ['x'] })).toBe(false);
        }
    );

    it('empty는 도려내지 않는다', () => {
        expect(isSalvageableFailure({ kind: 'empty' })).toBe(false);
    });
});

describe('salvageBeforeRetry', () => {
    const good = '좋은 문장입니다. '.repeat(30).trim();

    it('손실이 상한 이하면 도려낸 글과 손실 비율을 돌려준다', () => {
        const text = `${good} 목표가는 999.99달러입니다.`;
        const got = salvageBeforeRetry(text, unsupported, []);
        expect(got?.text).toBe(good);
        expect(got?.lossRatio).toBeCloseTo(
            (text.length - good.length) / text.length
        );
    });

    it('손실이 상한을 넘으면 null이다', () => {
        const text = `${good} ${'목표가는 999.99달러입니다. '.repeat(8)}`;
        expect(salvageBeforeRetry(text, unsupported, [])).toBeNull();
    });

    it('도려내도 고쳐지지 않는 종류는 null이다', () => {
        expect(
            salvageBeforeRetry(
                `${good} 매출은 1,573.1B입니다.`,
                { kind: 'magnitude_suffix', tokens: ['1,573.1B'] },
                []
            )
        ).toBeNull();
    });

    it('모든 문장이 위반이라 비면 null이다', () => {
        expect(
            salvageBeforeRetry('목표가는 999.99달러입니다.', unsupported, [])
        ).toBeNull();
    });

    it('도려낼 것이 없으면(위반 없음) 손실 0으로 원문을 돌려준다', () => {
        expect(salvageBeforeRetry(good, unsupported, [])).toEqual({
            text: good,
            lossRatio: 0,
        });
    });
});
