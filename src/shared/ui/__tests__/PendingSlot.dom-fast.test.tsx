import { render, screen } from '@testing-library/react';
import { PendingSlot } from '../PendingSlot';

describe('PendingSlot', () => {
    it('pending이면 fallback을 보여주고 children은 숨긴다', () => {
        render(
            <PendingSlot isPending fallback={<p>skeleton</p>}>
                <p>current page</p>
            </PendingSlot>
        );

        expect(screen.getByText('skeleton')).toBeInTheDocument();
        expect(screen.getByText('current page').parentElement?.className).toBe(
            'hidden'
        );
    });

    it('pending이 아니면 fallback 없이 children을 contents로 보여준다', () => {
        render(
            <PendingSlot isPending={false} fallback={<p>skeleton</p>}>
                <p>current page</p>
            </PendingSlot>
        );

        expect(screen.queryByText('skeleton')).toBeNull();
        expect(screen.getByText('current page').parentElement?.className).toBe(
            'contents'
        );
    });
});
