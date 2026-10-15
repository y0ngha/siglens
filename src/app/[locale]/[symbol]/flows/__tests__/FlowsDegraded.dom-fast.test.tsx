import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowsDegraded } from '@/app/[locale]/[symbol]/flows/FlowsDegraded';

describe('FlowsDegraded', () => {
    it('h1은 하나이고 표시 이름을 담는다(SEO 계약)', () => {
        render(<FlowsDegraded displayName="애플" symbol="AAPL" />);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '애플 기관·공매도 수급'
        );
    });

    it('일시 장애 안내와 크로스링크(flows가 현재 페이지)를 그린다', () => {
        render(<FlowsDegraded displayName="애플" symbol="AAPL" />);
        expect(
            screen.getByText('수급 데이터를 일시적으로 불러올 수 없어요')
        ).toBeInTheDocument();
        expect(screen.getByText('지금 보는 페이지예요')).toBeInTheDocument();
    });
});
