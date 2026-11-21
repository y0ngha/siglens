import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FEAR_GREED_LOOKBACK_DAYS } from '@y0ngha/siglens-core';
import { scoredHistory } from '@/__tests__/utils/marketFearGreedHubView';
import { FearGreedHistorySection } from '../FearGreedHistorySection';

// 차트는 캔버스(lightweight-charts)라 jsdom에서 못 그린다. 서버 HTML의 숫자는 표가 맡는다.
const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));
vi.mock('@/widgets/fear-greed/LazyFearGreedHistoricalChart', () => ({
    LazyFearGreedHistoricalChart: (props: { history: unknown[] }) => {
        chartSpy(props.history.length);
        return <div data-testid="chart" />;
    },
}));

/** 2026-11-20 기준 `count`일치 기록. 점수는 10부터 하루 1점씩. */
const HISTORY_400 = scoredHistory(400, '2026-11-20');

function renderSection(
    overrides: Partial<Parameters<typeof FearGreedHistorySection>[0]> = {}
) {
    return render(
        <FearGreedHistorySection
            market="us"
            subject="미국 증시"
            locale="ko"
            history={HISTORY_400}
            extremeZone={<div role="group" aria-label="극단 구간 기록" />}
            {...overrides}
        />
    );
}

describe('FearGreedHistorySection', () => {
    it('h2 하나와 h3 셋(추이, 최근 표, 월별 표)을 그린다', () => {
        renderSection();

        expect(
            screen.getByRole('heading', { level: 2, name: '지난 점수 기록' })
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
        ).toEqual(['최근 추이', '최근 20거래일', '월별 기록']);
    });

    it('캡션 이름으로 표를 찾고, 최근 표는 20행에 행 머리(th scope=row)가 있다', () => {
        renderSection();

        const recent = screen.getByRole('table', {
            name: '미국 증시 최근 20거래일 공포 탐욕 지수',
        });
        const bodyRows = within(recent).getAllByRole('row').slice(1);
        expect(bodyRows).toHaveLength(20);
        expect(within(bodyRows[0]).getByRole('rowheader')).toHaveTextContent(
            '2026년 11월 20일'
        );
        expect(within(bodyRows[0]).getByRole('rowheader')).toHaveAttribute(
            'scope',
            'row'
        );
        expect(
            within(recent)
                .getAllByRole('columnheader')
                .map(h => h.textContent)
        ).toEqual(['날짜', '점수', '구간', '전 거래일 대비']);
    });

    it('암호화폐는 거래일이 아니라 일 단위 문구를 쓴다', () => {
        renderSection({ market: 'crypto', subject: '암호화폐 시장' });

        expect(
            screen.getByRole('heading', { level: 3, name: '최근 20일' })
        ).toBeInTheDocument();
        const recent = screen.getByRole('table', {
            name: '암호화폐 시장 최근 20일 공포 탐욕 지수',
        });
        expect(
            within(recent)
                .getAllByRole('columnheader')
                .map(h => h.textContent)
        ).toEqual(['날짜', '점수', '구간', '전날 대비']);
        expect(screen.queryByText('최근 20거래일')).not.toBeInTheDocument();
        expect(screen.queryByText('전 거래일 대비')).not.toBeInTheDocument();
    });

    it('전 거래일 대비는 부호를 붙여 보이고 0은 부호가 없다', () => {
        // 마지막 두 날 점수가 같고(변화 0), 그 전은 하루 1점씩 오른다.
        const flat = scoredHistory(40, '2026-11-20').map((p, i, all) =>
            i === all.length - 1 ? { ...all[i - 1], date: p.date } : p
        );
        renderSection({ history: flat });

        const recent = screen.getByRole('table', {
            name: '미국 증시 최근 20거래일 공포 탐욕 지수',
        });
        const rows = within(recent).getAllByRole('row').slice(1);
        const changeOf = (row: HTMLElement) =>
            within(row).getAllByRole('cell')[2].textContent;
        expect(changeOf(rows[0])).toBe('0');
        expect(changeOf(rows[1])).toBe('+1');
    });

    it('최근 표는 좁은 화면에서 열이 잘리지 않게 min-w를 두지 않고, 월별 표만 스크롤한다', () => {
        renderSection();

        const recent = screen.getByRole('table', {
            name: '미국 증시 최근 20거래일 공포 탐욕 지수',
        });
        const monthly = screen.getByRole('table', {
            name: '미국 증시 월별 공포 탐욕 지수',
        });
        expect(recent.className).not.toContain('min-w');
        expect(monthly.className).toContain('min-w-[22rem]');
        // 넓은 화면에서 열이 멀리 벌어지지 않게 폭을 막는다.
        expect(recent.className).toContain('max-w-2xl');
        expect(monthly.className).toContain('max-w-2xl');
    });

    it('월별 표는 최근 12개월을 펼치고 나머지는 닫힌 details에 둔다', () => {
        const { container } = renderSection();

        const open = screen.getByRole('table', {
            name: '미국 증시 월별 공포 탐욕 지수',
        });
        expect(within(open).getAllByRole('row').slice(1)).toHaveLength(12);

        const details = container.querySelector('details');
        expect(details).not.toBeNull();
        expect(details).not.toHaveAttribute('open');
        // 400일 = 2025-10-17부터 13.1개월 → 14개월, 12개월을 펼치면 2개월이 남는다.
        expect(
            within(details as HTMLElement).getByText('이전 2개월 보기')
        ).toBeInTheDocument();
        const older = within(details as HTMLElement).getByRole('table', {
            hidden: true,
            name: '미국 증시 월별 공포 탐욕 지수(이전 기록)',
        });
        expect(
            within(older).getAllByRole('row', { hidden: true }).slice(1)
        ).toHaveLength(2);
    });

    it('12개월 이하면 details를 그리지 않는다', () => {
        const { container } = renderSection({
            history: scoredHistory(100, '2026-11-20'),
        });

        expect(container.querySelector('details')).toBeNull();
    });

    it('첫 달과 마지막 달에는 일부만 담겼다는 표시가 붙는다', () => {
        renderSection({ history: scoredHistory(100, '2026-11-20') });

        const monthly = screen.getByRole('table', {
            name: '미국 증시 월별 공포 탐욕 지수',
        });
        const heads = within(monthly)
            .getAllByRole('rowheader')
            .map(h => h.textContent);
        expect(heads[0]).toBe('2026년 11월(20일까지)');
        expect(heads.at(-1)).toBe('2026년 8월(13일부터)');
        expect(heads[1]).toBe('2026년 10월');
    });

    it('내려받기 링크는 시장 경로의 csv·json이고 download 속성이 있다', () => {
        renderSection({ market: 'kr' });

        const csv = screen.getByRole('link', { name: 'CSV 파일' });
        const json = screen.getByRole('link', { name: 'JSON 파일' });
        expect(csv).toHaveAttribute('href', '/fear-greed/kr/data.csv');
        expect(json).toHaveAttribute('href', '/fear-greed/kr/data.json');
        expect(csv).toHaveAttribute('download');
        expect(json).toHaveAttribute('download');
    });

    it('날짜 셀은 time dateTime을 가진다', () => {
        const { container } = renderSection();

        expect(
            container.querySelector('time[datetime="2026-11-20"]')
        ).not.toBeNull();
        expect(
            container.querySelector('time[datetime="2026-11"]')
        ).not.toBeNull();
    });

    it('다시 계산된다는 안내에 비교 기간(core 상수에서 나온 5년)이 들어 있다', () => {
        renderSection();

        expect(Math.round(FEAR_GREED_LOOKBACK_DAYS / 365)).toBe(5);
        expect(
            screen.getByText(/최근 5년으로 정해져 있어서/)
        ).toBeInTheDocument();
    });

    it('기간 문장과 파일 안내를 싣는다', () => {
        renderSection();

        expect(
            screen.getByText(/날마다 계산한 점수 400개를 모았습니다/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '파일에는 날짜, 점수, 구간만 들어 있고 가격 자료는 없습니다.'
            )
        ).toBeInTheDocument();
    });

    it('차트에는 전체 기록이 아니라 마지막 252점만 넘긴다', () => {
        chartSpy.mockClear();
        renderSection();

        expect(screen.getByTestId('chart')).toBeInTheDocument();
        expect(chartSpy).toHaveBeenCalledWith(252);
    });

    it('극단 구간 기록 자리(extremeZone)를 카드 안에 그린다', () => {
        renderSection();

        expect(
            screen.getByRole('group', { name: '극단 구간 기록' })
        ).toBeInTheDocument();
    });
});
