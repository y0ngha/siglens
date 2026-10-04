import { render, screen } from '@testing-library/react';
import { SignalTypeGuide } from '@/widgets/dashboard/SignalTypeGuide';

describe('SignalTypeGuide', () => {
    it('renders the heading', () => {
        render(<SignalTypeGuide />);
        expect(
            screen.getByRole('heading', { name: '신호 유형 가이드' })
        ).toBeInTheDocument();
    });

    it('renders golden cross entry', () => {
        render(<SignalTypeGuide />);
        expect(screen.getByText('골든크로스')).toBeInTheDocument();
        expect(
            screen.getByText(/단기 이동평균선이 장기 이동평균선을 위로/)
        ).toBeInTheDocument();
    });

    it('renders death cross entry', () => {
        render(<SignalTypeGuide />);
        expect(screen.getByText('데드크로스')).toBeInTheDocument();
    });

    it('renders RSI entry', () => {
        render(<SignalTypeGuide />);
        expect(screen.getByText('RSI 과매도/과매수')).toBeInTheDocument();
    });

    it('uses a definition list structure', () => {
        const { container } = render(<SignalTypeGuide />);
        const dl = container.querySelector('dl');
        expect(dl).toBeInTheDocument();
        const dts = container.querySelectorAll('dt');
        expect(dts.length).toBe(8);
    });

    it('links heading via aria-labelledby', () => {
        render(<SignalTypeGuide />);
        const section = screen.getByRole('region', {
            name: '신호 유형 가이드',
        });
        expect(section).toBeInTheDocument();
    });
});
