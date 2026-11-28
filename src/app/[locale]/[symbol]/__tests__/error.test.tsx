import { render, screen } from '@testing-library/react';
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
    SymbolBottomAdProvider,
    useSymbolBottomAdSuppressed,
} from '@/features/ad-slot/model/SymbolBottomAdContext';
import SymbolError from '../error';

describe('SymbolError ([symbol] subtree error boundary)', () => {
    const error = Object.assign(new Error('boom'), { digest: 'deadbeef' });

    it('renders exactly one h1 (single-h1 contract is preserved even on error)', () => {
        const { container } = render(
            <SymbolError error={error} reset={vi.fn()} />
        );
        expect(container.querySelectorAll('h1')).toHaveLength(1);
    });

    it('wires the retry button to reset()', () => {
        const reset = vi.fn();
        render(<SymbolError error={error} reset={reset} />);

        screen.getByRole('button', { name: '다시 시도' }).click();

        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('offers a working home link', () => {
        render(<SymbolError error={error} reset={vi.fn()} />);

        expect(screen.getByRole('link', { name: /홈으로/ })).toHaveAttribute(
            'href',
            '/'
        );
    });

    it('logs the error (with its digest) for server-side correlation', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        render(<SymbolError error={error} reset={vi.fn()} />);

        expect(errorSpy).toHaveBeenCalledWith(
            '[SymbolRoute] render error:',
            error
        );
        errorSpy.mockRestore();
    });

    // 오류 경계는 `[symbol]` 레이아웃 안쪽이라 레이아웃의 공통 하단 광고가 오류 화면 아래 남는다.
    // AdSense는 오류 화면의 광고를 금지한다.
    it('suppresses the layout bottom ad', () => {
        function AdProbe() {
            return (
                <p data-testid="bottom-ad">
                    {useSymbolBottomAdSuppressed() ? 'suppressed' : 'open'}
                </p>
            );
        }
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        render(
            <SymbolBottomAdProvider>
                <SymbolError error={error} reset={vi.fn()} />
                <AdProbe />
            </SymbolBottomAdProvider>
        );
        expect(screen.getByTestId('bottom-ad')).toHaveTextContent('suppressed');
        errorSpy.mockRestore();
    });
});
