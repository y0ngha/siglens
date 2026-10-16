import { describe, expect, it } from 'vitest';
import { buildAxisEvidence } from '../../utils/axisEvidence';
import {
    evaluate,
    makeEmptySnapshot,
    makeExpandedSnapshot,
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
        expect(line?.values.pct).toBe(`${pct!.toFixed(3)}%`);
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

    it('대량보유: 13D/13G 건수와 창 길이', () => {
        expect(buildAxisEvidence(card, 'largeHolders', 'en')).toEqual([
            {
                id: 'largeHolderCounts',
                values: {
                    d: '1',
                    g: '0',
                    days: String(card.freshness.largeHolderWindow.days),
                },
            },
        ]);
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
