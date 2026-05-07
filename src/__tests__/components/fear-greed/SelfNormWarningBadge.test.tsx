/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { SelfNormWarningBadge } from '@/components/fear-greed/SelfNormWarningBadge';

describe('SelfNormWarningBadge', () => {
    describe('rendering by warning value', () => {
        it('renders nothing when warning is null', () => {
            const { container } = render(
                <SelfNormWarningBadge warning={null} />
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders weakness text when CHRONIC_WEAKNESS', () => {
            const { getByText } = render(
                <SelfNormWarningBadge warning="CHRONIC_WEAKNESS" />
            );
            expect(getByText(/장기 약세 사이클/)).toBeInTheDocument();
        });

        it('renders strength text when CHRONIC_STRENGTH', () => {
            const { getByText } = render(
                <SelfNormWarningBadge warning="CHRONIC_STRENGTH" />
            );
            expect(getByText(/장기 강세 사이클/)).toBeInTheDocument();
        });
    });
});
