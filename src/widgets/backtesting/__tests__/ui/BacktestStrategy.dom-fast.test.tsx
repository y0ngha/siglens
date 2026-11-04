import { render, screen } from '@testing-library/react';
import type { BacktestRunInfo } from '@y0ngha/siglens-core';
import type { BacktestStats } from '@/entities/backtest-case/model';

import { BacktestStrategy } from '../../BacktestStrategy';

const RUN: BacktestRunInfo = {
    runId: '2026-11-daily-ai',
    periodStart: '2024-11-01',
    periodEnd: '2026-11-02',
    tickers: ['NVDA'],
    model: 'deepseek-v4.1-flash',
    coreVersion: '2.29.0',
    promptVersion: 'p32',
    siglensVersion: '0.114.1',
    generatedAt: '2026-11-04T00:00:00.000Z',
    resultsUrl:
        'https://github.com/y0ngha/siglens/tree/master/backtest-results/2026-11-daily-ai',
    releaseUrl:
        'https://github.com/y0ngha/siglens/releases/tag/backtest-2026-11-daily-ai',
};

const STATS = {
    exitPaths: [
        { path: 'tp1_tpFinal', trades: 94, meanReturnPct: 5.59 },
        { path: 'sl1_sl2', trades: 241, meanReturnPct: -2.57 },
    ],
} as unknown as BacktestStats;

describe('BacktestStrategy', () => {
    it('lists the seven strategy steps in order', () => {
        render(<BacktestStrategy run={RUN} stats={STATS} />);
        expect(
            screen.getByRole('heading', { level: 2, name: '사용한 전략' })
        ).toBeInTheDocument();
        const items = screen.getAllByRole('listitem');
        expect(
            items.slice(0, 7).map(li => li.querySelector('p')?.textContent)
        ).toEqual([
            '매일 분석',
            '이전 분석 참고',
            '진입',
            '절반씩 나눠 정리',
            '보유 중 재분석',
            '급락 매수 규칙',
            '체결 가정과 한계',
        ]);
    });

    it('keeps the heading hierarchy: one h2, sub-headings only for the table and data', () => {
        render(<BacktestStrategy run={RUN} stats={STATS} />);
        expect(
            screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
        ).toEqual(['청산 경로별 결과', '데이터']);
    });

    it('makes the scrollable table reachable by keyboard', () => {
        render(<BacktestStrategy run={RUN} stats={STATS} />);
        expect(
            screen.getByRole('region', { name: '청산 경로별 결과' })
        ).toHaveAttribute('tabindex', '0');
    });

    it('injects the model name and rule numbers into the copy', () => {
        render(<BacktestStrategy run={RUN} stats={STATS} />);
        expect(
            screen.getByText(/모델은 DeepSeek V4.1 Flash이고/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/최근 21거래일 안에서 최대 7건/)
        ).toBeInTheDocument();
        expect(screen.getByText(/10거래일째에 정리했어요/)).toBeInTheDocument();
        expect(
            screen.getByText(/최대 보유 기간은 60거래일/)
        ).toBeInTheDocument();
    });

    it('renders the exit path table with signed means', () => {
        render(<BacktestStrategy run={RUN} stats={STATS} />);
        const win = screen
            .getByRole('rowheader', { name: '1차 익절 + 최종 익절' })
            .closest('tr');
        expect(win).toHaveTextContent('94');
        expect(win).toHaveTextContent('+5.59%');
        const loss = screen
            .getByRole('rowheader', { name: '1차 손절선 + 2차 손절선' })
            .closest('tr');
        expect(loss).toHaveTextContent('-2.57%');
    });

    it('links to the public results and the release archive in a new tab', () => {
        render(<BacktestStrategy run={RUN} stats={STATS} />);
        const results = screen.getByRole('link', {
            name: '채점 기록(CSV)과 상세 결과',
        });
        expect(results).toHaveAttribute('href', RUN.resultsUrl);
        expect(results).toHaveAttribute('rel', 'noopener noreferrer');
        expect(
            screen.getByRole('link', { name: '호출별 프롬프트와 AI 응답 전문' })
        ).toHaveAttribute('href', RUN.releaseUrl);
    });
});
