import { describe, expect, it } from 'vitest';
import type { AnalystEarningsHint } from '../../model';
import { resolveNextEarnings } from '../resolveNextEarnings';

const TODAY = '2026-11-15';

const hint = (
    over: Partial<AnalystEarningsHint> = {}
): AnalystEarningsHint => ({
    date: '2026-11-17',
    isEstimate: false,
    session: 'after_market',
    callAt: '2026-11-17T22:00:00.000Z',
    ...over,
});

const resolve = (
    scheduledDate: string | null,
    h: AnalystEarningsHint | null,
    scheduledConfirmed: boolean | null = null
) =>
    resolveNextEarnings({
        scheduledDate,
        scheduledConfirmed,
        hint: h,
        today: TODAY,
    });

describe('resolveNextEarnings', () => {
    it('Yahoo 힌트가 없으면 일정 행 그대로', () => {
        expect(resolve('2026-11-17', null, true)).toEqual({
            date: '2026-11-17',
            confirmed: true,
            session: null,
            callAt: null,
            alt: null,
        });
    });

    it('일정 행이 없으면 아무것도 정하지 않는다(힌트가 있어도)', () => {
        expect(resolve(null, hint())).toEqual({
            date: null,
            confirmed: null,
            session: null,
            callAt: null,
            alt: null,
        });
    });

    describe('같은 날짜', () => {
        it('isEstimate 3상태: false→확정, true→추정, null→기존 값', () => {
            expect(
                resolve('2026-11-17', hint({ isEstimate: false })).confirmed
            ).toBe(true);
            expect(
                resolve('2026-11-17', hint({ isEstimate: true }), true)
                    .confirmed
            ).toBe(false);
            expect(
                resolve('2026-11-17', hint({ isEstimate: null }), true)
                    .confirmed
            ).toBe(true);
            expect(
                resolve('2026-11-17', hint({ isEstimate: null }), null)
                    .confirmed
            ).toBeNull();
        });

        it('확정이면 세션과 콜 시각을 싣는다', () => {
            expect(resolve('2026-11-17', hint())).toEqual({
                date: '2026-11-17',
                confirmed: true,
                session: 'after_market',
                callAt: '2026-11-17T22:00:00.000Z',
                alt: null,
            });
        });

        it('확정이지만 세션이 없으면 콜 시각도 싣지 않는다', () => {
            const r = resolve('2026-11-17', hint({ session: null }));
            expect(r.session).toBeNull();
            expect(r.callAt).toBeNull();
        });

        it('추정이면 세션·콜 시각을 싣지 않는다', () => {
            const r = resolve(
                '2026-11-17',
                hint({ isEstimate: true, session: 'after_market' })
            );
            expect(r.session).toBeNull();
            expect(r.callAt).toBeNull();
        });
    });

    describe('날짜가 다름', () => {
        it('Yahoo가 확정이고 오늘 이후면 Yahoo 날짜가 이긴다(alt 없음)', () => {
            expect(resolve('2026-11-20', hint())).toEqual({
                date: '2026-11-17',
                confirmed: true,
                session: 'after_market',
                callAt: '2026-11-17T22:00:00.000Z',
                alt: null,
            });
        });

        it('Yahoo 확정일이 오늘이면 이긴다(경계 포함)', () => {
            const r = resolve('2026-11-20', hint({ date: TODAY }));
            expect(r.date).toBe(TODAY);
            expect(r.alt).toBeNull();
        });

        it('Yahoo 확정일이 이미 지났으면 일정 행을 둔다', () => {
            const r = resolve('2026-11-20', hint({ date: '2026-11-14' }));
            expect(r).toEqual({
                date: '2026-11-20',
                confirmed: null,
                session: null,
                callAt: null,
                alt: null,
            });
        });

        it('둘 다 미확정이고 오늘 이후면 alt를 붙이고 세션은 없다', () => {
            const r = resolve(
                '2026-11-20',
                hint({ isEstimate: true, date: '2026-11-24' })
            );
            expect(r).toEqual({
                date: '2026-11-20',
                confirmed: null,
                session: null,
                callAt: null,
                alt: { date: '2026-11-24', source: 'yahoo', estimate: true },
            });
        });

        it('Yahoo가 estimate를 말하지 않으면 alt.estimate는 null', () => {
            const r = resolve(
                '2026-11-20',
                hint({ isEstimate: null, date: '2026-11-24' })
            );
            expect(r.alt).toEqual({
                date: '2026-11-24',
                source: 'yahoo',
                estimate: null,
            });
        });

        it('일정 행 날짜가 오늘이면 "오늘 이후"에 포함된다', () => {
            const r = resolve(
                TODAY,
                hint({ isEstimate: true, date: '2026-11-24' })
            );
            expect(r.alt).not.toBeNull();
        });

        it('한쪽이 이미 지났으면 alt가 없다', () => {
            expect(
                resolve(
                    '2026-08-27',
                    hint({ isEstimate: true, date: '2026-11-24' })
                ).alt
            ).toBeNull();
            expect(
                resolve(
                    '2026-11-24',
                    hint({ isEstimate: true, date: '2026-11-14' })
                ).alt
            ).toBeNull();
        });
    });

    it('alt와 session은 함께 나오지 않는다(여러 조합 전수)', () => {
        const dates = ['2026-11-10', TODAY, '2026-11-17', '2026-11-24'];
        const estimates = [true, false, null] as const;
        const combos = dates.flatMap(scheduled =>
            dates.flatMap(hintDate =>
                estimates.map(isEstimate =>
                    resolve(
                        scheduled,
                        hint({ date: hintDate, isEstimate }),
                        null
                    )
                )
            )
        );
        expect(combos).toHaveLength(48);
        for (const r of combos) {
            expect(r.alt !== null && r.session !== null).toBe(false);
        }
    });
});
