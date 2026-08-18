import { render, screen } from '@testing-library/react';
import { MarketBadge } from '../ui/TickerAutocomplete';

describe('MarketBadge', () => {
    it('renders a 코인 badge', () => {
        render(<MarketBadge label="코인" tone="crypto" />);
        expect(screen.getByText('코인')).toBeInTheDocument();
    });

    /**
     * 이 배지가 놓이는 행은 `items-baseline`이다 — 종목명과 티커의 글자 밑선을
     * 맞추기 위한 것이다. 정렬을 상속받으면 배지의 **글자** 밑선이 행 밑선에
     * 맞춰지고, 위아래 패딩만큼 상자가 아래로 내려가 미세하게 어긋난다.
     */
    it('opts out of the row baseline so the box centers vertically', () => {
        render(<MarketBadge label="KOSPI" tone="kr" />);
        // `leading-none`도 정렬 수정의 절반이다 — 줄 높이가 남아 있으면 상자가
        // 다시 내려간다. 둘을 함께 고정한다.
        expect(screen.getByTestId('market-badge')).toHaveClass(
            'self-center',
            'leading-none'
        );
    });

    it('tints all three asset classes differently', () => {
        const classNames = (['crypto', 'kr', 'us'] as const).map(tone => {
            const { unmount } = render(<MarketBadge label="X" tone={tone} />);
            const cls = screen.getByTestId('market-badge').className;
            unmount();
            return cls;
        });
        // 둘만 비교하면 KR이 US와 같아져도 통과한다 — 색으로 자산군을 가르는 게
        // 이 표의 존재 이유다.
        expect(new Set(classNames).size).toBe(3);
    });
});
