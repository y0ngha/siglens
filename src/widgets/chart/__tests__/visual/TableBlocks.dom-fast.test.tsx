import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ko from '../../../../../messages/ko.json';
import { HeatmapBlockView } from '@/widgets/chart/visual/HeatmapBlockView';
import { PortfolioBlockView } from '@/widgets/chart/visual/PortfolioBlockView';
import type { ChatHeatmapBlock } from '@/entities/chat-conversation/types';
import { HEATMAP_SECTORS, HEATMAP_THEME, PORTFOLIO } from './fixtures';

function wrap(node: React.ReactNode) {
    return render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {node}
        </NextIntlClientProvider>
    );
}

/** 표 본문의 행을 칸 글자 배열로(머리글 행은 뺀다). */
function tableRows(table: HTMLElement): string[][] {
    return within(table)
        .getAllByRole('row')
        .slice(1)
        .map(row =>
            Array.from(row.querySelectorAll('th, td'), c => c.textContent ?? '')
        );
}

describe('HeatmapBlockView — 표', () => {
    it('섹터: 이름·등락률 머리글과 받은 순서 그대로의 행, 상승·하락 글자색', () => {
        wrap(<HeatmapBlockView block={HEATMAP_SECTORS} />);
        const table = screen.getByRole('table', {
            name: '오늘의 미국 섹터 등락률',
        });
        expect(
            within(table)
                .getAllByRole('columnheader')
                .map(th => th.textContent)
        ).toEqual(['섹터', '등락률']);
        expect(
            within(table)
                .getAllByRole('rowheader')
                .map(th => th.textContent)
        ).toEqual(['기술', '에너지']);
        expect(within(table).getByText('+1.8%')).toHaveClass(
            'text-ui-success-text'
        );
        expect(within(table).getByText('-2.1%')).toHaveClass(
            'text-ui-danger-text'
        );
        // 좁은 화면용 카드도 같은 값을 갖는다.
        expect(screen.getAllByText('+1.8%')).toHaveLength(2);
    });

    it('테마: 이름·심볼·1·5·20일 열, 1일 등락률이 큰 순, 값이 없으면 줄표', () => {
        wrap(<HeatmapBlockView block={HEATMAP_THEME} />);
        const table = screen.getByRole('table', {
            name: 'AI 반도체 테마 구성 종목 등락률',
        });
        expect(
            within(table)
                .getAllByRole('columnheader')
                .map(th => th.textContent)
        ).toEqual(['이름', '종목', '1일', '5일', '20일']);
        expect(tableRows(table)).toEqual([
            ['엔비디아', 'NVDA', '+3.0%', '+4.0%', '+5.0%'],
            ['-', 'AMD', '-1.0%', '+2.0%', '-'],
        ]);
    });

    it('이름이 없는 옛 블록(테마 구성 종목)도 그린다', () => {
        const legacy: ChatHeatmapBlock = {
            version: 1,
            asOf: HEATMAP_THEME.asOf,
            kind: 'heatmap',
            scope: 'theme',
            theme: 'ai_semis',
            label: 'AI 반도체',
            members: [
                {
                    symbol: 'NVDA',
                    changePct1d: 3,
                    changePct5d: null,
                    changePct20d: null,
                } as never,
            ],
        };
        wrap(<HeatmapBlockView block={legacy} />);
        expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0);
    });
});

describe('PortfolioBlockView — 표', () => {
    it('통화 그룹마다 표 하나: 이름·심볼·비중·손익률, 손익 글자색, 모르는 값은 줄표', () => {
        wrap(<PortfolioBlockView block={PORTFOLIO} />);
        const usd = screen.getByRole('table', { name: 'USD 보유종목' });
        const krw = screen.getByRole('table', { name: 'KRW 보유종목' });
        expect(
            within(usd)
                .getAllByRole('columnheader')
                .map(th => th.textContent)
        ).toEqual(['이름', '종목', '비중', '손익률']);
        expect(tableRows(usd)).toEqual([
            ['Apple', 'AAPL', '60.0%', '+12.5%'],
            ['-', 'KO', '40.0%', '-3.0%'],
        ]);
        expect(within(usd).getByText('+12.5%')).toHaveClass(
            'text-ui-success-text'
        );
        expect(within(usd).getByText('-3.0%')).toHaveClass(
            'text-ui-danger-text'
        );
        expect(tableRows(krw)).toEqual([['삼성전자', '005930.KS', '-', '-']]);
    });

    it('제목과 기준 시각을 단다', () => {
        wrap(<PortfolioBlockView block={PORTFOLIO} />);
        expect(screen.getByText('내 보유종목 비중과 손익')).toBeInTheDocument();
        expect(screen.getByText('기준 2026-11-19')).toBeInTheDocument();
    });
});
