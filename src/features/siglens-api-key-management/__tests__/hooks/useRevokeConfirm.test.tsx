import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRevokeConfirm } from '@/features/siglens-api-key-management/hooks/useRevokeConfirm';

function Harness() {
    const {
        confirming,
        startConfirm,
        cancelConfirm,
        revokeButtonRef,
        confirmButtonRef,
    } = useRevokeConfirm();
    if (!confirming)
        return (
            <button ref={revokeButtonRef} type="button" onClick={startConfirm}>
                폐기
            </button>
        );
    return (
        <>
            <button ref={confirmButtonRef} type="button">
                폐기하기
            </button>
            <button type="button" onClick={cancelConfirm}>
                취소
            </button>
        </>
    );
}

describe('useRevokeConfirm', () => {
    it('처음에는 확인 단계가 닫혀 있고 포커스를 옮기지 않는다', () => {
        render(<Harness />);
        expect(screen.getByRole('button', { name: '폐기' })).not.toHaveFocus();
    });

    it('확인 단계를 열면 확인 버튼으로 포커스가 간다', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByRole('button', { name: '폐기' }));
        expect(screen.getByRole('button', { name: '폐기하기' })).toHaveFocus();
    });

    it('취소하면 폐기 버튼으로 포커스가 돌아온다', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByRole('button', { name: '폐기' }));
        await user.click(screen.getByRole('button', { name: '취소' }));
        expect(screen.getByRole('button', { name: '폐기' })).toHaveFocus();
    });
});
