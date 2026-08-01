import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PopoverSurface } from '../PopoverSurface';

describe('PopoverSurface', () => {
    it('데스크탑에서는 제자리에 앵커드 팝오버로 렌더한다', () => {
        render(
            <div data-testid="anchor">
                <PopoverSurface isMobile={false}>
                    <p>내용</p>
                </PopoverSurface>
            </div>
        );

        expect(screen.getByTestId('anchor')).toContainElement(
            screen.getByText('내용')
        );
        expect(
            document.querySelector('[data-testid="popover-backdrop"]')
        ).toBeNull();
    });

    it('모바일에서는 body로 포털하고 배경을 깐다 — 헤더의 z-40 스택 컨텍스트를 탈출해야 시트 위에 뜬다', () => {
        render(
            <div data-testid="anchor">
                <PopoverSurface isMobile={true}>
                    <p>내용</p>
                </PopoverSurface>
            </div>
        );

        expect(screen.getByTestId('anchor')).not.toContainElement(
            screen.getByText('내용')
        );
        const backdrop = document.querySelector(
            '[data-testid="popover-backdrop"]'
        );
        expect(backdrop).not.toBeNull();
    });

    it('모바일 backdrop에 role="presentation"을 부여한다 — IndicatorSettingsModal 패턴과 동일', () => {
        render(
            <div data-testid="anchor">
                <PopoverSurface isMobile={true}>
                    <p>내용</p>
                </PopoverSurface>
            </div>
        );

        const backdrop = document.querySelector(
            '[data-testid="popover-backdrop"]'
        );
        expect(backdrop).toHaveAttribute('role', 'presentation');
    });

    it('isMobile 프롭이 첫 렌더부터 고정돼 있으면 Fragment↔Portal 사이의 remount가 일어나지 않는다 — 모바일로 마운트된 채 리렌더해도 동일 DOM 노드를 유지한다', () => {
        function Wrapper({ isMobile }: { isMobile: boolean }) {
            return (
                <PopoverSurface isMobile={isMobile}>
                    <p data-testid="content">내용</p>
                </PopoverSurface>
            );
        }

        const { rerender } = render(<Wrapper isMobile={true} />);
        const firstNode = screen.getByTestId('content');

        // isMobile이 매 렌더에서 이미 안정적인 값으로 전달되므로(내부 effect
        // 동기화 상태가 아니라), 부모가 리렌더해도 같은 값이 유지되고 DOM
        // 노드 identity가 보존된다 — remount가 없다는 방증.
        rerender(<Wrapper isMobile={true} />);
        const secondNode = screen.getByTestId('content');

        expect(secondNode).toBe(firstNode);
    });
});
