vi.mock('@/features/contact-form', () => ({
    ContactForm: () => <div data-testid="contact-form" />,
}));
vi.mock('@/shared/hooks/useDialog', () => ({
    useDialog: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        dialogRef: { current: null },
        triggerRef: { current: null },
    })),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { ContactDialog } from '../ContactDialog';
import { useDialog } from '@/shared/hooks/useDialog';

/**
 * useDialog를 mock한 테스트용 dialogRef.
 *
 * 네이티브 `<dialog>`는 열려 있지 않으면 children이 숨겨져(UA 스타일 display:none)
 * getByRole/getByText로 조회되지 않는다. 실제 훅은 effect에서 showModal()을 부르지만
 * mock에는 그 로직이 없으므로, React가 엘리먼트를 ref에 붙이는 순간 열어 준다.
 */
function openedDialogRef(): { current: HTMLDialogElement | null } {
    let node: HTMLDialogElement | null = null;
    return {
        get current() {
            return node;
        },
        set current(next: HTMLDialogElement | null) {
            node = next;
            if (next !== null && !next.open) next.showModal();
        },
    };
}

describe('ContactDialog', () => {
    it('renders the trigger button with default label', () => {
        render(<ContactDialog />);

        expect(
            screen.getByRole('button', { name: /문의하기/ })
        ).toBeInTheDocument();
    });

    it('renders the trigger button with custom label', () => {
        render(<ContactDialog triggerLabel="커스텀 라벨" />);

        expect(
            screen.getByRole('button', { name: /커스텀 라벨/ })
        ).toBeInTheDocument();
    });

    it('does not render the dialog when closed', () => {
        render(<ContactDialog />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the dialog with ContactForm when open', () => {
        vi.mocked(useDialog).mockReturnValue({
            isOpen: true,
            open: vi.fn(),
            close: vi.fn(),
            dialogRef: openedDialogRef(),
            triggerRef: { current: null },
        });

        render(<ContactDialog />);

        // useDialog를 mock했으므로 showModal()이 호출되지 않는다 → <dialog>에 open이
        // 붙지 않아 role="dialog"로는 조회되지 않는다. 여기서 검증할 것은 "열림 상태에서
        // 내용이 렌더되는가"이고, 네이티브 open 동작은 useDialog 테스트가 담당한다.
        expect(screen.getByTestId('contact-form')).toBeInTheDocument();
    });

    it('calls open when the trigger button is clicked', () => {
        const openFn = vi.fn();
        vi.mocked(useDialog).mockReturnValue({
            isOpen: false,
            open: openFn,
            close: vi.fn(),
            dialogRef: { current: null },
            triggerRef: { current: null },
        });

        render(<ContactDialog />);
        fireEvent.click(screen.getByRole('button', { name: /문의하기/ }));

        expect(openFn).toHaveBeenCalledTimes(1);
    });

    /**
     * **저장된 테마를 `<html>`에 찍는다.**
     *
     * 왜 이 컴포넌트가 그 일을 하는지는 구현부 주석에 있다(요약: 동적 세그먼트
     * `notFound()`가 만드는 에러 셸에는 `<head>` 스크립트가 없고, 전용 컴포넌트를
     * 새로 두면 홈 first-load가 17.3KB 늘어난다).
     *
     * 컴포넌트가 트리에 있는지가 아니라 **속성이 찍혔는지**를 단언한다 —
     * 존재만 보면 그 효과가 사라져도 통과한다. 감사가 앞서 같은 성격의
     * 결함을 세 번 잡았다.
     */
    it('저장된 테마를 <html>에 적용한다', () => {
        localStorage.setItem('siglens-theme', 'light');
        document.documentElement.removeAttribute('data-theme');

        render(<ContactDialog />);

        expect(document.documentElement.getAttribute('data-theme')).toBe(
            'light'
        );
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });
});
