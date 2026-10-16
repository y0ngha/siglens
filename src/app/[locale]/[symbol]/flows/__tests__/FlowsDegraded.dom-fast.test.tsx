import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowsDegraded } from '@/app/[locale]/[symbol]/flows/FlowsDegraded';

describe('FlowsDegraded', () => {
    it('h1은 하나이고 표시 이름을 담는다(SEO 계약)', () => {
        render(
            <FlowsDegraded displayName="애플" symbol="AAPL" krListing={false} />
        );
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '애플 기관·공매도 수급'
        );
    });

    it('일시 장애 안내와 크로스링크(flows가 현재 페이지)를 그린다', () => {
        render(
            <FlowsDegraded displayName="애플" symbol="AAPL" krListing={false} />
        );
        expect(
            screen.getByText('수급 데이터를 일시적으로 불러올 수 없어요')
        ).toBeInTheDocument();
        expect(screen.getByText('지금 보는 페이지예요')).toBeInTheDocument();
    });

    it('한국 종목은 DART 지분공시 제목과 안내를 쓴다', () => {
        render(
            <FlowsDegraded
                displayName="삼성전자"
                symbol="005930.KS"
                krListing
            />
        );
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '삼성전자 대량보유·임원 지분 공시'
        );
        expect(
            screen.getByText(/대량보유·임원 지분 공시를 보실 수 있어요/)
        ).toBeInTheDocument();
    });
});
