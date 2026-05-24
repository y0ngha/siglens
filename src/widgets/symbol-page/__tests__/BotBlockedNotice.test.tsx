/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';

describe('BotBlockedNotice', () => {
    it('봇 차단 안내를 렌더링한다', () => {
        render(<BotBlockedNotice />);
        expect(screen.getByText(/봇 트래픽으로 보여/)).toBeInTheDocument();
        expect(
            screen.getByText(/새로고침하거나 다른 브라우저로 접속/)
        ).toBeInTheDocument();
    });

    it('role="status"를 갖추어 스크린 리더에 알린다', () => {
        const { container } = render(<BotBlockedNotice />);
        expect(container.querySelector('[role="status"]')).toBeInTheDocument();
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
