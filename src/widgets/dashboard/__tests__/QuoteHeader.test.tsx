import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuoteHeader } from '@/widgets/dashboard/QuoteHeader';
import type { QuoteHeaderData } from '@/widgets/dashboard/QuoteHeader';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/lib/priceFormat', () => ({
    formatPriceChange: (percent: number) => ({
        sign: percent >= 0 ? '+' : '-',
        colorClass: percent >= 0 ? 'text-green' : 'text-red',
        arrow: percent >= 0 ? '▲' : '▼',
        arrowLabel: percent >= 0 ? '상승' : '하락',
    }),
    formatUsdPrice: (price: number) => price.toFixed(2),
}));

const BASE: QuoteHeaderData = {
    symbol: 'AAPL',
    koreanName: '애플',
    price: 189.5,
    changePercent: 1.23,
};

describe('QuoteHeader — layout: index (기본값)', () => {
    it('티커를 translate="no"로 렌더한다', () => {
        render(<QuoteHeader data={BASE} />);
        expect(screen.getByText('AAPL')).toHaveAttribute('translate', 'no');
    });

    it('한국어 이름을 렌더한다', () => {
        render(<QuoteHeader data={BASE} />);
        // getByText: 정확히 '애플' 텍스트 노드
        expect(screen.getByText('애플')).toBeInTheDocument();
    });

    it('가격을 $ 접두어와 함께 렌더한다', () => {
        render(<QuoteHeader data={BASE} />);
        // formatUsdPrice mock → '189.50'
        expect(screen.getByText('$189.50')).toBeInTheDocument();
    });

    it('등락률 + 부호를 렌더하고 sr-only 레이블이 정확히 1개다', () => {
        render(<QuoteHeader data={BASE} />);
        // 변동폭 span의 textContent에 '+1.23%'가 포함된다
        // (arrow aria-hidden + sr-only 레이블이 인접해 있으므로 함수 매처 사용)
        expect(
            screen.getByText(text => text.includes('+1.23%'))
        ).toBeInTheDocument();
        // sr-only는 arrowLabel 전용 — 정확히 1개
        const srOnlyEls = document.querySelectorAll('.sr-only');
        expect(srOnlyEls).toHaveLength(1);
        expect(srOnlyEls[0]).toHaveTextContent('상승');
    });

    it('화살표 아이콘에 aria-hidden이 설정된다', () => {
        render(<QuoteHeader data={BASE} />);
        // aria-hidden="true" 요소가 정확히 1개(화살표 span)
        const hiddenEls = document.querySelectorAll('[aria-hidden="true"]');
        expect(hiddenEls).toHaveLength(1);
        expect(hiddenEls[0]).toHaveTextContent('▲');
    });

    it('하락 시 음수 등락률과 sr-only "하락" 레이블을 렌더한다', () => {
        render(<QuoteHeader data={{ ...BASE, changePercent: -2.5 }} />);
        // 변동폭 span의 textContent에 '2.50%'가 포함된다
        // (sign='-' + value='-2.50' 두 텍스트 노드가 조합되므로 함수 매처 사용)
        expect(
            screen.getByText(text => text.includes('2.50%'))
        ).toBeInTheDocument();
        expect(document.querySelector('.sr-only')).toHaveTextContent('하락');
    });
});

describe('QuoteHeader — layout: signal', () => {
    it('티커와 변동폭이 같은 행에 렌더된다 (signal 레이아웃)', () => {
        const { container } = render(
            <QuoteHeader data={BASE} layout="signal" />
        );
        // signal 레이아웃: 첫 번째 자식이 flex justify-between 행(티커+변동폭)
        const firstRow = container.firstChild as HTMLElement;
        expect(firstRow.classList.contains('justify-between')).toBe(true);
        expect(firstRow.querySelector('[translate="no"]')).toHaveTextContent(
            'AAPL'
        );
    });

    it('한국어 이름이 독립 행으로 렌더된다', () => {
        render(<QuoteHeader data={BASE} layout="signal" />);
        expect(screen.getByText('애플')).toBeInTheDocument();
    });

    it('가격을 $ 접두어와 함께 렌더한다', () => {
        render(<QuoteHeader data={BASE} layout="signal" />);
        expect(screen.getByText('$189.50')).toBeInTheDocument();
    });
});
