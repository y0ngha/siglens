import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuoteHeader } from '@/widgets/dashboard/QuoteHeader';
import type { QuoteHeaderData } from '@/widgets/dashboard/QuoteHeader';
import { koMessage } from '@/shared/test-utils/koMessage';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/lib/priceFormat', () => ({
    formatPriceChange: (percent: number) => ({
        sign: percent >= 0 ? '+' : '-',
        colorClass: percent >= 0 ? 'text-green' : 'text-red',
        arrow: percent >= 0 ? '▲' : '▼',
        // 표시 문자열이 아니라 `shared.lib.priceMove` 키 — 컴포넌트가 `t()`로 푼다.
        arrowLabelKey: percent >= 0 ? 'up' : 'down',
    }),
    formatUsdPrice: (price: number) => price.toFixed(2),
}));

const BASE: QuoteHeaderData = {
    symbol: 'AAPL',
    displayName: '애플',
    price: 189.5,
    changePercent: 1.23,
};

describe('QuoteHeader — layout: index (기본값)', () => {
    it('티커를 translate="no"로 렌더한다', () => {
        render(<QuoteHeader tickerIsReadable currencySymbol="$" data={BASE} />);
        expect(screen.getByText('AAPL')).toHaveAttribute('translate', 'no');
    });

    it('한국어 이름을 렌더한다', () => {
        render(<QuoteHeader tickerIsReadable currencySymbol="$" data={BASE} />);
        // getByText: 정확히 '애플' 텍스트 노드
        expect(screen.getByText('애플')).toBeInTheDocument();
    });

    it('가격을 $ 접두어와 함께 렌더한다', () => {
        render(<QuoteHeader tickerIsReadable currencySymbol="$" data={BASE} />);
        // formatUsdPrice mock → '189.50'
        expect(screen.getByText('$189.50')).toBeInTheDocument();
    });

    it('등락률 + 부호를 렌더하고 sr-only 레이블이 정확히 1개다', () => {
        render(<QuoteHeader tickerIsReadable currencySymbol="$" data={BASE} />);
        // 변동폭 span의 textContent에 '+1.23%'가 포함된다
        // (arrow aria-hidden + sr-only 레이블이 인접해 있으므로 함수 매처 사용)
        expect(
            screen.getByText(text => text.includes('+1.23%'))
        ).toBeInTheDocument();
        // sr-only는 arrowLabel 전용 — 정확히 1개
        const srOnlyEls = document.querySelectorAll('.sr-only');
        expect(srOnlyEls).toHaveLength(1);
        expect(srOnlyEls[0]).toHaveTextContent(
            koMessage('shared.lib.priceMove.up')
        );
    });

    it('화살표 아이콘에 aria-hidden이 설정된다', () => {
        render(<QuoteHeader tickerIsReadable currencySymbol="$" data={BASE} />);
        // aria-hidden="true" 요소가 정확히 1개(화살표 span)
        const hiddenEls = document.querySelectorAll('[aria-hidden="true"]');
        expect(hiddenEls).toHaveLength(1);
        expect(hiddenEls[0]).toHaveTextContent('▲');
    });

    it('하락 시 음수 등락률과 sr-only "하락" 레이블을 렌더한다', () => {
        render(
            <QuoteHeader
                tickerIsReadable
                currencySymbol="$"
                data={{ ...BASE, changePercent: -2.5 }}
            />
        );
        // 변동폭 span의 textContent에 '2.50%'가 포함된다
        // (sign='-' + value='-2.50' 두 텍스트 노드가 조합되므로 함수 매처 사용)
        expect(
            screen.getByText(text => text.includes('2.50%'))
        ).toBeInTheDocument();
        expect(document.querySelector('.sr-only')).toHaveTextContent(
            koMessage('shared.lib.priceMove.down')
        );
    });
});

describe('QuoteHeader — layout: signal', () => {
    it('티커와 변동폭이 같은 행에 렌더된다 (signal 레이아웃)', () => {
        const { container } = render(
            <QuoteHeader
                tickerIsReadable
                currencySymbol="$"
                data={BASE}
                layout="signal"
            />
        );
        // signal 레이아웃: 첫 번째 자식이 flex justify-between 행(티커+변동폭)
        const firstRow = container.firstChild as HTMLElement;
        expect(firstRow.classList.contains('justify-between')).toBe(true);
        expect(firstRow.querySelector('[translate="no"]')).toHaveTextContent(
            'AAPL'
        );
    });

    it('한국어 이름이 독립 행으로 렌더된다', () => {
        render(
            <QuoteHeader
                tickerIsReadable
                currencySymbol="$"
                data={BASE}
                layout="signal"
            />
        );
        expect(screen.getByText('애플')).toBeInTheDocument();
    });

    it('가격을 $ 접두어와 함께 렌더한다', () => {
        render(
            <QuoteHeader
                tickerIsReadable
                currencySymbol="$"
                data={BASE}
                layout="signal"
            />
        );
        expect(screen.getByText('$189.50')).toBeInTheDocument();
    });
});

/**
 * KRX 티커는 `091160.KS`처럼 6자리 숫자라 읽어서 뜻이 통하지 않는다. 그런데 카드는
 * 티커를 주 제목으로, 한국어명을 작은 회색 글씨로 두는 배치였다 — 정작 알아볼 수
 * 있는 `반도체`가 밀려나고 숫자가 제목이 된다(2026-08-19 `/market/kr` 프로덕션 실측).
 * 같은 화면의 AI 브리핑은 이미 "반도체·은행"으로 이름을 쓰고 있었다.
 */
describe('QuoteHeader — 주 제목 자리 결정 (tickerIsReadable)', () => {
    const KR: QuoteHeaderData = {
        symbol: '091160.KS',
        displayName: '반도체',
        price: 125405,
        changePercent: -0.67,
    };

    it('한국어명이 주 제목, 티커가 보조로 뒤바뀐다', () => {
        const { container } = render(
            <QuoteHeader
                tickerIsReadable={false}
                currencySymbol="₩"
                data={KR}
            />
        );

        // index 레이아웃의 첫 자식이 주 제목 자리다.
        const primary = container.firstChild as HTMLElement;
        expect(primary).toHaveTextContent('반도체');
        expect(primary).not.toHaveTextContent('091160.KS');
    });

    it('티커를 DOM에서 지우지는 않는다 — 시각적 우선순위만 바꾼다', () => {
        render(
            <QuoteHeader
                tickerIsReadable={false}
                currencySymbol="₩"
                data={KR}
            />
        );

        expect(screen.getByText('091160.KS')).toBeInTheDocument();
    });

    it('translate="no"가 자리를 옮긴 티커를 따라간다', () => {
        render(
            <QuoteHeader
                tickerIsReadable={false}
                currencySymbol="₩"
                data={KR}
            />
        );

        expect(screen.getByText('091160.KS')).toHaveAttribute(
            'translate',
            'no'
        );
        // 한국어명은 번역 대상에서 제외하지 않는다.
        expect(screen.getByText('반도체')).not.toHaveAttribute('translate');
    });

    /**
     * jsdom은 레이아웃을 계산하지 않아 실제 넘침을 재현할 수 없다. 그래서
     * `min-w-0`+`truncate` 짝을 클래스로 고정한다 — flex item 기본값
     * `min-width: auto`가 nowrap 텍스트를 min-content(전체 폭)로 잡아,
     * `min-w-0`이 없으면 `shrink-0`인 등락률 배지 옆에서 말줄임이 아예
     * 발동하지 않고 긴 종목명이 행을 넘긴다.
     */
    it('주 제목이 min-w-0과 truncate를 함께 갖는다', () => {
        const { container } = render(
            <QuoteHeader
                tickerIsReadable={false}
                currencySymbol="₩"
                data={{ ...KR, displayName: 'LG에너지솔루션' }}
                layout="signal"
            />
        );

        const primary = screen.getByText('LG에너지솔루션');
        expect(primary).toHaveClass('min-w-0');
        expect(primary).toHaveClass('truncate');
        // 같은 행의 등락률 배지는 줄어들지 않아야 한다 — 그래서 주 제목이 줄어야 한다.
        const row = container.firstChild as HTMLElement;
        expect(row.querySelector('.shrink-0')).not.toBeNull();
    });

    it('signal 레이아웃에서도 한국어명이 변동폭과 같은 행에 온다', () => {
        const { container } = render(
            <QuoteHeader
                tickerIsReadable={false}
                currencySymbol="₩"
                data={KR}
                layout="signal"
            />
        );

        const firstRow = container.firstChild as HTMLElement;
        expect(firstRow.classList.contains('justify-between')).toBe(true);
        expect(firstRow).toHaveTextContent('반도체');
        expect(firstRow).not.toHaveTextContent('091160.KS');
    });

    it('미국 시장(true)은 예전 배치를 그대로 유지한다', () => {
        const { container } = render(
            <QuoteHeader tickerIsReadable currencySymbol="$" data={BASE} />
        );

        const primary = container.firstChild as HTMLElement;
        expect(primary).toHaveTextContent('AAPL');
        expect(primary).toHaveAttribute('translate', 'no');
    });
});
