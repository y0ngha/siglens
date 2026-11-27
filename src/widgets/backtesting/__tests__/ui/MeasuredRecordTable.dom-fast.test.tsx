import { render, screen, within } from '@testing-library/react';
import type { BaseRateVerdict, MeasuredBaseRate } from '@y0ngha/siglens-core';
import {
    MeasuredRecordTable,
    type MeasuredRecordKind,
} from '../../ui/record/MeasuredRecordTable';

const rate = (verdict: BaseRateVerdict): MeasuredBaseRate => ({
    subject: 'chart_pattern',
    key: 'x',
    n: 1234,
    eventShare: 0.25,
    placeboShare: 0.2,
    difference: { mean: 0.05, low: -0.01, high: 0.11 },
    verdict,
    scope: {
        timeframe: '1Day',
        symbols: 3,
        from: '2020-01-02',
        to: '2021-02-03',
    },
});

const INSUFFICIENT = '표본이 적어 비율을 싣지 않아요.';

const renderRow = (
    kind: MeasuredRecordKind,
    value: MeasuredBaseRate | null
) => {
    render(
        <MeasuredRecordTable
            kind={kind}
            regionLabel="표"
            nameHeader="이름"
            rows={[{ id: 'r', label: '행', rate: value }]}
        />
    );
    return within(screen.getAllByRole('row')[1]);
};

describe('MeasuredRecordTable', () => {
    it('writes the beats sentence for beats_placebo', () => {
        const row = renderRow('pattern', rate('beats_placebo'));
        expect(row.getByRole('cell', { name: /1,234건/ })).toHaveTextContent(
            '25.0% (1,234건), 같은 거리의 다른 날 20.0%'
        );
        expect(
            row.getByText(
                '같은 거리의 다른 날 가격보다 더 자주 닿았지만, 앞으로를 보장하지는 않아요.'
            )
        ).toBeInTheDocument();
    });

    it('writes the no-edge sentence for no_edge', () => {
        const row = renderRow('level', rate('no_edge'));
        expect(
            row.getByText(
                '같은 거리의 다른 날 가격과 비교해 측정된 우위는 없어요.'
            )
        ).toBeInTheDocument();
    });

    it('prints no rate for insufficient_sample, only the shortage sentence', () => {
        const row = renderRow('pattern', rate('insufficient_sample'));
        expect(row.getByText(INSUFFICIENT)).toBeInTheDocument();
        expect(row.queryByText(/%/)).toBeNull();
        expect(row.queryByText(/우위/)).toBeNull();
    });

    it('prints the shortage sentence for a row without its own measurement', () => {
        const row = renderRow('level', null);
        expect(row.getByText(INSUFFICIENT)).toBeInTheDocument();
        expect(row.queryByText(/%/)).toBeNull();
    });

    it('compares candles with other days of the same stock, not the same distance', () => {
        const beats = renderRow('candle', rate('beats_placebo'));
        expect(beats.getByRole('cell', { name: /1,234건/ })).toHaveTextContent(
            '25.0% (1,234건), 같은 종목의 다른 날 20.0%'
        );
        expect(
            beats.getByText(
                '같은 종목의 다른 날보다 더 자주 맞았지만, 앞으로를 보장하지는 않아요.'
            )
        ).toBeInTheDocument();
        expect(beats.queryByText(/같은 거리/)).toBeNull();
    });

    it('writes the candle no-edge sentence', () => {
        const row = renderRow('candle', rate('no_edge'));
        expect(
            row.getByText('같은 종목의 다른 날과 비교해 측정된 우위는 없어요.')
        ).toBeInTheDocument();
    });
});
