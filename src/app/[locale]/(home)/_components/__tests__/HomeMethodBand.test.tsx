import { render, screen, within } from '@testing-library/react';
import { HomeMethodBand } from '@/app/[locale]/(home)/_components/HomeMethodBand';
import { GUIDE_CATEGORIES } from '@/entities/guide/types';
import { GUIDE_PATH, guideCategoryPath } from '@/shared/lib/guidePaths';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import { resolveMeterDailySymbols } from '@/widgets/analysis/utils/meterDailySymbols';

const COUNTS = {
    indicators: 13,
    candlesticks: 30,
    patterns: 5,
    strategies: 4,
    supportResistance: 3,
    fundamental: 2,
    news: 1,
};
const LABELS = {
    howto: '실전 가이드',
    candlesticks: '캔들 패턴',
    'chart-patterns': '차트 패턴',
    indicators: '보조지표',
    strategies: '매매 전략',
} as const;

function renderBand(guestDailySymbols = resolveMeterDailySymbols()) {
    return render(
        <HomeMethodBand
            counts={COUNTS}
            guestDailySymbols={guestDailySymbols}
            categoryLabels={LABELS}
        />
    );
}

describe('HomeMethodBand', () => {
    it('h2 하나가 섹션 이름이고 항목 제목은 h3다', () => {
        renderBand();

        expect(
            screen.getByRole('region', { name: '가격대는 이렇게 정해요' })
        ).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
        expect(
            screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
        ).toEqual(['지지선과 저항선', '무효화 기준', '지난 기록']);
    });

    it('세 항목이 방법론, 차트 가이드, 백테스팅으로 간다', () => {
        renderBand();

        expect(
            screen.getByRole('link', { name: '분석 방법 보기' })
        ).toHaveAttribute('href', '/methodology');
        expect(
            screen.getByRole('link', { name: '차트 가이드 보기' })
        ).toHaveAttribute('href', GUIDE_PATH);
        expect(
            screen.getByRole('link', { name: '백테스팅 결과 보기' })
        ).toHaveAttribute('href', '/backtesting');
    });

    it('가이드 분류 칩이 GUIDE_CATEGORIES 순서로 5개 있다', () => {
        renderBand();

        const nav = screen.getByRole('navigation', {
            name: '차트 가이드 분류',
        });
        const chips = within(nav).getAllByRole('link');
        expect(chips.map(chip => chip.getAttribute('href'))).toEqual(
            GUIDE_CATEGORIES.map(guideCategoryPath)
        );
        expect(chips.map(chip => chip.textContent)).toEqual(
            GUIDE_CATEGORIES.map(category => LABELS[category])
        );
    });

    it('비회원 하루 한도는 받은 값(core 정책)을 그대로 말한다', () => {
        renderBand(7);

        expect(
            screen.getByText(/비회원도 하루 7종목까지 볼 수 있어요/)
        ).toBeInTheDocument();
    });

    it('기본값은 core 정책 값이다', () => {
        renderBand();

        expect(
            screen.getByText(
                new RegExp(`하루 ${resolveMeterDailySymbols()}종목까지`)
            )
        ).toBeInTheDocument();
    });

    it('받은 skillCounts로 통계 줄을 그린다', () => {
        renderBand();

        expect(screen.getByRole('list', { name: /분석/ })).toHaveTextContent(
            '13종 보조지표'
        );
    });

    it('en: 같은 구조에 번역 문구가 나오고 한글이 섞이지 않는다', () => {
        const { container } = render(
            withLocale(
                <HomeMethodBand
                    counts={COUNTS}
                    guestDailySymbols={1}
                    categoryLabels={{
                        howto: 'Practical guides',
                        candlesticks: 'Candlestick patterns',
                        'chart-patterns': 'Chart patterns',
                        indicators: 'Indicators',
                        strategies: 'Strategies',
                    }}
                />,
                'en'
            )
        );

        expect(container.textContent).toContain('How we set the price levels');
        expect(container.textContent).toContain('up to 1 symbol a day');
        expect(container.textContent).not.toMatch(/[가-힣]/);
    });
});
