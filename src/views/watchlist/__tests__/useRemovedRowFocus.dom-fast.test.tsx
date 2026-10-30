import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useRemovedRowFocus } from '../hooks/useRemovedRowFocus';

interface HarnessProps {
    initial: readonly string[];
    /** 행 삭제가 성공하는지. 성공하면 그 행이 목록에서 빠진다. */
    removeSucceeds: boolean;
}

/** 실제 목록처럼 행마다 링크와 삭제 버튼이 있고, 비면 안내 문장을 그리는 최소 목록. */
function Harness({ initial, removeSucceeds }: HarnessProps) {
    const [symbols, setSymbols] = useState(initial);
    const removeRow = async (symbol: string): Promise<boolean> => {
        if (removeSucceeds) {
            setSymbols(prev => prev.filter(item => item !== symbol));
        }
        return removeSucceeds;
    };
    const { remove, listRef, emptyStateRef } = useRemovedRowFocus(
        symbols,
        removeRow
    );
    const removeFirstElsewhere = (): void => setSymbols(prev => prev.slice(1));
    if (symbols.length === 0) {
        return (
            <p ref={emptyStateRef} tabIndex={-1}>
                비었음
            </p>
        );
    }
    return (
        <>
            <ul ref={listRef}>
                {symbols.map(symbol => (
                    <li key={symbol}>
                        <a href={`/${symbol}`}>{symbol}</a>
                        <button
                            type="button"
                            onClick={() => void remove(symbol)}
                        >
                            {symbol} 삭제
                        </button>
                    </li>
                ))}
            </ul>
            <button type="button" onClick={removeFirstElsewhere}>
                다른 곳에서 첫 행 삭제
            </button>
        </>
    );
}

describe('useRemovedRowFocus', () => {
    describe('훅의 remove로 지운 행이 사라지면', () => {
        it('다음 행의 링크로 포커스를 옮긴다', async () => {
            const user = userEvent.setup();
            render(<Harness initial={['AAA', 'BBB', 'CCC']} removeSucceeds />);
            await user.click(screen.getByRole('button', { name: 'BBB 삭제' }));
            expect(screen.getByRole('link', { name: 'CCC' })).toHaveFocus();
        });

        it('마지막 행이었으면 이전 행의 링크로 포커스를 옮긴다', async () => {
            const user = userEvent.setup();
            render(<Harness initial={['AAA', 'BBB', 'CCC']} removeSucceeds />);
            await user.click(screen.getByRole('button', { name: 'CCC 삭제' }));
            expect(screen.getByRole('link', { name: 'BBB' })).toHaveFocus();
        });

        it('목록이 비면 빈 상태 안내로 포커스를 옮긴다', async () => {
            const user = userEvent.setup();
            render(<Harness initial={['AAA']} removeSucceeds />);
            await user.click(screen.getByRole('button', { name: 'AAA 삭제' }));
            expect(screen.getByText('비었음')).toHaveFocus();
        });
    });

    it('삭제가 실패하면 행이 남고 포커스도 누른 버튼에 그대로다', async () => {
        const user = userEvent.setup();
        render(<Harness initial={['AAA', 'BBB']} removeSucceeds={false} />);
        const button = screen.getByRole('button', { name: 'AAA 삭제' });
        await user.click(button);
        expect(screen.getByRole('link', { name: 'AAA' })).toBeInTheDocument();
        expect(button).toHaveFocus();
    });

    it('삭제가 실패한 행이 나중에 다른 경로로 사라져도 포커스를 가져가지 않는다', async () => {
        const user = userEvent.setup();
        render(<Harness initial={['AAA', 'BBB']} removeSucceeds={false} />);
        await user.click(screen.getByRole('button', { name: 'AAA 삭제' }));
        const elsewhere = screen.getByRole('button', {
            name: '다른 곳에서 첫 행 삭제',
        });
        await user.click(elsewhere);
        expect(elsewhere).toHaveFocus();
    });

    it('훅을 거치지 않은 삭제에는 포커스를 건드리지 않는다', async () => {
        const user = userEvent.setup();
        render(<Harness initial={['AAA', 'BBB']} removeSucceeds />);
        const elsewhere = screen.getByRole('button', {
            name: '다른 곳에서 첫 행 삭제',
        });
        await user.click(elsewhere);
        expect(screen.queryByRole('link', { name: 'AAA' })).toBeNull();
        expect(elsewhere).toHaveFocus();
    });
});
