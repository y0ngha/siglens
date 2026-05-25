/// <reference types="vitest/globals" />

/**
 * Augment jest-dom custom matchers for Vitest.
 *
 * Vitest 4 surfaces `expect(el)` as `jest.Matchers<void, T>` when compiled
 * with moduleResolution:"node". The @testing-library/jest-dom/vitest type
 * augmentation targets the vitest `Assertion` interface, which doesn't merge
 * under this resolution mode. We augment `jest.Matchers` directly so
 * `toBeInTheDocument()` and siblings are visible to `tsc --noEmit`.
 */

interface TestingLibraryMatchers<R = void> {
    toBeInTheDocument(): R;
    toBeVisible(): R;
    toBeEmpty(): R;
    toBeEmptyDOMElement(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeInvalid(): R;
    toBeRequired(): R;
    toBeValid(): R;
    toBeChecked(): R;
    toBePartiallyChecked(): R;
    toHaveAttribute(attr: string, value?: unknown): R;
    toHaveClass(...classNames: Array<string | RegExp>): R;
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
    toHaveFocus(): R;
    toHaveFormValues(expectedValues: Record<string, unknown>): R;
    toHaveStyle(css: string | Record<string, unknown>): R;
    toHaveTextContent(
        text: string | RegExp,
        options?: { normalizeWhitespace: boolean }
    ): R;
    toHaveValue(value?: string | string[] | number | null): R;
    toContainElement(element: HTMLElement | SVGElement | null): R;
    toContainHTML(htmlText: string): R;
    toHaveAccessibleDescription(text?: string | RegExp): R;
    toHaveAccessibleErrorMessage(text?: string | RegExp): R;
    toHaveAccessibleName(text?: string | RegExp): R;
    toHaveErrorMessage(text?: string | RegExp): R;
    toHaveSelection(selection?: string): R;
    toHaveRole(role: string): R;
    toBePressed(): R;
    toBePartiallyPressed(): R;
    toAppearBefore(element: HTMLElement | SVGElement): R;
    toAppearAfter(element: HTMLElement | SVGElement): R;
    toBeInTheDOM(container?: HTMLElement | SVGElement): R;
    toHaveDescription(text?: string | RegExp): R;
}

declare namespace jest {
    interface Matchers<R, _T = unknown> extends TestingLibraryMatchers<R> {}
}
