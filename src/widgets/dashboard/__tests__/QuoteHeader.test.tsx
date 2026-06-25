import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuoteHeader } from '@/widgets/dashboard/QuoteHeader';
import type { QuoteHeaderData } from '@/widgets/dashboard/QuoteHeader';

const BASE: QuoteHeaderData = {
    symbol: 'AAPL',
    koreanName: '애플',
    price: 189.5,
    changePercent: 1.23,
};

describe('QuoteHeader', () => {
    it('티커를 translate="no"로 렌더한다', () => {
        render(<QuoteHeader data={BASE} />);
        const ticker = screen.getByText('AAPL');
        expect(ticker).toHaveAttribute('translate', 'no');
    });

    it('한국어 이름을 렌더한다', () => {
        render(<QuoteHeader data={BASE} />);
        expect(screen.getByText('애플')).toBeDefined();
    });

    it('가격을 $ 접두어와 함께 렌더한다', () => {
        render(<QuoteHeader data={BASE} />);
        // formatUsdPrice(189.5) 결과가 포함됨
        const priceEl = screen.getByText(text => text.includes('$'));
        expect(priceEl).toBeDefined();
    });

    it('등락률과 부호를 렌더하고 sr-only 레이블을 포함한다', () => {
        render(<QuoteHeader data={BASE} />);
        // 퍼센트 값이 노출된다
        expect(screen.getByText(text => text.includes('1.23%'))).toBeDefined();
        // 스크린리더용 sr-only 레이블이 존재한다
        const srOnlyEls = document.querySelectorAll('.sr-only');
        expect(srOnlyEls.length).toBeGreaterThan(0);
    });

    it('화살표 아이콘에 aria-hidden이 설정된다', () => {
        render(<QuoteHeader data={BASE} />);
        const arrowEl = document.querySelector('[aria-hidden="true"]');
        expect(arrowEl).not.toBeNull();
    });

    it('하락 시 음수 등락률을 렌더한다', () => {
        render(<QuoteHeader data={{ ...BASE, changePercent: -2.5 }} />);
        expect(screen.getByText(text => text.includes('2.50%'))).toBeDefined();
    });
});
