import { render } from '@testing-library/react';
import {
    SelfNormWarningBadge,
    WARNING_TEXT,
} from '@/widgets/fear-greed/SelfNormWarningBadge';

describe('SelfNormWarningBadge', () => {
    describe('rendering by warning value', () => {
        it('renders nothing when warning is null', () => {
            const { container } = render(
                <SelfNormWarningBadge warning={null} />
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders the full chronic-weakness sentence verbatim per spec §4.5', () => {
            const { getByText } = render(
                <SelfNormWarningBadge warning="CHRONIC_WEAKNESS" />
            );
            expect(
                getByText(WARNING_TEXT.CHRONIC_WEAKNESS)
            ).toBeInTheDocument();
        });

        it('renders the full chronic-strength sentence verbatim per spec §4.5', () => {
            const { getByText } = render(
                <SelfNormWarningBadge warning="CHRONIC_STRENGTH" />
            );
            expect(
                getByText(WARNING_TEXT.CHRONIC_STRENGTH)
            ).toBeInTheDocument();
        });
    });
});
