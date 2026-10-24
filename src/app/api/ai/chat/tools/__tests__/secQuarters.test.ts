import { describe, expect, it } from 'vitest';
import {
    buildSecQuarters,
    findSecQuarter,
    parseConceptFacts,
    pickCurrentConcept,
    SEC_QUARTERS_KEEP,
    SEC_EPS_UNIT,
    SEC_REVENUE_UNIT,
    type SecConceptFact,
    type SecQuarter,
} from '@/app/api/ai/chat/tools/secQuarters';
import {
    ipRevenue,
    jbhtRevenueIncludingTax,
    jbhtRevenuesStale,
    tprEps,
    tprRevenue,
} from './fixtures/secConcepts';

const eps = (json: unknown) => parseConceptFacts(json, SEC_EPS_UNIT);
const revenue = (json: unknown) => parseConceptFacts(json, SEC_REVENUE_UNIT);

/** A synthetic fact for the cases the real probes do not contain (amendments, gaps). */
function fact(overrides: Partial<SecConceptFact>): SecConceptFact {
    return {
        start: '2026-04-01',
        end: '2026-06-30',
        val: 100,
        accn: '0000000001-26-000001',
        form: '10-Q',
        filed: '2026-08-01',
        ...overrides,
    };
}

const byEnd = (quarters: readonly SecQuarter[], end: string) =>
    quarters.find(q => q.periodEnd === end);

describe('parseConceptFacts', () => {
    it('keeps the 10-Q/10-K family of the requested unit and drops everything else', () => {
        const json = {
            units: {
                'USD/shares': [
                    {
                        start: '2026-01-01',
                        end: '2026-03-31',
                        val: 1.5,
                        accn: 'a',
                        fy: 2026,
                        fp: 'Q1',
                        form: '10-Q',
                        filed: '2026-05-01',
                    },
                    // A foreign filer's form, a malformed date and a non-number are dropped.
                    {
                        start: '2026-01-01',
                        end: '2026-03-31',
                        val: 9,
                        accn: 'b',
                        form: '20-F',
                        filed: '2026-05-01',
                    },
                    {
                        start: 'x',
                        end: '2026-03-31',
                        val: 9,
                        accn: 'c',
                        form: '10-Q',
                        filed: '2026-05-01',
                    },
                    {
                        start: '2026-01-01',
                        end: '2026-03-31',
                        val: '9',
                        accn: 'd',
                        form: '10-Q',
                        filed: '2026-05-01',
                    },
                    null,
                ],
                USD: [{ start: '2026-01-01', end: '2026-03-31', val: 1 }],
            },
        };
        expect(parseConceptFacts(json, 'USD/shares')).toEqual([
            {
                start: '2026-01-01',
                end: '2026-03-31',
                val: 1.5,
                accn: 'a',
                form: '10-Q',
                filed: '2026-05-01',
            },
        ]);
    });

    it.each([null, 'text', [], { units: null }, { units: { USD: 'x' } }])(
        'an unexpected body (%j) yields no facts',
        body => {
            expect(parseConceptFacts(body, 'USD')).toEqual([]);
        }
    );

    it('a company reporting revenue in a non-USD unit has no USD facts', () => {
        expect(
            parseConceptFacts({ units: { CAD: [fact({})] } }, SEC_REVENUE_UNIT)
        ).toEqual([]);
    });
});

describe('pickCurrentConcept', () => {
    it('chooses the concept whose newest filed fact is the newest, never the stale tag', () => {
        // JBHT stopped `Revenues` in 2018 and now files the IncludingAssessedTax tag.
        const stale = revenue(jbhtRevenuesStale);
        const current = revenue(jbhtRevenueIncludingTax);
        expect(stale.at(-1)?.filed).toBe('2018-02-23');
        expect(pickCurrentConcept([stale, current])).toBe(current);
        expect(pickCurrentConcept([current, stale])).toBe(current);
    });

    it('a tie keeps the earlier candidate and skips empty ones', () => {
        const a = [fact({ val: 1 })];
        const b = [fact({ val: 2 })];
        expect(pickCurrentConcept([[], a, b])).toBe(a);
    });

    it('no candidate with facts → empty', () => {
        expect(pickCurrentConcept([[], []])).toEqual([]);
        expect(pickCurrentConcept([])).toEqual([]);
    });
});

describe('buildSecQuarters — real TPR / IP / JBHT shapes', () => {
    const tpr = buildSecQuarters(eps(tprEps), revenue(tprRevenue));

    it('TPR FY2026-Q3 diluted EPS is the 10-Q figure 1.65 (FMP says 1.66)', () => {
        expect(byEnd(tpr, '2026-03-28')).toMatchObject({
            form: '10-Q',
            accn: '0001116132-26-000011',
            filed: '2026-05-07',
            epsDiluted: 1.65,
            revenue: 1_920_600_000,
        });
    });

    it('takes only the 3-month fact: the six-/nine-month year-to-date facts of the same filing are ignored', () => {
        // Q2 10-Q also lists 3.93 (six months) beside 2.68 (the quarter).
        expect(byEnd(tpr, '2025-12-27')?.epsDiluted).toBe(2.68);
        expect(byEnd(tpr, '2025-12-27')?.revenue).toBe(2_502_400_000);
    });

    it('year-to-date facts are ignored whatever the list order, and a filing with only year-to-date facts yields no quarter', () => {
        const reversed = buildSecQuarters(
            eps(tprEps).toReversed(),
            revenue(tprRevenue).toReversed()
        );
        expect(byEnd(reversed, '2025-12-27')?.epsDiluted).toBe(2.68);
        expect(byEnd(reversed, '2026-03-28')?.epsDiluted).toBe(1.65);
        const onlyYtd = [
            fact({ start: '2026-01-01', end: '2026-06-30', val: 9 }),
            fact({ start: '2025-01-01', end: '2025-12-31', val: 18 }),
        ];
        expect(buildSecQuarters(onlyYtd, onlyYtd)).toEqual([]);
    });

    it("a later filing's restated comparative never replaces the quarter's own value", () => {
        // IP's Q2-2025 revenue is 6,767 in its own 10-Q; the 2026 filings print a restated 6,142.
        const ip = buildSecQuarters([], revenue(ipRevenue));
        expect(byEnd(ip, '2025-06-30')).toMatchObject({
            revenue: 6_767_000_000,
            accn: '0000051434-25-000048',
        });
    });

    it('IP Q2-2026 revenue YoY is the same-filing comparative (-2.25%), not the year-ago row (-11.28%)', () => {
        const ip = buildSecQuarters([], revenue(ipRevenue));
        expect(byEnd(ip, '2026-06-30')).toMatchObject({
            form: '10-Q',
            epsDiluted: null,
            revenue: 6_004_000_000,
            revenueYoYPct: -2.25,
        });
        // Against the year-ago quarter's OWN original value it would be -11.28.
        expect(Math.round(((6004 - 6767) / 6767) * 10_000) / 100).toBe(-11.28);
    });

    it('a 10-K that reports a 3-month Q4 fact is used as-is (no derivation)', () => {
        const ip = buildSecQuarters([], revenue(ipRevenue));
        expect(byEnd(ip, '2025-12-31')).toMatchObject({
            form: '10-K',
            revenue: 6_006_000_000,
        });
    });

    it('JBHT uses the current revenue concept: 2026-Q3 comes from the 2026-10-23 10-Q', () => {
        const jbht = buildSecQuarters(
            [],
            pickCurrentConcept([
                revenue(jbhtRevenuesStale),
                revenue(jbhtRevenueIncludingTax),
            ])
        );
        expect(jbht[0]).toMatchObject({
            periodEnd: '2026-09-30',
            form: '10-Q',
            filed: '2026-10-23',
            revenue: 3_676_807_000,
            revenueYoYPct: 20.44,
        });
    });

    it('newest first, capped at SEC_QUARTERS_KEEP', () => {
        const ends = tpr.map(q => q.periodEnd);
        expect(ends).toEqual(ends.toSorted((a, b) => b.localeCompare(a)));
        const many = Array.from({ length: SEC_QUARTERS_KEEP + 5 }, (_, i) => {
            const start = new Date(Date.UTC(2020, i * 3, 1));
            const end = new Date(Date.UTC(2020, i * 3 + 3, 0));
            return fact({
                start: start.toISOString().slice(0, 10),
                end: end.toISOString().slice(0, 10),
                accn: `acc-${i}`,
                filed: end.toISOString().slice(0, 10),
            });
        });
        expect(buildSecQuarters(many, [])).toHaveLength(SEC_QUARTERS_KEEP);
    });
});

describe('buildSecQuarters — fiscal Q4', () => {
    it('derives Q4 revenue as FY − (Q1+Q2+Q3) when the 10-K has no 3-month fact, and leaves EPS null', () => {
        // TPR: 8,004.2M − (1,704.6M + 2,502.4M + 1,920.6M).
        const tpr = buildSecQuarters(eps(tprEps), revenue(tprRevenue));
        expect(byEnd(tpr, '2026-06-27')).toEqual({
            periodEnd: '2026-06-27',
            form: '10-K',
            accn: '0001116132-26-000018',
            filed: '2026-08-13',
            epsDiluted: null,
            revenue: 1_876_600_000,
            // No year-ago Q4 in the trimmed fixture and the 10-K prints no Q4 comparative.
            revenueYoYPct: null,
        });
    });

    it('does not derive Q4 when one of the three quarters is missing', () => {
        const withoutQ2 = revenue(tprRevenue).filter(
            f => f.accn !== '0001116132-26-000005'
        );
        expect(
            byEnd(buildSecQuarters([], withoutQ2), '2026-06-27')
        ).toBeUndefined();
    });

    it('does not derive Q4 when a quarter was filed after the 10-K (inconsistent filings)', () => {
        const lateQ1 = revenue(tprRevenue).map(f =>
            f.accn === '0001116132-25-000025'
                ? { ...f, filed: '2026-09-01' }
                : f
        );
        expect(
            byEnd(buildSecQuarters([], lateQ1), '2026-06-27')
        ).toBeUndefined();
    });

    it('does not derive a non-positive Q4', () => {
        const inflated = revenue(tprRevenue).map(f =>
            f.accn === '0001116132-26-000018' && f.end === '2026-06-27'
                ? { ...f, val: 1_000 }
                : f
        );
        expect(
            byEnd(buildSecQuarters([], inflated), '2026-06-27')
        ).toBeUndefined();
    });

    it('a 16-week quarter is excluded, so that quarter and the Q4 that needs it stay null', () => {
        // 16-week retail Q1 (112 days), then 12-week Q2/Q3, then the 10-K.
        const filing = (
            n: string,
            form: SecConceptFact['form'],
            filed: string
        ) => ({
            accn: n,
            form,
            filed,
        });
        const facts = [
            fact({
                start: '2025-02-02',
                end: '2025-05-24',
                val: 160,
                ...filing('q1', '10-Q', '2025-06-30'),
            }),
            fact({
                start: '2025-05-25',
                end: '2025-08-16',
                val: 120,
                ...filing('q2', '10-Q', '2025-09-25'),
            }),
            fact({
                start: '2025-08-17',
                end: '2025-11-08',
                val: 120,
                ...filing('q3', '10-Q', '2025-12-20'),
            }),
            fact({
                start: '2025-02-02',
                end: '2026-01-31',
                val: 520,
                ...filing('fy', '10-K', '2026-03-25'),
            }),
        ];
        const quarters = buildSecQuarters([], facts);
        expect(byEnd(quarters, '2025-05-24')).toBeUndefined();
        expect(byEnd(quarters, '2026-01-31')).toBeUndefined();
        expect(quarters.map(q => q.periodEnd)).toEqual([
            '2025-11-08',
            '2025-08-16',
        ]);
    });

    it('Q4 EPS is never derived: only an own 3-month EPS fact in the 10-K counts', () => {
        const q4Eps = fact({
            start: '2026-03-29',
            end: '2026-06-27',
            val: 1.9,
            accn: '0001116132-26-000018',
            form: '10-K',
            filed: '2026-08-13',
        });
        const quarters = buildSecQuarters(
            [...eps(tprEps), q4Eps],
            revenue(tprRevenue)
        );
        expect(byEnd(quarters, '2026-06-27')).toMatchObject({
            epsDiluted: 1.9,
            revenue: 1_876_600_000,
        });
    });
});

describe('buildSecQuarters — YoY base and amendments', () => {
    const q = (overrides: Partial<SecConceptFact>) => fact(overrides);

    it('falls back to the prior-year quarter’s own value when the filing prints no comparative', () => {
        const quarters = buildSecQuarters(
            [],
            [
                q({
                    start: '2025-04-01',
                    end: '2025-06-30',
                    val: 80,
                    accn: 'old',
                    filed: '2025-08-01',
                }),
                q({ val: 100, accn: 'new' }),
            ]
        );
        expect(byEnd(quarters, '2026-06-30')?.revenueYoYPct).toBe(25);
    });

    it('prefers the same-filing comparative over the prior-year quarter’s own value', () => {
        const quarters = buildSecQuarters(
            [],
            [
                q({
                    start: '2025-04-01',
                    end: '2025-06-30',
                    val: 80,
                    accn: 'old',
                    filed: '2025-08-01',
                }),
                // Restated prior-year figure printed inside the current filing.
                q({
                    start: '2025-04-01',
                    end: '2025-06-30',
                    val: 90,
                    accn: 'new',
                }),
                q({ val: 100, accn: 'new' }),
            ]
        );
        expect(byEnd(quarters, '2026-06-30')?.revenueYoYPct).toBe(11.11);
    });

    it('a non-positive base gives a null YoY', () => {
        const quarters = buildSecQuarters(
            [],
            [
                q({
                    start: '2025-04-01',
                    end: '2025-06-30',
                    val: 0,
                    accn: 'n',
                }),
                q({ val: 100, accn: 'n' }),
            ]
        );
        expect(byEnd(quarters, '2026-06-30')?.revenueYoYPct).toBeNull();
    });

    it('an amendment (10-Q/A) for the same period supersedes the original and keeps its form', () => {
        const quarters = buildSecQuarters(
            [
                q({ val: 1.1, accn: 'orig', filed: '2026-08-01' }),
                q({
                    val: 1.05,
                    accn: 'amend',
                    form: '10-Q/A',
                    filed: '2026-09-10',
                }),
            ],
            []
        );
        expect(byEnd(quarters, '2026-06-30')).toMatchObject({
            form: '10-Q/A',
            accn: 'amend',
            filed: '2026-09-10',
            epsDiluted: 1.05,
        });
    });

    it('an earlier-filed duplicate does not override a later filing, whatever the list order', () => {
        const later = q({ val: 1.05, accn: 'b', filed: '2026-09-10' });
        const earlier = q({ val: 1.1, accn: 'a', filed: '2026-08-01' });
        expect(
            byEnd(buildSecQuarters([later, earlier], []), '2026-06-30')
                ?.epsDiluted
        ).toBe(1.05);
        expect(
            byEnd(buildSecQuarters([earlier, later], []), '2026-06-30')
                ?.epsDiluted
        ).toBe(1.05);
    });

    it('no facts → no quarters', () => {
        expect(buildSecQuarters([], [])).toEqual([]);
    });
});

describe('findSecQuarter', () => {
    const quarters: SecQuarter[] = ['2026-03-28', '2025-12-27'].map(
        periodEnd => ({
            periodEnd,
            form: '10-Q',
            accn: periodEnd,
            filed: periodEnd,
            epsDiluted: 1,
            revenue: 1,
            revenueYoYPct: null,
        })
    );

    it('matches the exact period end, and a provider date a few days off', () => {
        expect(findSecQuarter(quarters, '2026-03-28')?.accn).toBe('2026-03-28');
        expect(findSecQuarter(quarters, '2026-03-31')?.accn).toBe('2026-03-28');
    });

    it('adjacent quarters never compete: a 52/53-week shift picks the right one, the gap between them matches none', () => {
        // Q2 ends 2025-12-27, Q3 2026-03-28 (91 days apart).
        expect(findSecQuarter(quarters, '2025-12-31')?.accn).toBe('2025-12-27');
        expect(findSecQuarter(quarters, '2026-03-24')?.accn).toBe('2026-03-28');
        expect(findSecQuarter(quarters, '2026-02-10')).toBeNull();
    });

    it('does not match a quarter more than a week away', () => {
        expect(findSecQuarter(quarters, '2026-04-30')).toBeNull();
        expect(findSecQuarter([], '2026-03-28')).toBeNull();
    });
});
