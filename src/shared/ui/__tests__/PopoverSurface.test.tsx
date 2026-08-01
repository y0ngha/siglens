import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PopoverSurface } from '../PopoverSurface';

function renderSurface(isMobile: boolean) {
    const dialogRef = createRef<HTMLDivElement>();
    return {
        dialogRef,
        ...render(
            <div data-testid="anchor">
                <h2 id="popover-title">제목</h2>
                <PopoverSurface
                    isMobile={isMobile}
                    dialogRef={dialogRef}
                    titleId="popover-title"
                >
                    <p>내용</p>
                </PopoverSurface>
            </div>
        ),
    };
}

describe('PopoverSurface', () => {
    it('데스크탑에서는 제자리에 앵커드 팝오버로 렌더한다', () => {
        renderSurface(false);

        expect(screen.getByTestId('anchor')).toContainElement(
            screen.getByText('내용')
        );
        expect(
            document.querySelector('[data-testid="popover-backdrop"]')
        ).toBeNull();
    });

    it('모바일에서는 body로 포털하고 배경을 깐다 — 헤더의 z-40 스택 컨텍스트를 탈출해야 시트 위에 뜬다', () => {
        renderSurface(true);

        expect(screen.getByTestId('anchor')).not.toContainElement(
            screen.getByText('내용')
        );
        const backdrop = document.querySelector(
            '[data-testid="popover-backdrop"]'
        );
        expect(backdrop).not.toBeNull();
    });

    it('모바일 backdrop에 role="presentation"을 부여한다 — IndicatorSettingsModal 패턴과 동일', () => {
        renderSurface(true);

        const backdrop = document.querySelector(
            '[data-testid="popover-backdrop"]'
        );
        expect(backdrop).toHaveAttribute('role', 'presentation');
    });

    // B2(감사): 이전에는 isMobile={true}로 마운트한 뒤 다시 isMobile={true}로
    // 리렌더해 "노드가 같다"고 단언했다 — isMobile이 안 바뀌면 리렌더해도 같은
    // 자리에서 같은 컴포넌트가 다시 렌더될 뿐이라, PopoverSurface가
    // Fragment/Portal 사이를 전혀 오가지 않아도 항상 참이었다(동어반복).
    // 실제로 중요한 속성은 그 반대다: isMobile이 처음부터 안정적인 값으로
    // 고정되어 있어야 하고, 그 값이 바뀌면(호출자가 뷰포트를 잘못 다시
    // 읽는 등) PopoverSurface는 return 위치를 Fragment↔Portal로 바꾸며 그
    // 결과 패널 서브트리 identity가 실제로 바뀐다는 것을 보여준다 — 이것이
    // 바로 이 컴포넌트가 `isMobile`을 이미 settled된 부모로부터 프롭으로
    // 받아야 하는 이유(remount는 위험하다)를 문서화한다.
    it('isMobile 프롭이 false→true로 바뀌면 Fragment↔Portal 전환으로 패널 노드 identity가 바뀐다', () => {
        function Wrapper({ isMobile }: { isMobile: boolean }) {
            const dialogRef = createRef<HTMLDivElement>();
            return (
                <PopoverSurface
                    isMobile={isMobile}
                    dialogRef={dialogRef}
                    titleId="popover-title"
                >
                    <p data-testid="content">내용</p>
                </PopoverSurface>
            );
        }

        const { rerender } = render(<Wrapper isMobile={false} />);
        const firstNode = screen.getByTestId('content');

        rerender(<Wrapper isMobile={true} />);
        const secondNode = screen.getByTestId('content');

        expect(secondNode).not.toBe(firstNode);
    });

    it('isMobile 프롭이 첫 렌더부터 고정돼 있으면 Fragment↔Portal 사이의 remount가 일어나지 않는다 — 모바일로 마운트된 채 리렌더해도 동일 DOM 노드를 유지한다', () => {
        function Wrapper({ isMobile }: { isMobile: boolean }) {
            const dialogRef = createRef<HTMLDivElement>();
            return (
                <PopoverSurface
                    isMobile={isMobile}
                    dialogRef={dialogRef}
                    titleId="popover-title"
                >
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

describe('PopoverSurface — 패널 소유 (A3)', () => {
    it('패널 <div>에 role="dialog"·aria-labelledby·tabIndex을 직접 부여한다', () => {
        const { dialogRef } = renderSurface(false);

        expect(dialogRef.current).not.toBeNull();
        expect(dialogRef.current).toHaveAttribute('role', 'dialog');
        expect(dialogRef.current).toHaveAttribute(
            'aria-labelledby',
            'popover-title'
        );
        expect(dialogRef.current).toHaveAttribute('tabindex', '-1');
    });

    it('데스크탑에서는 앵커드 배치 클래스(absolute top-full right-0)를 쓴다', () => {
        const { dialogRef } = renderSurface(false);

        expect(dialogRef.current?.className).toContain('absolute');
        expect(dialogRef.current?.className).toContain('top-full');
        expect(dialogRef.current?.className).toContain('right-0');
    });

    it('모바일에서는 뷰포트 중앙 배치 클래스(w-full max-w-sm)를 쓴다', () => {
        const { dialogRef } = renderSurface(true);

        expect(dialogRef.current?.className).toContain('w-full');
        expect(dialogRef.current?.className).toContain('max-w-sm');
        expect(dialogRef.current?.className).not.toContain('absolute');
    });

    it('desktopClassName은 데스크탑에서만 적용되고 모바일에서는 무시된다', () => {
        const dialogRef = createRef<HTMLDivElement>();
        const { rerender } = render(
            <PopoverSurface
                isMobile={false}
                dialogRef={dialogRef}
                titleId="popover-title"
                desktopClassName="mt-2"
            >
                <p>내용</p>
            </PopoverSurface>
        );
        expect(dialogRef.current?.className).toContain('mt-2');

        rerender(
            <PopoverSurface
                isMobile={true}
                dialogRef={dialogRef}
                titleId="popover-title"
                desktopClassName="mt-2"
            >
                <p>내용</p>
            </PopoverSurface>
        );
        expect(dialogRef.current?.className).not.toContain('mt-2');
    });
});

describe('PopoverSurface — aria-modal (A2)', () => {
    it('모바일에서는 aria-modal="true"를 부여한다 — 백드롭 뒤에 포털된 실질적 모달이라 스크린리더가 밖으로 나가면 안 된다', () => {
        const { dialogRef } = renderSurface(true);

        expect(dialogRef.current).toHaveAttribute('aria-modal', 'true');
    });

    it('데스크탑에서는 aria-modal을 달지 않는다 — 백드롭 없는 앵커드 팝오버는 진짜 모달이 아니다', () => {
        const { dialogRef } = renderSurface(false);

        expect(dialogRef.current).not.toHaveAttribute('aria-modal');
    });
});

describe('PopoverSurface — SSR 가드 (A4)', () => {
    // RTL의 render()는 마운트에 document.body가 필요해 이 시나리오 자체를
    // 재현할 수 없다 — 실제 SSR(Node, no DOM)을 흉내내려면 document 없이도
    // 동작하는 renderToStaticMarkup으로 직접 렌더해야 한다.
    it('document가 undefined인 SSR 렌더에서도 throw하지 않고 패널을 그대로(포털 없이) 반환한다', () => {
        const originalDocument = globalThis.document;
        // @ts-expect-error — SSR 환경(document 없음)을 흉내낸다.
        delete globalThis.document;

        try {
            const dialogRef = createRef<HTMLDivElement>();
            let html = '';
            expect(() => {
                html = renderToStaticMarkup(
                    <PopoverSurface
                        isMobile={true}
                        dialogRef={dialogRef}
                        titleId="popover-title"
                    >
                        <p>내용</p>
                    </PopoverSurface>
                );
            }).not.toThrow();

            expect(html).toContain('role="dialog"');
            expect(html).not.toContain('popover-backdrop');
        } finally {
            globalThis.document = originalDocument;
        }
    });
});
