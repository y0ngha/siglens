import { fireEvent, render, screen } from '@testing-library/react';
import { AiAnalysisAwaitingSection } from '../AiAnalysisAwaitingSection';

describe('AiAnalysisAwaitingSection', () => {
    it('제목과 시작 버튼을 렌더하고 버튼이 onStart를 부른다', () => {
        const onStart = vi.fn();
        render(
            <AiAnalysisAwaitingSection
                heading="AI 펀더멘털 분석"
                idPrefix="fundamental"
                onStart={onStart}
            />
        );
        expect(
            screen.getByRole('region', { name: 'AI 펀더멘털 분석' })
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'AI 분석 시작' }));
        expect(onStart).toHaveBeenCalledTimes(1);
    });
});
