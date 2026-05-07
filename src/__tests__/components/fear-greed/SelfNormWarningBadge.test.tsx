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

        it('renders the full chronic-weakness sentence verbatim per spec §4.5', () => {
            const { getByText } = render(
                <SelfNormWarningBadge warning="CHRONIC_WEAKNESS" />
            );
            expect(
                getByText(
                    '이 종목은 장기 약세 사이클입니다. 점수는 자기 분포 대비 상대적 위치를 의미합니다.'
                )
            ).toBeInTheDocument();
        });

        it('renders the full chronic-strength sentence verbatim per spec §4.5', () => {
            const { getByText } = render(
                <SelfNormWarningBadge warning="CHRONIC_STRENGTH" />
            );
            expect(
                getByText(
                    '이 종목은 장기 강세 사이클입니다. 점수는 자기 분포 대비 상대적 위치를 의미합니다.'
                )
            ).toBeInTheDocument();
        });
    });
});
