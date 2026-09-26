import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { SITE_URL } from '@/shared/lib/seo';
import { StockAnalysisLanding, StockChatLanding } from '../index';

/**
 * Google Ads (KR) limits any ad whose landing page mentions crypto. These pages
 * exist only as ad final URLs, so a single crypto word anywhere on them defeats
 * their purpose (spec `2026-09-26-ad-landing-pages-design.md` "Guard").
 */
const CRYPTO_RE =
    /코인|비트코인|이더리움|암호화폐|가상자산|크립토|crypto|bitcoin/i;

function pageText(container: HTMLElement): string {
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script').forEach(s => s.remove());
    return clone.textContent ?? '';
}

describe.each([
    ['StockAnalysisLanding', StockAnalysisLanding],
    ['StockChatLanding', StockChatLanding],
])('%s copy rules', (_name, Landing) => {
    it('has no crypto wording, middle dot, em dash or "no signup" phrasing', () => {
        const { container } = render(<Landing />);
        const text = pageText(container);
        expect(text).not.toMatch(CRYPTO_RE);
        expect(text).not.toContain('·');
        expect(text).not.toContain('—');
        expect(text).not.toMatch(/(가입|로그인)\s*없이/);
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

    it('shows the hero, four feature cards and popular tickers', () => {
        render(<StockAnalysisLanding />);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: '티커 하나로 AI 종합 분석',
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
        expect(within(faq).getAllByRole('term')).toHaveLength(3);
    });
});
