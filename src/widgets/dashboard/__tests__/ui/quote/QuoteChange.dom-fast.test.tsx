import { render, screen } from '@testing-library/react';
import { QuoteChange } from '@/widgets/dashboard/ui/quote/QuoteChange';

describe('QuoteChange', () => {
    describe('index 레이아웃', () => {
        it('상승은 화살표·부호·상승 색으로 그린다', () => {
            const { container } = render(
                <QuoteChange changePercent={1.234} layout="index" />
            );
            expect(container.firstChild).toHaveTextContent('▲');
            expect(container.firstChild).toHaveTextContent('+1.23%');
            expect(container.firstChild).toHaveClass('text-ui-success-text');
        });

        it('하락은 하락 화살표와 음수 부호를 그린다', () => {
            const { container } = render(
                <QuoteChange changePercent={-2.5} layout="index" />
            );
            expect(container.firstChild).toHaveTextContent('▼');
            expect(container.firstChild).toHaveTextContent('-2.50%');
        });

        it('방향은 스크린리더용 단어로도 전한다', () => {
            render(<QuoteChange changePercent={1} layout="index" />);
            expect(screen.getByText('상승')).toHaveClass('sr-only');
        });
    });

    describe('signal 레이아웃', () => {
        it('전일비 라벨과 부호 붙은 수치를 그린다', () => {
            render(<QuoteChange changePercent={-2.1} layout="signal" />);
            expect(screen.getByText('전일비')).toBeInTheDocument();
            expect(screen.getByText('-2.10%')).toBeInTheDocument();
        });

        it('방향 색과 화살표를 쓰지 않는다 — 소절의 방향과 엇갈려 읽히기 때문이다', () => {
            const { container } = render(
                <QuoteChange changePercent={-2.1} layout="signal" />
            );
            expect(container).not.toHaveTextContent('▼');
            expect(container.firstChild).toHaveClass('text-secondary-300');
        });

        it('방향은 스크린리더용 단어로만 전한다', () => {
            render(<QuoteChange changePercent={-2.1} layout="signal" />);
            expect(screen.getByText('하락')).toHaveClass('sr-only');
        });
    });
});
