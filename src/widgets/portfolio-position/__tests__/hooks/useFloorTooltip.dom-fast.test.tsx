import { act, fireEvent, render, screen } from '@testing-library/react';
import { useFloorTooltip } from '@/widgets/portfolio-position/hooks/useFloorTooltip';

function Harness() {
    const { containerRef, activeFloor, handlersFor } = useFloorTooltip();
    return (
        <div>
            <div ref={containerRef} data-testid="container">
                <svg>
                    <g data-testid="floor-0" {...handlersFor(0)} />
                    <g data-testid="floor-1" {...handlersFor(1)} />
                </svg>
            </div>
            <button data-testid="outside" type="button" aria-label="outside" />
            <output data-testid="active">
                {activeFloor === null ? 'none' : String(activeFloor.index)}
            </output>
        </div>
    );
}

const active = () => screen.getByTestId('active').textContent;

/** 호환용 mouseenter가 뒤따르는 터치 탭 한 번 — pointerenter(touch) → mouseenter → click. */
function touchTap(el: Element): void {
    fireEvent.pointerEnter(el, { pointerType: 'touch' });
    fireEvent.mouseEnter(el);
    fireEvent.click(el);
}

function pointerEnterMouse(el: Element): void {
    fireEvent.pointerEnter(el, { pointerType: 'mouse' });
}

describe('useFloorTooltip', () => {
    describe('마우스 hover', () => {
        it('mouseenter로 열고 mouseleave로 닫는다', () => {
            render(<Harness />);
            const floor = screen.getByTestId('floor-1');

            pointerEnterMouse(floor);
            fireEvent.mouseEnter(floor);
            expect(active()).toBe('1');

            fireEvent.mouseLeave(floor);
            expect(active()).toBe('none');
        });

        it('다른 층의 mouseleave는 현재 hover를 닫지 않는다', () => {
            render(<Harness />);
            fireEvent.mouseEnter(screen.getByTestId('floor-1'));

            fireEvent.mouseLeave(screen.getByTestId('floor-0'));

            expect(active()).toBe('1');
        });
    });

    describe('클릭 고정', () => {
        it('클릭하면 고정되고 mouseleave 뒤에도 남는다', () => {
            render(<Harness />);
            const floor = screen.getByTestId('floor-0');

            fireEvent.click(floor);
            expect(active()).toBe('0');

            fireEvent.mouseLeave(floor);
            expect(active()).toBe('0');
        });

        it('같은 층을 다시 클릭하면 고정이 풀린다', () => {
            render(<Harness />);
            const floor = screen.getByTestId('floor-0');

            fireEvent.click(floor);
            fireEvent.click(floor);

            expect(active()).toBe('none');
        });

        it('hover 중인 층을 마우스로 클릭해도 방금 연 툴팁이 닫히지 않는다', () => {
            render(<Harness />);
            const floor = screen.getByTestId('floor-0');

            fireEvent.mouseEnter(floor);
            fireEvent.click(floor);
            fireEvent.mouseLeave(floor);

            expect(active()).toBe('0');
        });
    });

    describe('터치 탭', () => {
        it('탭하면 열리고, 같은 층을 다시 탭하면 호환 mouseenter가 끼어도 완전히 닫힌다', () => {
            render(<Harness />);
            const floor = screen.getByTestId('floor-0');

            touchTap(floor);
            expect(active()).toBe('0');

            touchTap(floor);
            expect(active()).toBe('none');
        });

        it('터치의 호환 mouseenter는 hover를 켜지 않는다', () => {
            render(<Harness />);
            const floor = screen.getByTestId('floor-0');
            fireEvent.pointerEnter(floor, { pointerType: 'touch' });
            fireEvent.mouseEnter(floor);

            expect(active()).toBe('none');
        });

        it('터치 뒤 마우스 pointerenter가 오면 hover가 다시 동작한다', () => {
            render(<Harness />);
            const floor = screen.getByTestId('floor-0');

            touchTap(floor);
            touchTap(floor);
            pointerEnterMouse(floor);
            fireEvent.mouseEnter(floor);

            expect(active()).toBe('0');
        });
    });

    describe('닫기', () => {
        it('Escape로 열린 툴팁을 닫는다', () => {
            render(<Harness />);
            fireEvent.click(screen.getByTestId('floor-0'));

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(active()).toBe('none');
        });

        it('Escape 이외의 키는 닫지 않는다', () => {
            render(<Harness />);
            fireEvent.click(screen.getByTestId('floor-0'));

            fireEvent.keyDown(document, { key: 'Enter' });

            expect(active()).toBe('0');
        });

        it('window scroll로 닫는다', () => {
            render(<Harness />);
            fireEvent.mouseEnter(screen.getByTestId('floor-0'));
            expect(active()).toBe('0');

            act(() => {
                window.dispatchEvent(new Event('scroll'));
            });

            expect(active()).toBe('none');
        });

        it('window resize로 고정한 툴팁을 닫는다', () => {
            render(<Harness />);
            fireEvent.click(screen.getByTestId('floor-0'));
            expect(active()).toBe('0');

            act(() => {
                window.dispatchEvent(new Event('resize'));
            });

            expect(active()).toBe('none');
        });

        it('컨테이너 밖 pointerdown으로 고정한 툴팁을 닫는다', () => {
            render(<Harness />);
            fireEvent.click(screen.getByTestId('floor-0'));

            fireEvent.pointerDown(screen.getByTestId('outside'));

            expect(active()).toBe('none');
        });

        it('컨테이너 안 pointerdown은 고정을 유지한다', () => {
            render(<Harness />);
            fireEvent.click(screen.getByTestId('floor-0'));

            fireEvent.pointerDown(screen.getByTestId('container'));

            expect(active()).toBe('0');
        });
    });
});
