import { render, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { SampleFooterText } from '@/shared/ui/SampleFooterText';

describe('SampleFooterText', () => {
    it('normal이면 비교한 거래일 수를 말한다', () => {
        render(<SampleFooterText confidence="normal" sampleSize={412} />);

        expect(
            screen.getByText('지난 412거래일과 비교해 매긴 점수예요.')
        ).toBeInTheDocument();
    });

    it('limited이면 기록이 짧아 덜 정확할 수 있다고 말한다', () => {
        render(<SampleFooterText confidence="limited" sampleSize={45} />);

        expect(
            screen.getByText(
                '비교할 기록이 45거래일뿐이라 점수가 덜 정확할 수 있어요.'
            )
        ).toBeInTheDocument();
    });

    it('en 로케일에는 한글이 섞이지 않는다', () => {
        const { container } = renderWithIntl(
            <SampleFooterText confidence="limited" sampleSize={45} />,
            { locale: 'en' }
        );

        expect(container.textContent).not.toMatch(/[가-힣]/);
        expect(container.textContent).toContain('45');
    });

    it('래퍼 요소를 만들지 않고 문장만 낸다', () => {
        const { container } = render(
            <SampleFooterText confidence="normal" sampleSize={10} />
        );

        expect(container.children).toHaveLength(0);
    });
});
