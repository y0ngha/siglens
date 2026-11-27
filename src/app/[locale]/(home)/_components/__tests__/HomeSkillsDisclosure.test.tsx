import { render, screen } from '@testing-library/react';
import { HomeSkillsDisclosure } from '@/app/[locale]/(home)/_components/HomeSkillsDisclosure';
import type { HomeSkillItem } from '@/widgets/home/utils/toSkillShowcaseItems';

vi.stubGlobal(
    'ResizeObserver',
    class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    }
);

const SKILLS: HomeSkillItem[] = [
    {
        name: 'bullish_engulfing',
        description: '상승 장악형',
        type: 'candlestick',
    },
    { name: 'rsi', description: 'RSI 해설', type: 'indicator_guide' },
];

describe('HomeSkillsDisclosure', () => {
    it('닫힌 details이고 요약 줄이 바로 보인다', () => {
        const { container } = render(
            <HomeSkillsDisclosure
                summaryLabel="분석 기법 2개 보기"
                skills={SKILLS}
            />
        );

        const details = container.querySelector('details');
        expect(details?.open).toBe(false);
        expect(details?.querySelector('summary')?.textContent).toBe(
            '분석 기법 2개 보기'
        );
    });

    it('닫혀 있어도 기법 카드와 제목이 문서에 있다(서버 HTML에 남는다)', () => {
        render(
            <HomeSkillsDisclosure
                summaryLabel="분석 기법 2개 보기"
                skills={SKILLS}
            />
        );

        expect(screen.getAllByText('상승 장악형').length).toBeGreaterThan(0);
        expect(screen.getAllByText('RSI 해설').length).toBeGreaterThan(0);
        expect(
            screen.getByRole('heading', { level: 2, hidden: true })
        ).toBeInTheDocument();
    });

    it('안쪽 쇼케이스는 page-container를 다시 두지 않는다(중복 거터 방지)', () => {
        const { container } = render(
            <HomeSkillsDisclosure
                summaryLabel="분석 기법 2개 보기"
                skills={SKILLS}
            />
        );

        expect(container.querySelector('.page-container')).toBeNull();
    });
});
