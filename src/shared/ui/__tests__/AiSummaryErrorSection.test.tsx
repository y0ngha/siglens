import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '../AiSummaryErrorSection';

// FallbackProps.error is typed `any`; helper keeps test call sites readable.
const renderSection = (
    error: unknown,
    reset = vi.fn(),
    overrides: {
        heading?: string;
        idPrefix?: string;
        fallbackMessage?: string;
        className?: string;
        getErrorMessage?: (error: unknown) => string | null;
    } = {}
) =>
    render(
        <AiSummaryErrorSection
            error={error as FallbackProps['error']}
            resetErrorBoundary={reset}
            heading={overrides.heading ?? 'AI 테스트 분석'}
            idPrefix={overrides.idPrefix ?? 'test-ai-summary'}
            fallbackMessage={overrides.fallbackMessage}
            className={overrides.className}
            getErrorMessage={overrides.getErrorMessage}
        />
    );

describe('AiSummaryErrorSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('슬롯 — heading 렌더링', () => {
        it('heading prop을 h2로 렌더한다', () => {
            renderSection(new Error('err'), vi.fn(), {
                heading: 'AI 펀더멘털 분석',
            });

            expect(
                screen.getByRole('heading', { name: 'AI 펀더멘털 분석' })
            ).toBeInTheDocument();
        });

        it('idPrefix를 이용해 aria-labelledby를 연결한다', () => {
            const { container } = renderSection(new Error('err'), vi.fn(), {
                idPrefix: 'financials-ai-summary',
            });

            const section = container.querySelector(
                '[aria-labelledby="financials-ai-summary-error-heading"]'
            );
            expect(section).not.toBeNull();

            const heading = container.querySelector(
                '#financials-ai-summary-error-heading'
            );
            expect(heading).not.toBeNull();
        });
    });

    describe('메시지 도출 우선순위', () => {
        it('getErrorMessage가 값을 반환하면 그 값을 표시한다 (FMP 서피스 동작)', () => {
            const getFmpMsg = vi
                .fn()
                .mockReturnValue('FMP 사용량을 초과했어요');

            renderSection(new Error('raw transport error'), vi.fn(), {
                getErrorMessage: getFmpMsg,
            });

            expect(screen.getByRole('alert')).toHaveTextContent(
                'FMP 사용량을 초과했어요'
            );
        });

        it('getErrorMessage가 null을 반환하고 Error 인스턴스면 error.message를 표시한다', () => {
            const getFmpMsg = vi.fn().mockReturnValue(null);

            renderSection(new Error('상세 오류 메시지'), vi.fn(), {
                getErrorMessage: getFmpMsg,
            });

            expect(screen.getByRole('alert')).toHaveTextContent(
                '상세 오류 메시지'
            );
        });

        it('getErrorMessage 없이 Error 인스턴스면 error.message를 표시한다 (뉴스 서피스 동작)', () => {
            renderSection(new Error('상세 오류 메시지'));

            expect(screen.getByRole('alert')).toHaveTextContent(
                '상세 오류 메시지'
            );
        });

        it('Error도 아니고 getErrorMessage도 없으면 기본 fallbackMessage를 표시한다', () => {
            renderSection('just a string');

            expect(screen.getByRole('alert')).toHaveTextContent(
                '분석 중 오류가 발생했습니다.'
            );
        });

        it('fallbackMessage prop을 주입하면 그것을 폴백으로 사용한다', () => {
            renderSection('just a string', vi.fn(), {
                fallbackMessage: '동향 해석 중 오류가 발생했습니다.',
            });

            expect(screen.getByRole('alert')).toHaveTextContent(
                '동향 해석 중 오류가 발생했습니다.'
            );
        });
    });

    describe('재시도 버튼 — 탭 타깃 & 동작', () => {
        it('44px 최소 높이(min-h-11)를 갖는 버튼을 렌더한다', () => {
            const { container } = renderSection(new Error('err'));

            const button = container.querySelector('button[type="button"]');
            expect(button).not.toBeNull();
            expect(button?.className).toContain('min-h-11');
            expect(button?.className).toContain('inline-flex');
            expect(button?.className).toContain('items-center');
        });

        it('버튼 클릭 시 resetErrorBoundary를 1회 호출한다', () => {
            const reset = vi.fn();
            renderSection(new Error('err'), reset);

            fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

            expect(reset).toHaveBeenCalledTimes(1);
        });
    });

    describe('에러 텍스트 색상 토큰', () => {
        it('경고 텍스트에 text-ui-danger-text 클래스를 적용한다', () => {
            const { container } = renderSection(new Error('err'));

            const alert = container.querySelector('[role="alert"]');
            expect(alert?.className).toContain('text-ui-danger-text');
        });
    });

    describe('className prop', () => {
        it('className이 주어지면 section에 병합된다', () => {
            const { container } = renderSection(new Error('err'), vi.fn(), {
                className: 'w-full overflow-hidden',
            });

            const section = container.querySelector('section');
            expect(section?.className).toContain('w-full');
            expect(section?.className).toContain('overflow-hidden');
        });
    });
});
