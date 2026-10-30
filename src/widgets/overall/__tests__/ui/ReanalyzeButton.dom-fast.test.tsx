import { render, screen, fireEvent } from '@testing-library/react';
import { ReanalyzeButton } from '@/widgets/overall/ui/reanalyze/ReanalyzeButton';

describe('ReanalyzeButton', () => {
    it('재분석 label을 가진 button을 렌더한다', () => {
        render(
            <ReanalyzeButton
                onClick={() => {}}
                highlighted={false}
                reanalyzing={false}
            />
        );
        expect(
            screen.getByRole('button', { name: '재분석' })
        ).toBeInTheDocument();
    });

    it('클릭 시 onClick을 호출한다', () => {
        const handler = vi.fn();
        render(
            <ReanalyzeButton
                onClick={handler}
                highlighted={false}
                reanalyzing={false}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('highlighted=true일 때 ui-warning 스타일을 적용한다', () => {
        render(
            <ReanalyzeButton
                onClick={() => {}}
                highlighted={true}
                reanalyzing={false}
            />
        );
        const btn = screen.getByRole('button');
        expect(btn.className).toMatch(/ring-ui-warning|bg-ui-warning/);
    });

    it('rate / 한도 같은 cost 카피를 노출하지 않는다 (사양상 무료/무제한 가정)', () => {
        render(
            <ReanalyzeButton
                onClick={() => {}}
                highlighted={false}
                reanalyzing={false}
            />
        );
        expect(screen.queryByText(/한도|차감|rate/i)).not.toBeInTheDocument();
    });

    describe('reanalyzing=true', () => {
        it('진행 중임을 라벨과 aria-busy로 알린다', () => {
            render(
                <ReanalyzeButton
                    onClick={() => {}}
                    highlighted={false}
                    reanalyzing={true}
                />
            );
            const btn = screen.getByRole('button', { name: '재분석 중…' });
            expect(btn).toHaveAttribute('aria-busy', 'true');
            expect(btn).toHaveAttribute('aria-disabled', 'true');
        });

        it('클릭해도 onClick을 호출하지 않는다', () => {
            const handler = vi.fn();
            render(
                <ReanalyzeButton
                    onClick={handler}
                    highlighted={false}
                    reanalyzing={true}
                />
            );
            fireEvent.click(screen.getByRole('button'));
            expect(handler).not.toHaveBeenCalled();
        });

        it('disabled 속성 대신 aria-disabled를 써서 포커스를 유지한다', () => {
            render(
                <ReanalyzeButton
                    onClick={() => {}}
                    highlighted={false}
                    reanalyzing={true}
                />
            );
            expect(screen.getByRole('button')).toBeEnabled();
        });
    });
});
