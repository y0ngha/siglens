import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EXTREME_ZONE_REENTRY_GAP } from '@y0ngha/siglens-core';
import { FearGreedExtremeZoneTable } from '../FearGreedExtremeZoneTable';
import type { ExtremeZoneTable } from '../utils/fearGreedFacts';

const NOTICE = '앞으로의 가격을 예측하거나 매수·매도를 권하지 않아요';

const BASE: Omit<ExtremeZoneTable, 'rows'> = {
    from: '2024년 12월 2일',
    to: '2026년 10월 2일',
    horizons: [5, 20, 60],
};

const TABLE: ExtremeZoneTable = {
    ...BASE,
    rows: [
        {
            zone: 'EXTREME_FEAR',
            label: '극심한 공포',
            entryCount: 6,
            cells: [
                { horizon: 5, sampleSize: 6, median: '+4.5%' },
                { horizon: 20, sampleSize: 6, median: '-1.2%' },
                { horizon: 60, sampleSize: 4, median: null },
            ],
        },
    ],
};

/**
 * 사후 집계 표의 불변식: 기간·고지가 표와 같은 블록에 **항상** 있고, 표본 부족
 * 칸은 숫자 대신 "표본 부족"이다. 투자 권유로 읽히지 않게 하는 장치라 직접 고정한다.
 */
describe('FearGreedExtremeZoneTable', () => {
    it('중앙값 칸은 값과 표본 수를, 표본이 모자란 칸은 "표본 부족"을 보인다', () => {
        render(<FearGreedExtremeZoneTable table={TABLE} />);

        const row = screen.getByRole('row', { name: /극심한 공포/ });
        expect(within(row).getByText('6회')).toBeInTheDocument();
        expect(within(row).getByText('+4.5% (표본 6)')).toBeInTheDocument();
        expect(within(row).getByText('-1.2% (표본 6)')).toBeInTheDocument();
        expect(within(row).getByText('표본 부족 (4)')).toBeInTheDocument();
    });

    it('열 머리는 구간·진입·거래일별 열이다', () => {
        render(<FearGreedExtremeZoneTable table={TABLE} />);

        const headers = screen
            .getAllByRole('columnheader')
            .map(h => h.textContent);
        expect(headers).toEqual([
            '구간',
            '진입',
            '5거래일 뒤',
            '20거래일 뒤',
            '60거래일 뒤',
        ]);
    });

    it('집계 기간과 core의 재진입 간격을 기간 문장에 싣는다', () => {
        render(<FearGreedExtremeZoneTable table={TABLE} />);

        const block = screen.getByRole('group', {
            name: '극단 구간 진입 이후 종가 변화',
        });
        expect(block).toHaveTextContent('2024년 12월 2일 ~ 2026년 10월 2일');
        expect(block).toHaveTextContent(
            `${EXTREME_ZONE_REENTRY_GAP}거래일 안에 다시 들어온 날은 새 진입으로 세지 않습니다`
        );
    });

    it('표가 있을 때 고지를 같은 블록에 렌더한다', () => {
        render(<FearGreedExtremeZoneTable table={TABLE} />);

        const block = screen.getByRole('group', {
            name: '극단 구간 진입 이후 종가 변화',
        });
        expect(block).toHaveTextContent(NOTICE);
    });

    it('진입이 없으면 표 대신 사실 한 줄을 보이고, 고지는 그대로 렌더한다', () => {
        render(<FearGreedExtremeZoneTable table={{ ...BASE, rows: [] }} />);

        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        const block = screen.getByRole('group', {
            name: '극단 구간 진입 이후 종가 변화',
        });
        expect(block).toHaveTextContent('새로 들어온 적이 없습니다');
        expect(block).toHaveTextContent(NOTICE);
    });
});
