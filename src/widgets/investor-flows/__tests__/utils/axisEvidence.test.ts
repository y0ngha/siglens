import { describe, expect, it } from 'vitest';
import { buildAxisEvidence } from '../../utils/axisEvidence';
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
