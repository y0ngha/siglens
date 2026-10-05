import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EXTREME_ZONE_REENTRY_GAP } from '@y0ngha/siglens-core';
import { FearGreedExtremeZoneRecord } from '../FearGreedExtremeZoneRecord';
import type { ExtremeZoneRecord } from '../utils/fearGreedFacts';

const NOTICE = '앞으로의 가격을 예측하거나 매수·매도를 권하지 않아요';
const GROUP_NAME = '극단 구간 기록';

const BASE: Omit<ExtremeZoneRecord, 'sections'> = {
    from: '2021년 11월 29일',
    to: '2026년 10월 2일',
};

const RECORD: ExtremeZoneRecord = {
    ...BASE,
    sections: [
        {
            zone: 'EXTREME_FEAR',
            label: '극심한 공포',
            entryCount: 10,
            medianSessions: 4.5,
            rows: [
                {
                    startDate: '2026년 4월 7일',
                    endDate: '2026년 4월 15일',
                    sessions: 6,
                    peakScore: 4,
                    ongoing: false,
                },
            ],
            omittedCount: 2,
        },
        {
            zone: 'EXTREME_GREED',
            label: '극심한 탐욕',
            entryCount: 1,
            medianSessions: 3,
            rows: [
                {
                    startDate: '2026년 9월 29일',
                    endDate: '2026년 10월 2일',
                    sessions: 3,
                    peakScore: 96,
                    ongoing: true,
                },
            ],
            omittedCount: 0,
        },
    ],
};

/**
 * 기록 표의 불변식: 수익률 없이 날짜·머문 거래일·극값만 보이고, 기간·고지가 표와
 * 같은 블록에 **항상** 있다. 투자 권유로 읽히지 않게 하는 장치라 직접 고정한다.
 */
describe('FearGreedExtremeZoneRecord', () => {
    it('구간마다 요약 줄과 진입일·마지막 날·머문 거래일·극값 행을 보인다', () => {
        render(<FearGreedExtremeZoneRecord record={RECORD} />);

        expect(
            screen.getByText(
                '극심한 공포: 10회 진입, 머문 기간 중앙값 4.5거래일'
            )
        ).toBeInTheDocument();
        const fearTable = screen.getByRole('table', {
            name: '극심한 공포 구간에 들어간 날과 머문 기간',
        });
        const row = within(fearTable).getByRole('row', {
            name: /2026년 4월 7일/,
        });
        expect(within(row).getByText('2026년 4월 15일')).toBeInTheDocument();
        expect(within(row).getByText('6일')).toBeInTheDocument();
        expect(within(row).getByText('4')).toBeInTheDocument();
    });

    it('공포 표는 가장 낮은 점수, 탐욕 표는 가장 높은 점수를 열 머리로 둔다', () => {
        render(<FearGreedExtremeZoneRecord record={RECORD} />);

        const headersOf = (name: string) =>
            within(screen.getByRole('table', { name }))
                .getAllByRole('columnheader')
                .map(h => h.textContent);
        expect(headersOf('극심한 공포 구간에 들어간 날과 머문 기간')).toEqual([
            '진입일',
            '마지막 날',
            '머문 거래일',
            '가장 낮은 점수',
        ]);
        expect(headersOf('극심한 탐욕 구간에 들어간 날과 머문 기간')).toEqual([
            '진입일',
            '마지막 날',
            '머문 거래일',
            '가장 높은 점수',
        ]);
    });

    it('진행 중인 기록은 마지막 날에 진행 중을 붙인다', () => {
        render(<FearGreedExtremeZoneRecord record={RECORD} />);

        expect(
            screen.getByText('2026년 10월 2일 (진행 중)')
        ).toBeInTheDocument();
    });

    it('생략한 이전 기록이 있으면 개수를 밝히고, 없으면 문장을 그리지 않는다', () => {
        render(<FearGreedExtremeZoneRecord record={RECORD} />);

        expect(
            screen.getAllByText(/이전 기록 \d+회는 생략했습니다/)
        ).toHaveLength(1);
        expect(
            screen.getByText('이전 기록 2회는 생략했습니다.')
        ).toBeInTheDocument();
    });

    it('점수가 없는 행은 대시로 둔다', () => {
        const [fear] = RECORD.sections;
        render(
            <FearGreedExtremeZoneRecord
                record={{
                    ...BASE,
                    sections: [
                        {
                            ...fear!,
                            rows: [{ ...fear!.rows[0]!, peakScore: null }],
                        },
                    ],
                }}
            />
        );

        const row = screen.getByRole('row', { name: /2026년 4월 7일/ });
        expect(within(row).getByText('—')).toBeInTheDocument();
    });

    it('집계 기간과 core의 재진입 간격을 기간 문장에 싣고, 수익률은 보이지 않는다', () => {
        render(<FearGreedExtremeZoneRecord record={RECORD} />);

        const block = screen.getByRole('group', { name: GROUP_NAME });
        expect(block).toHaveTextContent('2021년 11월 29일 ~ 2026년 10월 2일');
        expect(block).toHaveTextContent(
            `${EXTREME_ZONE_REENTRY_GAP}거래일 안에 다시 들어온 날은 같은 기록으로 묶었습니다`
        );
        expect(block).not.toHaveTextContent('%');
    });

    it('기록이 있을 때 고지를 같은 블록에 렌더한다', () => {
        render(<FearGreedExtremeZoneRecord record={RECORD} />);

        expect(
            screen.getByRole('group', { name: GROUP_NAME })
        ).toHaveTextContent(NOTICE);
    });

    it('진입이 없으면 표 대신 사실 한 줄을 보이고, 고지는 그대로 렌더한다', () => {
        render(
            <FearGreedExtremeZoneRecord record={{ ...BASE, sections: [] }} />
        );

        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        const block = screen.getByRole('group', { name: GROUP_NAME });
        expect(block).toHaveTextContent('새로 들어온 적이 없습니다');
        expect(block).toHaveTextContent(NOTICE);
    });
});
