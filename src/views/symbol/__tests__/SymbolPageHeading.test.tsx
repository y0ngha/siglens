import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SymbolPageHeading } from '../ui/SymbolPageHeading';

describe('SymbolPageHeading', () => {
    it('주어진 텍스트로 가시 h1을 렌더한다 (sr-only 아님)', () => {
        render(
            <SymbolPageHeading>
                애플, Apple Inc. (AAPL) 차트 분석
            </SymbolPageHeading>
        );
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('애플, Apple Inc. (AAPL) 차트 분석');
        expect(h1).not.toHaveClass('sr-only');
    });

    it('custom className을 병합한다', () => {
        render(<SymbolPageHeading className="px-6">제목</SymbolPageHeading>);
        expect(screen.getByRole('heading', { level: 1 })).toHaveClass('px-6');
    });
});
