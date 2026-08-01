import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PopoverSurface } from '../PopoverSurface';

function mockViewport(isMobile: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
            matches: isMobile,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PopoverSurface', () => {
    it('데스크탑에서는 제자리에 앵커드 팝오버로 렌더한다', () => {
        mockViewport(false);

        render(
            <div data-testid="anchor">
                <PopoverSurface>
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
        mockViewport(true);

        render(
            <div data-testid="anchor">
                <PopoverSurface>
                    <p>내용</p>
                </PopoverSurface>
            </div>
        );

        expect(screen.getByTestId('anchor')).not.toContainElement(
            screen.getByText('내용')
        );
        expect(
            document.querySelector('[data-testid="popover-backdrop"]')
        ).not.toBeNull();
    });
});
