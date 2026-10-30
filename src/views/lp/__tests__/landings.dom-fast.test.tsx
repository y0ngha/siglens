import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { SITE_URL } from '@/shared/lib/seo';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { StockAnalysisLanding } from '@/views/lp/StockAnalysisLanding';
import { StockChatLanding } from '@/views/lp/StockChatLanding';
import { lpCopyViolations } from './lpCopyRules';

function pageText(container: HTMLElement): string {
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script').forEach(s => s.remove());
    return clone.textContent ?? '';
}

describe.each([
    ['StockAnalysisLanding', StockAnalysisLanding],
    ['StockChatLanding', StockChatLanding],
])('%s copy rules', (_name, Landing) => {
    it('has no crypto wording, middle dot, em dash, "티커" or "no signup" phrasing', () => {
        const { container } = render(<Landing />);
        expect(lpCopyViolations(pageText(container))).toEqual([]);
    });

    it('styles every h3 one step below its h2 (HEADING_SUBSECTION)', () => {
        render(<Landing />);
        const h3s = screen.getAllByRole('heading', { level: 3 });
        expect(h3s.length).toBeGreaterThan(0);
        for (const h3 of h3s) {
            expect(h3).toHaveClass(...HEADING_SUBSECTION.split(' '));
            expect(h3).not.toHaveClass('text-secondary-50', 'font-semibold');
        }
    });

    it('has a minimal footer: privacy, terms, disclaimer', () => {
        render(<Landing />);
        const footer = screen.getByRole('contentinfo');
        expect(
            within(footer).getByRole('link', { name: '개인정보처리방침' })
        ).toHaveAttribute('href', `${SITE_URL}/privacy`);
        expect(
            within(footer).getByRole('link', { name: '이용약관' })
        ).toHaveAttribute('href', `${SITE_URL}/terms`);
        expect(footer).toHaveTextContent(
            '투자 권유가 아닌 참고용 정보입니다. 투자 판단은 본인 책임입니다.'
        );
    });
});

describe('StockAnalysisLanding', () => {
    it('logo links to the page itself and CTAs open a symbol page', () => {
        render(<StockAnalysisLanding />);
        const header = screen.getByRole('banner');
        expect(
            within(header).getByRole('link', { name: 'SIGLENS' })
        ).toHaveAttribute('href', '/lp/stock-analysis');
        for (const cta of screen.getAllByRole('link', {
            name: '종목 분석 시작',
        })) {
            expect(cta).toHaveAttribute('href', `${SITE_URL}/NVDA`);
        }
    });

    it('shows the hero, four feature cards and popular stocks', () => {
        render(<StockAnalysisLanding />);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: '종목 하나로 AI 종합 분석',
            })
        ).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
        for (const symbol of [
            'NVDA',
            'AAPL',
            'TSLA',
            '005930.KS',
            '000660.KS',
        ]) {
            expect(
                screen.getByRole('link', { name: new RegExp(symbol) })
            ).toHaveAttribute('href', `${SITE_URL}/${symbol}`);
        }
    });

    it('keeps each feature title and its market scope apart in the heading name', () => {
        render(<StockAnalysisLanding />);
        const names = screen
            .getAllByRole('heading', { level: 3 })
            .map(h => h.textContent);
        expect(names).toEqual([
            '차트 지표 AI 해석 미국, 한국',
            '지지선과 저항선 정리 미국, 한국',
            '공포탐욕지수 미국, 한국',
            '옵션과 재무, 뉴스 옵션은 미국 주식',
        ]);
    });

    it('lists popular stocks company name first, ticker second', () => {
        render(<StockAnalysisLanding />);
        const list = screen.getByRole('region', { name: '많이 찾는 종목' });
        const names = within(list)
            .getAllByRole('link')
            .map(link => link.textContent);
        expect(names).toEqual([
            '엔비디아 NVDA',
            '애플 AAPL',
            '테슬라 TSLA',
            '삼성전자 005930.KS',
            'SK하이닉스 000660.KS',
        ]);
    });

    it('shows the example report replay, complete on first render', () => {
        render(<StockAnalysisLanding />);
        const replay = screen.getByRole('region', {
            name: '시그렌즈 분석 과정 예시',
        });
        expect(replay).toHaveTextContent('siglens.io/AAPL');
        expect(replay).toHaveTextContent('50일 이동평균선');
    });
});

describe('StockChatLanding', () => {
    it('logo links to the page itself and CTAs open the chat', () => {
        render(<StockChatLanding />);
        const header = screen.getByRole('banner');
        expect(
            within(header).getByRole('link', { name: 'SIGLENS' })
        ).toHaveAttribute('href', '/lp/stock-chat');
        const ctas = screen.getAllByRole('link', { name: 'AI에게 물어보기' });
        expect(ctas.length).toBeGreaterThan(1);
        for (const cta of ctas) {
            expect(cta).toHaveAttribute('href', `${AI_SITE_URL}/`);
        }
    });

    it('shows example questions, how it answers and a 3-item FAQ', () => {
        render(<StockChatLanding />);
        expect(
            screen.getByRole('heading', { level: 1, name: '주식 전용 AI 챗봇' })
        ).toBeInTheDocument();
        expect(screen.getByText('삼성전자 요즘 어때?')).toBeInTheDocument();
        expect(
            screen.getByText('답변마다 출처와 기준 시각')
        ).toBeInTheDocument();
        const faq = screen.getByRole('region', { name: '자주 묻는 질문' });
        expect(within(faq).getAllByRole('group')).toHaveLength(3);
    });

    it('keeps the answer source chips apart in the text', () => {
        render(<StockChatLanding />);
        const how = screen.getByRole('region', { name: '이렇게 답해요' });
        const chips = within(how).getByText('기업 정보').parentElement;
        expect(chips?.textContent).toBe('시세 기업 정보 기준 2026-09-18');
    });

    it('shows the example chat replay, complete on first render', () => {
        render(<StockChatLanding />);
        const replay = screen.getByRole('region', {
            name: '시그렌즈 AI 예시 대화',
        });
        expect(replay).toHaveTextContent('삼성전자 요즘 흐름 어때?');
        expect(replay).toHaveTextContent('71,800원');
    });
});
