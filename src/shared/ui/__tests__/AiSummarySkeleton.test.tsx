import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiSummarySkeleton } from '../AiSummarySkeleton';

const defaultProps = {
    heading: 'AI 테스트 분석',
    idPrefix: 'test-ai-summary',
    progressMessage: 'AI 테스트 분석 진행 중…',
};

describe('AiSummarySkeleton', () => {
    describe('슬롯 — heading·idPrefix 렌더링', () => {
        it('heading prop을 h2로 렌더한다', () => {
            render(<AiSummarySkeleton {...defaultProps} />);

            expect(
                screen.getByRole('heading', { name: 'AI 테스트 분석' })
            ).toBeInTheDocument();
        });

        it('idPrefix를 이용해 aria-labelledby를 연결한다', () => {
            const { container } = render(
                <AiSummarySkeleton
                    {...defaultProps}
                    idPrefix="financials-ai-summary"
                />
            );

            const section = container.querySelector(
                '[aria-labelledby="financials-ai-summary-loading-heading"]'
            );
            expect(section).not.toBeNull();

            const heading = container.querySelector(
                '#financials-ai-summary-loading-heading'
            );
            expect(heading).not.toBeNull();
        });

        it('aria-busy="true"를 section에 설정한다', () => {
            render(<AiSummarySkeleton {...defaultProps} />);

            const section = screen.getByRole('region', {
                name: 'AI 테스트 분석',
            });
            expect(section).toHaveAttribute('aria-busy', 'true');
        });
    });

    describe('진행 메시지', () => {
        it('progressMessage를 렌더한다', () => {
            render(<AiSummarySkeleton {...defaultProps} />);

            expect(
                screen.getByText('AI 테스트 분석 진행 중…')
            ).toBeInTheDocument();
        });
    });

    describe('스피너 — motion-reduce', () => {
        it('스피너에 motion-reduce:animate-none 클래스를 포함한다', () => {
            const { container } = render(
                <AiSummarySkeleton {...defaultProps} />
            );

            const spinner = container.querySelector('.animate-spin');
            expect(spinner?.className).toContain('motion-reduce:animate-none');
        });
    });

    describe('펄스 라인 — 3개 + motion-reduce', () => {
        it('animate-pulse 라인을 3개 렌더한다', () => {
            const { container } = render(
                <AiSummarySkeleton {...defaultProps} />
            );

            const pulseLines = container.querySelectorAll('.animate-pulse');
            expect(pulseLines.length).toBe(3);
        });

        it('각 펄스 라인에 motion-reduce:animate-none 클래스를 포함한다', () => {
            const { container } = render(
                <AiSummarySkeleton {...defaultProps} />
            );

            const pulseLines = container.querySelectorAll('.animate-pulse');
            pulseLines.forEach(line => {
                expect(line.className).toContain('motion-reduce:animate-none');
            });
        });
    });

    describe('className prop', () => {
        it('className이 주어지면 section에 병합된다', () => {
            const { container } = render(
                <AiSummarySkeleton
                    {...defaultProps}
                    className="w-full overflow-hidden"
                />
            );

            const section = container.querySelector('section');
            expect(section?.className).toContain('w-full');
            expect(section?.className).toContain('overflow-hidden');
        });
    });
});
