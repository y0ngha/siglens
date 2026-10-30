import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useByokConfirmGate } from '@/features/siglens-api-key-management/hooks/useByokConfirmGate';

const SECTION_ID = 'byok-target';

interface HarnessProps {
    hasByokKey: boolean;
    onAction: (formData: FormData) => void;
}

function Harness({ hasByokKey, onAction }: HarnessProps) {
    const {
        formRef,
        submitRef,
        modalOpen,
        handleSubmit,
        closeModal,
        createAnyway,
        goToByok,
    } = useByokConfirmGate({ hasByokKey, byokSectionId: SECTION_ID });
    return (
        <>
            <section id={SECTION_ID} tabIndex={-1} aria-label="byok" />
            <form ref={formRef} action={onAction} onSubmit={handleSubmit}>
                <input name="name" defaultValue="내 키" aria-label="이름" />
                <button ref={submitRef} type="submit">
                    만들기
                </button>
            </form>
            {modalOpen && (
                <div role="dialog" aria-label="확인">
                    <button type="button" onClick={createAnyway}>
                        그대로 만들기
                    </button>
                    <button type="button" onClick={goToByok}>
                        키 등록하러 가기
                    </button>
                    <button type="button" onClick={closeModal}>
                        닫기
                    </button>
                </div>
            )}
        </>
    );
}

function setup(hasByokKey: boolean) {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness hasByokKey={hasByokKey} onAction={onAction} />);
    return { user, onAction };
}

describe('useByokConfirmGate', () => {
    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    it('BYOK 키가 있으면 모달 없이 제출한다', async () => {
        const { user, onAction } = setup(true);
        await user.click(screen.getByRole('button', { name: '만들기' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    });

    it('BYOK 키가 없으면 제출을 멈추고 모달을 연다', async () => {
        const { user, onAction } = setup(false);
        await user.click(screen.getByRole('button', { name: '만들기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(onAction).not.toHaveBeenCalled();
    });

    it('"그대로 만들기"는 모달을 닫고 입력한 값으로 한 번 제출한다', async () => {
        const { user, onAction } = setup(false);
        await user.click(screen.getByRole('button', { name: '만들기' }));
        await user.click(screen.getByRole('button', { name: '그대로 만들기' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
        const [data] = onAction.mock.calls[0];
        expect(data.get('name')).toBe('내 키');
    });

    it('"키 등록하러 가기"는 제출 없이 BYOK 섹션으로 포커스를 보낸다', async () => {
        const { user, onAction } = setup(false);
        await user.click(screen.getByRole('button', { name: '만들기' }));
        await user.click(
            screen.getByRole('button', { name: '키 등록하러 가기' })
        );
        expect(document.getElementById(SECTION_ID)).toHaveFocus();
        expect(onAction).not.toHaveBeenCalled();
    });

    it('닫기는 제출 없이 모달만 닫는다', async () => {
        const { user, onAction } = setup(false);
        await user.click(screen.getByRole('button', { name: '만들기' }));
        await user.click(screen.getByRole('button', { name: '닫기' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onAction).not.toHaveBeenCalled();
    });

    it('확인을 통과한 뒤 다음 제출은 다시 모달을 연다', async () => {
        const { user } = setup(false);
        await user.click(screen.getByRole('button', { name: '만들기' }));
        await user.click(screen.getByRole('button', { name: '그대로 만들기' }));
        await user.click(screen.getByRole('button', { name: '만들기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
