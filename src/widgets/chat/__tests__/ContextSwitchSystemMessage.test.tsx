import { render, screen } from '@testing-library/react';

import { ContextSwitchSystemMessage } from '../ContextSwitchSystemMessage';

describe('ContextSwitchSystemMessage', () => {
    it('renders the context switch message with the given label', () => {
        render(<ContextSwitchSystemMessage label="뉴스 분석" />);

        expect(
            screen.getByText(/뉴스 분석 페이지로 전환되었습니다/)
        ).toBeInTheDocument();
    });

    it('has role="status" for live-region announcements', () => {
        render(<ContextSwitchSystemMessage label="차트" />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('mentions that previous context no longer applies', () => {
        render(<ContextSwitchSystemMessage label="펀더멘털" />);

        expect(
            screen.getByText(
                /이전 페이지의 분석 컨텍스트는 더 이상 적용되지 않습니다/
            )
        ).toBeInTheDocument();
    });
});
