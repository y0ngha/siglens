vi.mock('@/shared/lib/adsense', () => ({
    ADSENSE_ENABLED: true,
    ADSENSE_PUBLISHER_ID: 'ca-pub-1234567890',
    ADSENSE_SLOTS: {
        PROGRESS: 'slot-progress',
        PANEL_BOTTOM: 'slot-panel-bottom',
    },
}));
vi.mock('../hooks/useAdSensePush', () => ({
    useAdSensePush: vi.fn(),
}));

import { render, screen } from '@testing-library/react';

import { AdBanner } from '../AdBanner';

describe('AdBanner', () => {
    it('renders nothing when isFreeUser is false', () => {
        const { container } = render(
            <AdBanner isFreeUser={false} slot="analysis-progress" />
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders the ad container and support message for free users', () => {
        render(<AdBanner isFreeUser={true} slot="analysis-progress" />);

        expect(screen.getByText(/AI가 정밀 분석 중입니다/)).toBeInTheDocument();
    });

    it('renders the panel-bottom slot support message', () => {
        render(<AdBanner isFreeUser={true} slot="analysis-panel-bottom" />);

        expect(
            screen.getByText(/분석 결과가 도움이 되셨나요/)
        ).toBeInTheDocument();
    });

    it('renders the ins element with ad attributes', () => {
        const { container } = render(
            <AdBanner isFreeUser={true} slot="analysis-progress" />
        );

        const ins = container.querySelector('ins.adsbygoogle');
        expect(ins).not.toBeNull();
        expect(ins).toHaveAttribute('data-ad-client', 'ca-pub-1234567890');
        expect(ins).toHaveAttribute('data-ad-slot', 'slot-progress');
    });

    /**
     * 자동 크기 광고는 채워질 때 높이가 정해져 아래 콘텐츠를 민다. 높이를 미리
     * 잡지 않으면 광고 도착이 그대로 CLS가 된다.
     */
    it('reserves a min-height on the ad slot to avoid layout shift', () => {
        const { container } = render(
            <AdBanner isFreeUser={true} slot="analysis-progress" />
        );

        expect(container.querySelector('ins.adsbygoogle')?.className).toContain(
            'min-h-62.5'
        );
    });
});
