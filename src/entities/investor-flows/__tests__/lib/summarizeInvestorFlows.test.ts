import { describe, expect, it } from 'vitest';
import { evaluateInvestorFlows } from '@y0ngha/siglens-core';
import type { ProposedSaleFormType, ProposedSaleWithForm } from '../../model';
import {
    countProposedSales,
    summarizeInvestorFlows,
    SUMMARY_MAX_INSIDER_TRANSACTIONS,
    SUMMARY_MAX_PROPOSED_SALES,
    SUMMARY_MAX_QUARTERS,
    SUMMARY_MAX_SQUEEZE_COMPONENTS,
    SUMMARY_MAX_SIGNALS,
    SUMMARY_MAX_TOP_HOLDERS,
    SUMMARY_RATIO_DIGITS,
} from '../../lib/summarizeInvestorFlows';
import {
    makeExpandedSnapshot,
    makeFailsToDeliver,
    makeLargeHolder,
    makeThresholdList,
    makeHolder,
    makeProposedSale,
    makeSnapshot,
    makeSqueezeContext,
    makeTransaction,
    evaluate,
} from '@/widgets/investor-flows/__tests__/fixtures/flowsFixtures';

describe('summarizeInvestorFlows', () => {
    it('점수표의 종합·축 라벨을 그대로 옮긴다(재계산 없음)', () => {
        const snapshot = makeSnapshot();
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        expect(out.composite).toEqual(card.composite);
        expect(out.axes.institutional).toEqual({
            label: card.institutional.label,
            score: card.institutional.score,
            sufficiency: card.institutional.sufficiency,
        });
        expect(out.freshness).toEqual(card.freshness);
    });

    it('최신 분기 2개만, 완결 분기에는 IN/OUT 방향 라벨을 붙인다', () => {
        const out = summarizeInvestorFlows(
            makeSnapshot(),
            evaluate(makeSnapshot())
        );
        expect(out.institutional.quarters).toHaveLength(SUMMARY_MAX_QUARTERS);
        expect(out.institutional.quarters[1].period).toBe('2026-06-30');
        expect(out.institutional.quarters[1].complete).toBe(true);
        expect(out.institutional.quarters[1].netFlow).toBe('IN');
    });

    it('진행 중 분기(부분 집계)는 순변화가 있어도 netFlow가 null이다(방향으로 읽지 않는다)', () => {
        const out = summarizeInvestorFlows(
            makeSnapshot(),
            evaluate(makeSnapshot())
        );
        const partial = out.institutional.quarters[0];
        expect(partial.period).toBe('2026-09-30');
        expect(partial.complete).toBe(false);
        expect(partial.netShareChange).not.toBe(0);
        expect(partial.netFlow).toBeNull();
    });

    it('상위 보유 기관·내부자 거래·신호를 상한으로 자른다', () => {
        const snapshot = makeSnapshot({
            institutional: {
                quarters: makeSnapshot().institutional.quarters,
                topHolders: Array.from({ length: 30 }, (_, i) =>
                    makeHolder({ cik: String(i), filerName: `H${i}` })
                ),
                topHoldersPeriod: '2026-06-30',
            },
            insider: {
                transactions: Array.from({ length: 40 }, (_, i) =>
                    makeTransaction({
                        date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
                    })
                ),
            },
        });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.institutional.topHolders).toHaveLength(
            SUMMARY_MAX_TOP_HOLDERS
        );
        expect(out.insider.recentTransactions).toHaveLength(
            SUMMARY_MAX_INSIDER_TRANSACTIONS
        );
        expect(out.signals.length).toBeLessThanOrEqual(SUMMARY_MAX_SIGNALS);
    });

    it('이름의 줄바꿈·연속 공백을 공백 하나로 편 뒤 자른다', () => {
        const snapshot = makeSnapshot({
            insider: {
                transactions: [
                    makeTransaction({
                        name: 'BIG\nSELLER   HOLDINGS\t LLC',
                        role: '  Chief\nExecutive  ',
                    }),
                ],
            },
        });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.insider.recentTransactions[0]).toMatchObject({
            name: 'BIG SELLER HOLDINGS LLC',
            role: 'Chief Executive',
        });
    });

    it('긴 이름은 잘라 컨텍스트를 지킨다', () => {
        const snapshot = makeSnapshot({
            institutional: {
                quarters: makeSnapshot().institutional.quarters,
                topHolders: [makeHolder({ filerName: 'X'.repeat(200) })],
                topHoldersPeriod: '2026-06-30',
            },
        });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.institutional.topHolders[0].name.length).toBeLessThanOrEqual(
            26
        );
    });

    it('FINRA가 켜져 있어도 잔고·장외 거래량 행이 모두 비면 short 블록이 null이다(빈 블록을 내지 않는다)', () => {
        const snapshot = makeSnapshot({ shortInterest: [], shortVolume: [] });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.short).toBeNull();
    });

    it('FINRA 꺼짐(null)이면 short 블록이 null이다', () => {
        const snapshot = makeSnapshot({
            shortInterest: null,
            shortVolume: null,
        });
        const out = summarizeInvestorFlows(
            snapshot,
            evaluateInvestorFlows(snapshot, { includeFinraData: false })
        );
        expect(out.short).toBeNull();
        expect(out.axes.short.sufficiency).toBe('insufficient');
    });

    it('FINRA 켜짐이면 최신 잔고와 공매도 비율을 점수표(core) 값 그대로 낸다', () => {
        const snapshot = makeSnapshot();
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        expect(out.short?.interest).toEqual({
            settlementDate: '2026-09-15',
            shortQty: 128_000_000,
            pctOfFloat: card.short.metrics.shortInterestPctFloat,
            daysToCover: card.short.metrics.daysToCover,
            changeVsPrevious: {
                previousDate: '2026-08-15',
                sharesChange: 6_000_000,
                pct: 4.92,
            },
            recentChangePct: card.short.metrics.shortInterestChangePct,
            recentChangeFromDate:
                card.short.metrics.shortInterestChangeFromDate,
            recentChangeToDate: card.short.metrics.shortInterestChangeToDate,
            trend: card.short.metrics.shortInterestTrend,
        });
        expect(out.short?.interest?.pctOfFloat).toBe(0.86);
        expect(out.short?.offExchangeVolume?.shortRatio).toBe(
            card.short.metrics.shortVolumeRatio
        );
        expect(out.short?.note).toMatch(/off-exchange/);
    });

    it('13D/G 조회 실패(null)는 []로 위장하지 않고 null로 전달한다', () => {
        const snapshot = makeSnapshot({ largeHolders: null });
        expect(
            summarizeInvestorFlows(snapshot, evaluate(snapshot)).largeHolders
        ).toBeNull();
    });

    it('빈 스냅샷도 던지지 않는다(전 축 insufficient)', () => {
        const snapshot = makeSnapshot({
            institutional: {
                quarters: [],
                topHolders: [],
                topHoldersPeriod: null,
            },
            insider: { transactions: [] },
            largeHolders: [],
            shortInterest: [],
            shortVolume: [],
        });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.institutional.quarters).toEqual([]);
        expect(out.signals.filter(s => s.id !== 'data_stale')).toEqual([]);
    });

    it('희석 축을 다섯 번째 축으로 옮기고, 그 축의 신호도 신호 후보에 넣는다', () => {
        const snapshot = makeExpandedSnapshot();
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        expect(Object.keys(out.axes).toSorted()).toEqual([
            'dilution',
            'insider',
            'institutional',
            'largeHolders',
            'short',
        ]);
        expect(out.axes.dilution).toEqual({
            label: card.dilution.label,
            score: card.dilution.score,
            sufficiency: card.dilution.sufficiency,
        });
    });

    it('다른 축에 신호가 없으면 희석 축 신호가 신호 목록에 그대로 나온다', () => {
        const snapshot = makeExpandedSnapshot({
            institutional: {
                quarters: [],
                topHolders: [],
                topHoldersPeriod: null,
            },
            insider: { transactions: [] },
            largeHolders: [],
            shortInterest: [],
            shortVolume: [],
            failsToDeliver: [],
            proposedSales: [],
            thresholdList: null,
        });
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        expect(card.dilution.signals.length).toBeGreaterThan(0);
        expect(
            out.signals.filter(s => s.axis === 'dilution').map(s => s.id)
        ).toEqual(
            card.dilution.signals.slice(0, SUMMARY_MAX_SIGNALS).map(s => s.id)
        );
    });

    it('Form 144는 최신순 상한, 관계는 한 줄로, 10b5-1은 불리언이다', () => {
        const snapshot = makeExpandedSnapshot({
            proposedSales: Array.from({ length: 8 }, (_, i) =>
                makeProposedSale({
                    filingDate: `2026-09-${String(i + 10).padStart(2, '0')}`,
                    relationships: ['Officer', 'Director'],
                    planAdoptionDate: i % 2 === 0 ? '2026-05-01' : null,
                })
            ),
        });
        const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
        expect(out.insider.proposedSales).toHaveLength(
            SUMMARY_MAX_PROPOSED_SALES
        );
        expect(out.insider.proposedSales?.[0]).toMatchObject({
            filingDate: '2026-09-17',
            relationships: 'Officer, Direct…',
            plan10b5_1: false,
        });
    });

    it('숏스퀴즈 점수는 점수표 값을 옮기고 상위 구성요소만 싣는다', () => {
        const snapshot = makeExpandedSnapshot();
        const card = evaluate(snapshot, true, {
            squeezeContext: makeSqueezeContext(),
        });
        const out = summarizeInvestorFlows(snapshot, card);
        expect(out.squeezeRisk?.score).toBe(card.squeezeRisk?.score);
        expect(out.squeezeRisk?.level).toBe(card.squeezeRisk?.level);
        expect(out.squeezeRisk?.topComponents.length).toBeLessThanOrEqual(
            SUMMARY_MAX_SQUEEZE_COMPONENTS
        );
        expect(out.squeezeRisk?.topComponents[0]?.id).toBe(
            card.squeezeRisk?.components[0]?.id
        );
    });

    it('FTD 최대치는 자기 결제일(core failsToDeliverPeakDate)과 함께 싣는다', () => {
        const snapshot = makeExpandedSnapshot();
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        expect(card.short.metrics.failsToDeliverPeakDate).not.toBeNull();
        expect(out.failsToDeliver?.peakDate).toBe(
            card.short.metrics.failsToDeliverPeakDate
        );
    });

    it('Form 144 신고자 수는 core가 CIK로 센 값(철자가 다른 같은 사람은 한 명)을 그대로 싣는다', () => {
        const snapshot = makeExpandedSnapshot({
            proposedSales: [
                makeProposedSale({
                    filer: 'MARK ROBINSON',
                    filerCik: '0001234567',
                }),
                makeProposedSale({
                    filingDate: '2026-10-05',
                    filer: 'Mark Haymond Robinson',
                    filerCik: '0001234567',
                }),
            ],
        });
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        expect(card.insider.metrics?.proposedSaleFilerCount).toBe(1);
        expect(out.insider.metrics?.proposedSaleFilerCount).toBe(1);
        expect(out.insider.proposedSales).toHaveLength(2);
    });

    describe('Form 144 건수(proposedSalesCounts)', () => {
        const form144 = (
            filingDate: string,
            formType: ProposedSaleFormType = '144'
        ): ProposedSaleWithForm => ({
            ...makeProposedSale({ filingDate }),
            formType,
        });
        const AS_OF = '2026-10-15T03:00:00.000Z'; // 목요일

        it('창 경계: 시작일은 포함, 하루 전은 제외하고 windowTo 당일은 포함한다', () => {
            const counts = countProposedSales(
                [
                    form144('2026-10-15'),
                    form144('2026-09-16'), // 30일 창의 첫날(포함)
                    form144('2026-09-15'), // 하루 전(제외, 90일 창엔 포함)
                    form144('2026-07-18'), // 90일 창의 첫날(포함)
                    form144('2026-07-17'), // 하루 전(제외)
                ],
                AS_OF
            );
            expect(counts).toEqual({
                last30d: 2,
                last90d: 4,
                windowTo: '2026-10-15',
                last30dFrom: '2026-09-16',
                last90dFrom: '2026-07-18',
                excludesAmendments: true,
            });
        });

        it('정정(144/A)은 건수에서 뺀다', () => {
            const counts = countProposedSales(
                [
                    form144('2026-10-14'),
                    form144('2026-10-13', '144/A'),
                    form144('2026-10-12', '144/A'),
                ],
                AS_OF
            );
            expect(counts.last30d).toBe(1);
            expect(counts.last90d).toBe(1);
        });

        it('양식 필드가 없는 옛 스냅샷 행은 원본으로 세되 정정 제외를 약속하지 않는다', () => {
            const counts = countProposedSales(
                [makeProposedSale({ filingDate: '2026-10-14' })],
                AS_OF
            );
            expect(counts.last30d).toBe(1);
            expect(counts.excludesAmendments).toBe(false);
            expect(
                countProposedSales([form144('2026-10-14')], AS_OF)
                    .excludesAmendments
            ).toBe(true);
        });

        it('기준일이 주말이면 windowTo를 직전 금요일로 당긴다', () => {
            const counts = countProposedSales(
                [form144('2026-10-16'), form144('2026-09-18')],
                '2026-10-17T10:00:00.000Z' // 토요일
            );
            expect(counts.windowTo).toBe('2026-10-16');
            expect(counts.last30dFrom).toBe('2026-09-17');
            expect(counts.last30d).toBe(2);
        });

        it('windowTo 이후 날짜의 행은 세지 않는다', () => {
            expect(
                countProposedSales([form144('2026-10-16')], AS_OF).last30d
            ).toBe(0);
        });

        it('최근 5건 상한과 무관하게 전체 행으로 세고, 행마다 formType을 싣는다', () => {
            const snapshot = makeExpandedSnapshot({
                proposedSales: [
                    ...Array.from({ length: 8 }, (_, i) =>
                        form144(`2026-10-${String(i + 1).padStart(2, '0')}`)
                    ),
                    form144('2026-10-09', '144/A'),
                ],
            });
            const out = summarizeInvestorFlows(snapshot, evaluate(snapshot));
            expect(out.insider.proposedSales).toHaveLength(
                SUMMARY_MAX_PROPOSED_SALES
            );
            expect(out.insider.proposedSales?.[0]?.formType).toBe('144/A');
            expect(out.insider.proposedSalesCounts?.last30d).toBe(8);
        });

        it('Form 144 원천이 스냅샷에 없으면 null', () => {
            const snapshot = makeExpandedSnapshot();
            const { proposedSales: _omit, ...rest } = snapshot;
            const out = summarizeInvestorFlows(rest, evaluate(rest));
            expect(out.insider.proposedSalesCounts).toBeNull();
        });
    });

    describe('숏스퀴즈 점수의 근거(basis)', () => {
        it('FINRA 포지션 입력이 들어가면 basis: positioning이고 안내가 없다', () => {
            const snapshot = makeExpandedSnapshot();
            const card = evaluate(snapshot, true, {
                squeezeContext: makeSqueezeContext(),
            });
            expect(card.squeezeRisk?.includesFinra).toBe(true);
            const out = summarizeInvestorFlows(snapshot, card);
            expect(out.squeezeRisk?.basis).toBe('positioning');
            expect(out.squeezeRisk && 'note' in out.squeezeRisk).toBe(false);
        });

        it('GME처럼 FTD·과열 목록이 큰데 FINRA가 꺼지면 basis: price_delivery_only이고 레벨은 그대로, "숏스퀴즈 판독이 아니다" 안내를 붙인다', () => {
            const snapshot = makeExpandedSnapshot({
                shortInterest: null,
                shortVolume: null,
                failsToDeliver: makeFailsToDeliver(40_000_000),
                thresholdList: makeThresholdList({
                    listed: true,
                    consecutiveDays: 15,
                }),
            });
            const card = evaluate(snapshot, false, {
                squeezeContext: makeSqueezeContext(),
            });
            expect(card.squeezeRisk?.includesFinra).toBe(false);
            const out = summarizeInvestorFlows(snapshot, card);
            expect(out.squeezeRisk?.basis).toBe('price_delivery_only');
            expect(out.squeezeRisk?.level).toBe(card.squeezeRisk?.level);
            expect(out.squeezeRisk?.score).toBe(card.squeezeRisk?.score);
            expect(out.squeezeRisk?.note).toMatch(
                /not a short-squeeze reading/
            );
        });
    });

    it('신호의 대상(subject)을 한 줄로 펴서 싣고, 대상이 없는 신호에는 키가 없다', () => {
        const snapshot = makeSnapshot({
            largeHolders: [makeLargeHolder({ filer: 'ACTIVIST\n  FUND   LP' })],
        });
        const card = evaluate(snapshot);
        const out = summarizeInvestorFlows(snapshot, card);
        const withSubject = out.signals.filter(sig => 'subject' in sig);
        const raw = [
            ...card.institutional.signals,
            ...card.insider.signals,
            ...card.largeHolders.signals,
            ...card.short.signals,
            ...card.dilution.signals,
        ];
        expect(
            withSubject.length +
                out.signals.filter(sig => !('subject' in sig)).length
        ).toBe(out.signals.length);
        for (const sig of out.signals) {
            const source = raw.find(r => r.id === sig.id);
            if (source?.subject === undefined) {
                expect('subject' in sig).toBe(false);
            } else {
                expect(sig.subject).toBe(
                    source.subject.replace(/\s+/g, ' ').trim()
                );
            }
        }
    });

    describe('작은 비율의 정밀도', () => {
        it('대형주의 작은 FTD 비율(발행주식 대비 ≈0.0006%)이 0으로 반올림되지 않는다', () => {
            // NVDA 규모: 발행주식 243억 주, 최근 실패 최대 ≈15만 주 → 약 0.0006%.
            const snapshot = makeExpandedSnapshot({
                sharesOutstanding: 24_300_000_000,
                failsToDeliver: ['2026-09-10', '2026-09-18', '2026-09-24'].map(
                    settlementDate => ({
                        settlementDate,
                        failsQty: 150_000,
                        price: 180,
                    })
                ),
            });
            const card = evaluate(snapshot);
            const corePct = card.short.metrics.failsToDeliverPctOutstanding;
            expect(corePct).not.toBeNull();
            expect(corePct!).toBeGreaterThan(0);
            expect(corePct!).toBeLessThan(0.001);
            const out = summarizeInvestorFlows(snapshot, card);
            expect(out.failsToDeliver?.peakPctOutstanding).toBeGreaterThan(0);
            expect(out.failsToDeliver?.peakPctOutstanding).toBe(
                Math.round(corePct! * 10 ** SUMMARY_RATIO_DIGITS) /
                    10 ** SUMMARY_RATIO_DIGITS
            );
        });

        it('신호 근거 수치도 core 정밀도(소수 4자리)로 싣는다', () => {
            const snapshot = makeExpandedSnapshot();
            const card = evaluate(snapshot);
            const out = summarizeInvestorFlows(snapshot, card);
            const all = [
                ...card.institutional.signals,
                ...card.insider.signals,
                ...card.largeHolders.signals,
                ...card.short.signals,
                ...card.dilution.signals,
            ];
            for (const signal of out.signals) {
                const source = all.find(s => s.id === signal.id);
                for (const [key, value] of Object.entries(signal.evidence)) {
                    const raw = source?.evidence[key] ?? null;
                    expect(value).toBe(
                        raw === null
                            ? null
                            : Math.round(raw * 10 ** SUMMARY_RATIO_DIGITS) /
                                  10 ** SUMMARY_RATIO_DIGITS
                    );
                }
            }
        });
    });
});
