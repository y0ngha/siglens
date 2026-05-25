// @vitest-environment jsdom
import { captureTransformY } from '@/widgets/symbol-page/utils/mobileSheetDom';

// jsdom does not implement DOMMatrix — provide a minimal stub.
class DOMMatrixStub {
    m42: number;
    constructor(init?: string) {
        if (!init || init === 'none') {
            this.m42 = 0;
        } else {
            const match = init.match(
                /^matrix\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/
            );
            this.m42 = match ? Number(match[6]) : 0;
        }
    }
}

beforeAll(() => {
    (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrixStub;
});

afterAll(() => {
    delete (globalThis as Record<string, unknown>).DOMMatrix;
});

describe('captureTransformY', () => {
    it('returns 0 when transform is "none"', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            transform: 'none',
        } as unknown as CSSStyleDeclaration);

        expect(captureTransformY(el as HTMLDivElement)).toBe(0);

        spy.mockRestore();
        el.remove();
    });

    it('extracts translateY from a matrix transform', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            transform: 'matrix(1, 0, 0, 1, 0, 42)',
        } as unknown as CSSStyleDeclaration);

        expect(captureTransformY(el as HTMLDivElement)).toBe(42);

        spy.mockRestore();
        el.remove();
    });

    it('returns 0 for identity matrix', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            transform: 'matrix(1, 0, 0, 1, 0, 0)',
        } as unknown as CSSStyleDeclaration);

        expect(captureTransformY(el as HTMLDivElement)).toBe(0);

        spy.mockRestore();
        el.remove();
    });
});
