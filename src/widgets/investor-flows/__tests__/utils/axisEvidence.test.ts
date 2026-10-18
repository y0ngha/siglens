import { describe, expect, it } from 'vitest';
import {
    batchFilingNote,
    buildAxisEvidence,
    KR_BATCH_FILING_MIN_COUNT,
    KR_BATCH_FILING_MIN_SHARE,
    krNoReportsInWindow,
} from '../../utils/axisEvidence';
import {
    evaluate,
    makeEmptySnapshot,
    makeExpandedSnapshot,
    makeKrInsiderRecord,
    makeKrMajorHoldingRecord,
    makeKrSnapshot,
    makeLargeHolder,
    makeSnapshot,
} from '../fixtures/flowsFixtures';

describe('buildAxisEvidence', () => {
    const card = evaluate(makeSnapshot());

    it('기관: 보유 기관 수·순변화·신규/청산을 점수표 지표에서 만든다', () => {
        const lines = buildAxisEvidence(card, 'institutional', 'en');
        expect(lines.map(l => l.id)).toEqual([
            'holders',
            'netSharesOutstanding',
            'newExited',
        ]);
        expect(lines[0].values).toEqual({ count: '5,240', change: '+2.5%' });
        expect(lines[2].values).toEqual({ added: '310', exited: '180' });
    });

    it('내부자: Form 144 예정 주식의 발행주식 대비 %(core proposedSalePctOutstanding)를 근거 줄로 낸다', () => {
        const expanded = evaluate(makeExpandedSnapshot());
        const pct = expanded.insider.metrics?.proposedSalePctOutstanding;
        expect(pct).not.toBeNull();
        const line = buildAxisEvidence(expanded, 'insider', 'en').find(
            l => l.id === 'insiderProposedSalePct'
        );
        // 픽스처는 대형주(발행주식 150억 주)라 몇 건의 Form 144가 0.001%에도 못 미친다 — `0.000%`("없음"으로 읽힌다)가
        // 아니라 하한으로 보인다.
        expect(pct!).toBeGreaterThan(0);
        expect(pct!).toBeLessThan(0.0005);
        expect(line?.values.pct).toBe('<0.001%');
    });

    it('내부자: 발행주식 대비 %가 0.001% 이상이면 소수 세 자리로 낸다', () => {
        const expanded = evaluate(
            makeExpandedSnapshot({ sharesOutstanding: 10_000_000 })
        );
        const pct = expanded.insider.metrics?.proposedSalePctOutstanding;
        expect(pct!).toBeGreaterThanOrEqual(0.001);
        const line = buildAxisEvidence(expanded, 'insider', 'en').find(
            l => l.id === 'insiderProposedSalePct'
        );
        expect(line?.values.pct).toBe(
            `${pct!.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`
        );
    });

    it('내부자: 발행주식 대비 %가 없으면 그 줄을 내지 않는다', () => {
        const expanded = evaluate(
            makeExpandedSnapshot({ sharesOutstanding: null })
        );
        expect(
            buildAxisEvidence(expanded, 'insider', 'en').map(l => l.id)
        ).not.toContain('insiderProposedSalePct');
    });

    it('내부자: 창 길이(days)는 core freshness에서 온다(I18-6)', () => {
        const lines = buildAxisEvidence(card, 'insider', 'en');
        expect(lines[0].id).toBe('insiderNetBuy');
        expect(lines[0].values.days).toBe(
            String(card.freshness.insiderWindow.days)
        );
        expect(lines.map(l => l.id)).toContain('insiderCluster');
    });

    it('대량보유: 13D/13G 포지션·신고 수와 창 길이', () => {
        expect(buildAxisEvidence(card, 'largeHolders', 'en')).toEqual([
            {
                id: 'largeHolderCounts',
                values: {
                    d: '1',
                    df: '1',
                    g: '0',
                    gf: '0',
                    days: String(card.freshness.largeHolderWindow.days),
                },
            },
        ]);
    });

    it('대량보유: 한 신고인의 정정 신고 여러 건은 포지션 1·신고 N으로, 공동 신고는 포지션·신고 1로 나눠 보인다', () => {
        const filing = (accession: string) =>
            `https://www.sec.gov/Archives/edgar/data/1767470/${accession.replaceAll('-', '')}/${accession}-index.htm`;
        const scorecard = evaluate(
            makeSnapshot({
                largeHolders: [
                    makeLargeHolder({
                        filingDate: '2026-09-02',
                        filer: 'Fixture Cohen Holdings',
                        percentOfClass: 8.3,
                        shares: 40_000_000,
                        url: filing('0001104659-26-000101'),
                    }),
                    makeLargeHolder({
                        filingDate: '2026-09-20',
                        filer: 'Fixture Cohen Holdings',
                        percentOfClass: 8.8,
                        shares: 43_000_000,
                        url: filing('0001104659-26-000202'),
                    }),
                    makeLargeHolder({
                        filingDate: '2026-10-08',
                        filer: 'Fixture Cohen Holdings',
                        percentOfClass: 9.1,
                        shares: 46_000_000,
                        url: filing('0001104659-26-000303'),
                    }),
                    // 공동 신고: 같은 접수번호·같은 지분을 공동 신고인마다 한 행씩 보낸다.
                    ...['Fixture Joint Fund A', 'Fixture Joint Fund B'].map(
                        filer =>
                            makeLargeHolder({
                                filingDate: '2026-10-01',
                                filer,
                                form: 'SC 13G',
                                percentOfClass: 6.2,
                                shares: 30_000_000,
                                url: filing('0001193125-26-000404'),
                            })
                    ),
                ],
            })
        );
        expect(scorecard.largeHolders.metrics).toEqual({
            events13d: 1,
            filings13d: 3,
            events13g: 1,
            filings13g: 1,
        });
        expect(
            buildAxisEvidence(scorecard, 'largeHolders', 'ko')[0].values
        ).toMatchObject({ d: '1', df: '3', g: '1', gf: '1' });
    });

    it('증자: 공시 목록이 비어 있으면(core noFilingsOnRecord) "0건" 대신 공시 없음 한 줄만 낸다', () => {
        const scorecard = evaluate(makeExpandedSnapshot({ offerings: [] }));
        expect(scorecard.dilution.noFilingsOnRecord).toBe(true);
        expect(buildAxisEvidence(scorecard, 'dilution', 'ko')).toEqual([
            { id: 'dilutionNoneOnRecord', values: {} },
        ]);
    });

    it('증자: 공시가 있으면 창 안 건수 줄을 낸다', () => {
        const scorecard = evaluate(makeExpandedSnapshot());
        expect(scorecard.dilution.noFilingsOnRecord).toBe(false);
        expect(
            buildAxisEvidence(scorecard, 'dilution', 'ko').map(l => l.id)
        ).toContain('dilutionFilings');
    });

    it('공매도: 점수표 지표 4종', () => {
        expect(buildAxisEvidence(card, 'short', 'en').map(l => l.id)).toEqual([
            'shortPct',
            'daysToCover',
            'shortTrend',
            'shortRatio',
        ]);
    });

    it('데이터 부족 축은 근거 줄을 만들지 않는다', () => {
        const empty = evaluate(makeEmptySnapshot());
        for (const axis of [
            'institutional',
            'insider',
            'largeHolders',
            'short',
        ] as const) {
            expect(buildAxisEvidence(empty, axis, 'ko')).toEqual([]);
        }
    });
});

describe('buildAxisEvidence — 한국(DART) 변동 없음', () => {
    it('대량보유: 창 안 보고에 유의미한 변동이 없으면(중립 측정값) 변동 없음 줄과 최대 변동폭을 낸다', () => {
        const scorecard = evaluate(
            makeKrSnapshot({
                majorHoldings: [
                    makeKrMajorHoldingRecord({
                        reporter: '삼성물산',
                        ratioPct: 19.69,
                        ratioChangePct: 0,
                        sharesChange: 0,
                        reason: '보유주식등의 수 변동',
                    }),
                ],
            })
        );
        expect(scorecard.largeHolders.sufficiency).toBe('sufficient');
        expect(scorecard.largeHolders.label).toBe('neutral');
        expect(
            buildAxisEvidence(scorecard, 'largeHolders', 'ko')
        ).toContainEqual({
            id: 'krMajorHolderNoChange',
            values: { pct: '0.00' },
        });
    });

    it('대량보유: 방향 신호가 있으면 변동 없음 줄을 내지 않는다', () => {
        const scorecard = evaluate(makeKrSnapshot());
        expect(
            buildAxisEvidence(scorecard, 'largeHolders', 'ko').map(l => l.id)
        ).not.toContain('krMajorHolderNoChange');
    });

    it('임원: 창 안 보고의 순변동이 0이면(중립 측정값) 변동 없음 줄을 낸다', () => {
        const scorecard = evaluate(
            makeKrSnapshot({ insiderReports: [makeKrInsiderRecord()] })
        );
        expect(scorecard.insider.sufficiency).toBe('sufficient');
        expect(
            buildAxisEvidence(scorecard, 'insider', 'ko').map(l => l.id)
        ).toContain('krInsiderNoChange');
    });

    it('임원: 방향 신호가 있으면 변동 없음 줄을 내지 않는다', () => {
        const scorecard = evaluate(makeKrSnapshot());
        expect(scorecard.insider.signals.map(s => s.direction)).toContain(
            'bullish'
        );
        expect(
            buildAxisEvidence(scorecard, 'insider', 'ko').map(l => l.id)
        ).not.toContain('krInsiderNoChange');
    });
});

describe('krNoReportsInWindow', () => {
    // 기준일(2026-10-16)에서 90일 창보다 오래된 접수일.
    const OUTSIDE_WINDOW = '2026-05-04';

    it('보고가 모두 창 밖이면 창 길이와 최신 접수일을 돌려준다', () => {
        const scorecard = evaluate(
            makeKrSnapshot({
                majorHoldings: [
                    makeKrMajorHoldingRecord({ receiptDate: OUTSIDE_WINDOW }),
                ],
                insiderReports: [
                    makeKrInsiderRecord({ receiptDate: OUTSIDE_WINDOW }),
                ],
                tradingPlans: [],
            })
        );
        expect(krNoReportsInWindow(scorecard, 'largeHolders', 'ko')).toEqual({
            days: String(scorecard.freshness.largeHolderWindow.days),
            latestReceiptDate: OUTSIDE_WINDOW,
        });
        expect(krNoReportsInWindow(scorecard, 'insider', 'ko')).toEqual({
            days: String(scorecard.freshness.insiderWindow.days),
            latestReceiptDate: OUTSIDE_WINDOW,
        });
    });

    it('쓸 수 있는 보고가 하나도 없으면 null이다(데이터 부족)', () => {
        const scorecard = evaluate(
            makeKrSnapshot({ majorHoldings: [], insiderReports: [] })
        );
        expect(krNoReportsInWindow(scorecard, 'largeHolders', 'ko')).toBeNull();
        expect(krNoReportsInWindow(scorecard, 'insider', 'ko')).toBeNull();
    });

    it('채점된 축은 null이다', () => {
        const scorecard = evaluate(makeKrSnapshot());
        expect(krNoReportsInWindow(scorecard, 'largeHolders', 'ko')).toBeNull();
    });

    it('미국 점수표는 null이다', () => {
        expect(
            krNoReportsInWindow(
                evaluate(makeEmptySnapshot()),
                'largeHolders',
                'ko'
            )
        ).toBeNull();
    });
});

describe('임원: 하루 일괄 보고 주석', () => {
    const DATE = '2026-07-21';
    const MIN = KR_BATCH_FILING_MIN_COUNT;

    function reportsLine(
        reports: number,
        filing: { date: string; count: number } | null | undefined,
        locale: 'ko' | 'en' = 'ko'
    ) {
        const base = evaluate(makeKrSnapshot());
        const { largestSingleDayFiling: _omit, ...rest } =
            base.insider.krMetrics!;
        const scorecard = {
            ...base,
            insider: {
                ...base.insider,
                krMetrics:
                    filing === undefined
                        ? { ...rest, reports }
                        : { ...rest, reports, largestSingleDayFiling: filing },
            },
        };
        return buildAxisEvidence(scorecard, 'insider', locale).find(l =>
            l.id.startsWith('krInsiderReports')
        )!;
    }

    it('큰 비중의 하루 일괄 보고면 날짜·건수를 담은 줄로 바꾼다', () => {
        const line = reportsLine(800, { date: DATE, count: 742 });
        expect(line.id).toBe('krInsiderReportsBatch');
        expect(line.values).toMatchObject({
            reports: '800',
            date: '7월 21일',
            batchCount: '742',
        });
    });

    it('en: 날짜는 월 이름이고 1,000건 이상은 자릿점이 붙는다', () => {
        const line = reportsLine(1_500, { date: DATE, count: 1_200 }, 'en');
        expect(line.values).toMatchObject({
            reports: '1,500',
            date: 'Jul 21',
            batchCount: '1,200',
        });
    });

    it('건수 하한 경계: 하한은 주석, 하한-1은 없음', () => {
        expect(reportsLine(MIN + 10, { date: DATE, count: MIN }).id).toBe(
            'krInsiderReportsBatch'
        );
        expect(reportsLine(MIN + 10, { date: DATE, count: MIN - 1 }).id).toBe(
            'krInsiderReports'
        );
    });

    it('비중 경계: 정확히 절반은 주석, 그 미만은 없음', () => {
        const reports = 800;
        const half = reports * KR_BATCH_FILING_MIN_SHARE;
        expect(reportsLine(reports, { date: DATE, count: half }).id).toBe(
            'krInsiderReportsBatch'
        );
        expect(reportsLine(reports, { date: DATE, count: half - 1 }).id).toBe(
            'krInsiderReports'
        );
    });

    it('건수 하한과 비중 경계가 겹쳐도 주석을 낸다', () => {
        const reports = MIN / KR_BATCH_FILING_MIN_SHARE;
        expect(reportsLine(reports, { date: DATE, count: MIN }).id).toBe(
            'krInsiderReportsBatch'
        );
    });

    it('null이거나 필드가 없으면 주석을 내지 않는다', () => {
        expect(reportsLine(800, null).id).toBe('krInsiderReports');
        expect(reportsLine(800, undefined).id).toBe('krInsiderReports');
    });

    it('batchFilingNote: 보고 0건·전체보다 큰 건수·잘못된 날짜는 null이다', () => {
        const ok = {
            reports: 100,
            largestSingleDayFiling: { date: DATE, count: 60 },
        };
        expect(batchFilingNote(ok, 'ko')).not.toBeNull();
        expect(batchFilingNote({ ...ok, reports: 0 }, 'ko')).toBeNull();
        expect(
            batchFilingNote(
                {
                    reports: 50,
                    largestSingleDayFiling: { date: DATE, count: 60 },
                },
                'ko'
            )
        ).toBeNull();
        for (const date of ['2026-xx-21', '2026-13-01', '2026-02-30', '7/21']) {
            expect(
                batchFilingNote(
                    { ...ok, largestSingleDayFiling: { date, count: 60 } },
                    'ko'
                )
            ).toBeNull();
        }
    });

    it('core 평가기가 만든 largestSingleDayFiling으로도 주석이 난다', () => {
        const insiderReports = Array.from({ length: MIN + 5 }, (_, i) =>
            makeKrInsiderRecord({
                rceptNo: `2026101300${String(1000 + i)}`,
                reporter: `보고자${i}`,
            })
        );
        const scorecard = evaluate(makeKrSnapshot({ insiderReports }));
        expect(scorecard.insider.krMetrics?.largestSingleDayFiling).toEqual({
            date: '2026-10-13',
            count: MIN + 5,
        });
        const line = buildAxisEvidence(scorecard, 'insider', 'en').find(l =>
            l.id.startsWith('krInsiderReports')
        );
        expect(line?.id).toBe('krInsiderReportsBatch');
        expect(line?.values.date).toBe('Oct 13');
    });
});
