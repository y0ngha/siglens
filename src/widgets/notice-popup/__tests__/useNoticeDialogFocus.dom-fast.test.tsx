import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useNoticeDialogFocus } from '../hooks/useNoticeDialogFocus';

interface HarnessProps {
    noticeId: string | null;
    /** 열림과 무관하게 바뀌는 값 — 경로 변경 같은 리렌더를 흉내 낸다. */
    pathname: string;
    onClose: () => void;
}

function Harness({ noticeId, pathname, onClose }: HarnessProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useNoticeDialogFocus(dialogRef, noticeId, onClose);
    return (
        <div>
            <button type="button">페이지 버튼 {pathname}</button>
            {noticeId !== null && (
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-label="공지"
                    tabIndex={-1}
                >
                    <button type="button">닫기</button>
                </div>
            )}
        </div>
    );
}

describe('useNoticeDialogFocus', () => {
    it('공지가 열리면 다이얼로그에 포커스를 준다', () => {
        render(<Harness noticeId="n1" pathname="/" onClose={vi.fn()} />);
        expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('Escape를 누르면 onClose를 부른다', () => {
        const onClose = vi.fn();
        render(<Harness noticeId="n1" pathname="/" onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('닫혀 있으면 Escape에 반응하지 않는다', () => {
        const onClose = vi.fn();
        render(<Harness noticeId={null} pathname="/" onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('같은 공지가 떠 있는 채 리렌더되면(경로 변경) 포커스를 다시 빼앗지 않는다', () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <Harness noticeId="n1" pathname="/" onClose={onClose} />
        );
        const closeButton = screen.getByRole('button', { name: '닫기' });
        closeButton.focus();
        rerender(
            <Harness noticeId="n1" pathname="/market" onClose={onClose} />
        );
        expect(closeButton).toHaveFocus();
    });

    it('다음 공지로 넘어가면 다이얼로그에 다시 포커스를 준다', () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <Harness noticeId="n1" pathname="/" onClose={onClose} />
        );
        screen.getByRole('button', { name: '닫기' }).focus();
        rerender(<Harness noticeId="n2" pathname="/" onClose={onClose} />);
        expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('닫히면 열리기 전 포커스 위치로 되돌린다', () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <Harness noticeId={null} pathname="/" onClose={onClose} />
        );
        const pageButton = screen.getByRole('button', {
            name: '페이지 버튼 /',
        });
        pageButton.focus();
        rerender(<Harness noticeId="n1" pathname="/" onClose={onClose} />);
        expect(screen.getByRole('dialog')).toHaveFocus();
        rerender(<Harness noticeId={null} pathname="/" onClose={onClose} />);
        expect(pageButton).toHaveFocus();
    });
});
