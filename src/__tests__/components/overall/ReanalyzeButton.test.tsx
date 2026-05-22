/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReanalyzeButton } from '@/components/overall/ReanalyzeButton';

describe('ReanalyzeButton', () => {
    it('재분석 label을 가진 button을 렌더한다', () => {
        render(<ReanalyzeButton onClick={() => {}} highlighted={false} />);
        expect(
            screen.getByRole('button', { name: /재분석/ })
        ).toBeInTheDocument();
    });

    it('클릭 시 onClick을 호출한다', () => {
        const handler = jest.fn();
        render(<ReanalyzeButton onClick={handler} highlighted={false} />);
        fireEvent.click(screen.getByRole('button'));
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('highlighted=true일 때 ui-warning 스타일을 적용한다', () => {
        render(<ReanalyzeButton onClick={() => {}} highlighted={true} />);
        const btn = screen.getByRole('button');
        expect(btn.className).toMatch(/ring-ui-warning|bg-ui-warning/);
    });

    it('rate / 한도 같은 cost 카피를 노출하지 않는다 (사양상 무료/무제한 가정)', () => {
        render(<ReanalyzeButton onClick={() => {}} highlighted={false} />);
        expect(screen.queryByText(/한도|차감|rate/i)).not.toBeInTheDocument();
    });
});
