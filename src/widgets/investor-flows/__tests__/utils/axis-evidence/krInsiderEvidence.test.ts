import { describe, expect, it } from 'vitest';
import { krInsiderLines } from '../../../utils/axis-evidence/krInsiderEvidence';
import {
    evaluate,
    makeEmptySnapshot,
    makeKrInsiderRecord,
    makeKrSnapshot,
} from '../../fixtures/flowsFixtures';

describe('krInsiderLines', () => {
    it('보고 건수·순 주식 증감·순 비율·거래계획 줄을 만든다', () => {
        expect(krInsiderLines(evaluate(makeKrSnapshot()), 'en')).toEqual([
            {
                id: 'krInsiderReports',
                values: { days: '90', reports: '2', reporters: '2' },
            },
            { id: 'krInsiderNetShares', values: { shares: '+18M' } },
            { id: 'krInsiderNetPct', values: { pct: '+0.30%' } },
            { id: 'krTradingPlans', values: { count: '1' } },
        ]);
    });

    it('순변동이 0이면 변동 없음 줄을 보고 건수 다음에 끼운다', () => {
        const lines = krInsiderLines(
            evaluate(
                makeKrSnapshot({ insiderReports: [makeKrInsiderRecord()] })
            ),
            'en'
        );
        expect(lines.map(l => l.id)).toEqual([
            'krInsiderReports',
            'krInsiderNoChange',
            'krInsiderNetShares',
            'krInsiderNetPct',
            'krTradingPlans',
        ]);
    });

    it('거래계획이 없으면 그 줄을 만들지 않는다', () => {
        const lines = krInsiderLines(
            evaluate(makeKrSnapshot({ tradingPlans: [] })),
            'en'
        );
        expect(lines.map(l => l.id)).not.toContain('krTradingPlans');
    });

    it('한국 지표가 없는 스냅샷이면 빈 배열이다', () => {
        expect(krInsiderLines(evaluate(makeEmptySnapshot()), 'en')).toEqual([]);
    });
});
