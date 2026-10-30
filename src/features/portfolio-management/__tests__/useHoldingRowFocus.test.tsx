import { render, screen } from '@testing-library/react';
import { useHoldingRowFocus } from '@/features/portfolio-management/hooks/useHoldingRowFocus';

interface HarnessProps {
    isEditing: boolean;
    isConfirmingDelete: boolean;
}

/**
 * 실제 행처럼 모드마다 다른 버튼을 그려, 교체될 때 포커스가 어디로 가는지 본다. 행과 같이 모드별
 * 묶음에 key를 줘서 React가 이전 모드의 버튼 노드를 재사용하지 않게 한다.
 */
function Harness({ isEditing, isConfirmingDelete }: HarnessProps) {
    const { editButtonRef, deleteButtonRef, confirmDeleteButtonRef } =
        useHoldingRowFocus({ isEditing, isConfirmingDelete });
    if (isEditing) return <input key="edit" aria-label="수량" />;
    if (isConfirmingDelete) {
        return (
            <div key="confirm">
                <button ref={confirmDeleteButtonRef} type="button">
                    삭제 확정
                </button>
            </div>
        );
    }
    return (
        <div key="actions">
            <button ref={editButtonRef} type="button">
                수정
            </button>
            <button ref={deleteButtonRef} type="button">
                삭제
            </button>
        </div>
    );
}

describe('useHoldingRowFocus', () => {
    it('moves no focus on mount', () => {
        render(<Harness isEditing={false} isConfirmingDelete />);

        expect(document.activeElement).toBe(document.body);
    });

    it('focuses the confirm button when entering delete confirm', () => {
        const { rerender } = render(
            <Harness isEditing={false} isConfirmingDelete={false} />
        );

        rerender(<Harness isEditing={false} isConfirmingDelete />);

        expect(screen.getByRole('button', { name: '삭제 확정' })).toHaveFocus();
    });

    it('returns focus to the delete button when leaving delete confirm with focus lost', () => {
        const { rerender } = render(
            <Harness isEditing={false} isConfirmingDelete={false} />
        );
        rerender(<Harness isEditing={false} isConfirmingDelete />);

        rerender(<Harness isEditing={false} isConfirmingDelete={false} />);

        expect(screen.getByRole('button', { name: '삭제' })).toHaveFocus();
    });

    it('returns focus to the edit button when leaving edit mode with focus lost', () => {
        const { rerender } = render(
            <Harness isEditing isConfirmingDelete={false} />
        );
        screen.getByLabelText('수량').focus();

        rerender(<Harness isEditing={false} isConfirmingDelete={false} />);

        expect(screen.getByRole('button', { name: '수정' })).toHaveFocus();
    });

    it('does not take focus from another control when leaving edit mode', () => {
        const outside = document.createElement('button');
        document.body.append(outside);
        const { rerender } = render(
            <Harness isEditing isConfirmingDelete={false} />
        );
        outside.focus();

        rerender(<Harness isEditing={false} isConfirmingDelete={false} />);

        expect(outside).toHaveFocus();
        outside.remove();
    });
});
