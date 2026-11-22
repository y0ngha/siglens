import { render, screen } from '@testing-library/react';
import { SignalHubLinks } from '@/widgets/signal-hubs/SignalHubLinks';

const LINKS = [
    { href: '/market/signals/golden-cross', label: '골든크로스 종목' },
    { href: '/market/signals/rsi-oversold', label: 'RSI 과매도 종목' },
] as const;

describe('SignalHubLinks', () => {
    it('기본 제목은 h2이고 링크마다 href가 있다', () => {
        render(
            <SignalHubLinks heading="신호별" headingId="hubs" links={LINKS} />
        );

        expect(
            screen.getByRole('heading', { level: 2, name: '신호별' })
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole('link').map(link => link.getAttribute('href'))
        ).toEqual(LINKS.map(link => link.href));
    });

    it('headingLevel="h3"이면 제목이 h3이고 h2는 없다', () => {
        render(
            <SignalHubLinks
                heading="신호별"
                headingId="hubs"
                links={LINKS}
                headingLevel="h3"
            />
        );

        expect(
            screen.getByRole('heading', { level: 3, name: '신호별' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    });

    it('nav는 제목으로 이름 붙고 className을 받는다', () => {
        render(
            <SignalHubLinks
                heading="신호별"
                headingId="hubs"
                links={LINKS}
                className="mt-6"
            />
        );

        expect(screen.getByRole('navigation', { name: '신호별' })).toHaveClass(
            'mt-6'
        );
    });
});
