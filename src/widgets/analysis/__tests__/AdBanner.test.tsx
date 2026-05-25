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
});
