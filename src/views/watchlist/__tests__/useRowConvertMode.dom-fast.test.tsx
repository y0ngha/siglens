import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRowConvertMode } from '../hooks/useRowConvertMode';

function noopObserve(): void {}

/** 실제 행처럼 버튼과 폼이 서로를 갈아 끼우는 최소 행. */
function Row() {
    const { isConverting, open, close, setRow, triggerRef } =
        useRowConvertMode(noopObserve);
    return (
        <ul>
            <li ref={setRow}>
                {isConverting ? (
                    <>
                        <input aria-label="수량" />
                        <button type="button" onClick={close}>
                            취소
                        </button>
                    </>
                ) : (
                    <button type="button" ref={triggerRef} onClick={open}>
                        보유로 전환
                    </button>
                )}
            </li>
        </ul>
    );
}

describe('useRowConvertMode', () => {
    it('처음 그릴 때는 포커스를 옮기지 않는다', () => {
        render(<Row />);
        expect(document.body).toHaveFocus();
    });

    it('열면 폼의 첫 입력칸으로 포커스가 들어간다', async () => {
        const user = userEvent.setup();
        render(<Row />);
        await user.click(screen.getByRole('button', { name: '보유로 전환' }));
        expect(screen.getByLabelText('수량')).toHaveFocus();
    });

    it('닫으면 여는 버튼으로 포커스가 돌아온다', async () => {
        const user = userEvent.setup();
        render(<Row />);
        await user.click(screen.getByRole('button', { name: '보유로 전환' }));
        await user.click(screen.getByRole('button', { name: '취소' }));
        expect(
            screen.getByRole('button', { name: '보유로 전환' })
        ).toHaveFocus();
    });

    it('행 노드를 뷰포트 감지 콜백에도 넘긴다', () => {
        const observeRow = vi.fn();
        function Probe() {
            const { setRow } = useRowConvertMode(observeRow);
            return (
                <ul>
                    <li ref={setRow}>행</li>
                </ul>
            );
        }
        render(<Probe />);
        expect(observeRow).toHaveBeenCalledWith(screen.getByRole('listitem'));
    });
});
