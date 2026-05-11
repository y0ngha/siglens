/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';

describe('BotBlockedNotice', () => {
    it('봇 차단 안내 첫 줄을 렌더링한다', () => {
        render(<BotBlockedNotice />);
        expect(
            screen.getByText(
                '자동화된 접근으로 판정되어 분석 결과를 표시하지 않습니다.'
            )
        ).toBeInTheDocument();
    });

    it('실제 사용자 대응 안내 두 번째 줄을 렌더링한다', () => {
        render(<BotBlockedNotice />);
        expect(
            screen.getByText(
                '실제 사용자라면 다른 브라우저로 접속하시거나 문의해 주세요.'
            )
        ).toBeInTheDocument();
    });

    it('외부에서 전달한 className을 병합한다', () => {
        const { container } = render(
            <BotBlockedNotice className="custom-class" />
        );
        const root = container.firstChild as HTMLElement;
        expect(root).toHaveClass('custom-class');
        expect(root).toHaveClass('rounded-md');
    });
});
