// vi.mock → imports 순서 (MISTAKES.md Tests §17)
const { mockGetFmpMsg } = vi.hoisted(() => ({ mockGetFmpMsg: vi.fn() }));

vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpUserFacingMessage: mockGetFmpMsg,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FallbackProps } from 'react-error-boundary';
import { FinancialsAiSummaryError } from '../FinancialsAiSummaryError';

// FallbackProps.error is typed `any`; helper keeps the test call sites readable.
const renderError = (error: unknown, reset = vi.fn()) =>
    render(
        <FinancialsAiSummaryError
            {...({ error, resetErrorBoundary: reset } as FallbackProps)}
        />
    );

describe('FinancialsAiSummaryError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the FMP user-facing message when one is available', () => {
        mockGetFmpMsg.mockReturnValue('FMP 사용량을 초과했어요');

        renderError(new Error('raw transport error'));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'FMP 사용량을 초과했어요'
        );
    });

    it('falls back to error.message when no FMP message and error is an Error', () => {
        mockGetFmpMsg.mockReturnValue(null);

        renderError(new Error('상세 오류 메시지'));

        expect(screen.getByRole('alert')).toHaveTextContent('상세 오류 메시지');
    });

    it('falls back to the generic message for non-Error values', () => {
        mockGetFmpMsg.mockReturnValue(null);

        renderError('just a string');

        expect(screen.getByRole('alert')).toHaveTextContent(
            '분석 중 오류가 발생했습니다.'
        );
    });

    it('invokes resetErrorBoundary when 다시 시도 is clicked', () => {
        mockGetFmpMsg.mockReturnValue('err');
        const reset = vi.fn();

        renderError(new Error('x'), reset);
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

        expect(reset).toHaveBeenCalledTimes(1);
    });
});
