import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewsCardShell } from '@/shared/ui/NewsCardShell';

/**
 * NewsCardShell 공통 article 셸 렌더 테스트.
 * 슬롯/마크업 형태를 고정해 구조적 회귀를 방지한다.
 */

const defaultProps = {
    title: '테스트 뉴스 제목',
    isHighImpact: false,
    pending: false,
    analysisSkeleton: <div data-testid="analysis-skeleton" />,
    summarySkeletonLine: <div data-testid="summary-skeleton" />,
    badgeRow: <div data-testid="badge-row">배지 행</div>,
    bodySection: <div data-testid="body-section">본문 내용</div>,
    linkChildren: '원문 보기 →',
    url: 'https://example.com/news/1',
} as const;

describe('NewsCardShell', () => {
    it('article 루트 엘리먼트로 렌더된다', () => {
        const { container } = render(<NewsCardShell {...defaultProps} />);
        expect(container.firstChild?.nodeName).toBe('ARTICLE');
    });

    it('제목을 h3 태그로 렌더한다', () => {
        render(<NewsCardShell {...defaultProps} />);
        const heading = screen.getByRole('heading', { level: 3 });
        expect(heading).toHaveTextContent('테스트 뉴스 제목');
    });

    it('pending=false일 때 badgeRow 슬롯을 렌더한다', () => {
        render(<NewsCardShell {...defaultProps} pending={false} />);
        expect(screen.getByTestId('badge-row')).toBeInTheDocument();
        expect(
            screen.queryByTestId('analysis-skeleton')
        ).not.toBeInTheDocument();
    });

    it('pending=false일 때 bodySection 슬롯을 렌더한다', () => {
        render(<NewsCardShell {...defaultProps} pending={false} />);
        expect(screen.getByTestId('body-section')).toBeInTheDocument();
        expect(
            screen.queryByTestId('summary-skeleton')
        ).not.toBeInTheDocument();
    });

    it('pending=true일 때 analysisSkeleton을 렌더하고 badgeRow는 숨긴다', () => {
        render(<NewsCardShell {...defaultProps} pending={true} />);
        expect(screen.getByTestId('analysis-skeleton')).toBeInTheDocument();
        expect(screen.queryByTestId('badge-row')).not.toBeInTheDocument();
    });

    it('pending=true일 때 summarySkeletonLine을 렌더하고 bodySection은 숨긴다', () => {
        render(<NewsCardShell {...defaultProps} pending={true} />);
        expect(screen.getByTestId('summary-skeleton')).toBeInTheDocument();
        expect(screen.queryByTestId('body-section')).not.toBeInTheDocument();
    });

    it('pending=false일 때 원문 링크를 렌더한다', () => {
        render(<NewsCardShell {...defaultProps} pending={false} />);
        const link = screen.getByRole('link', { name: /원문 보기/ });
        expect(link).toHaveAttribute('href', 'https://example.com/news/1');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('pending=true일 때 원문 링크를 렌더하지 않는다', () => {
        render(<NewsCardShell {...defaultProps} pending={true} />);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('isHighImpact=true일 때 amber border 클래스를 article에 적용한다', () => {
        const { container } = render(
            <NewsCardShell {...defaultProps} isHighImpact={true} />
        );
        // border-l-[3px] 클래스가 있으면 amber accent가 표시된다는 신호.
        expect(container.firstChild).toHaveClass('border-l-[3px]');
    });

    it('isHighImpact=false일 때 amber border 클래스를 적용하지 않는다', () => {
        const { container } = render(
            <NewsCardShell {...defaultProps} isHighImpact={false} />
        );
        expect(container.firstChild).not.toHaveClass('border-l-[3px]');
    });

    it('tickerChipSlot prop이 있으면 렌더한다', () => {
        render(
            <NewsCardShell
                {...defaultProps}
                tickerChipSlot={<span data-testid="ticker-chip">AAPL</span>}
            />
        );
        expect(screen.getByTestId('ticker-chip')).toBeInTheDocument();
    });

    it('tickerChipSlot prop이 없으면 렌더하지 않는다', () => {
        render(<NewsCardShell {...defaultProps} tickerChipSlot={undefined} />);
        // tickerChipSlot은 선택 prop — 없으면 아무것도 렌더되지 않아야 한다.
        expect(screen.queryByTestId('ticker-chip')).not.toBeInTheDocument();
    });

    it('title이 null이면 h3를 빈 내용으로 렌더한다', () => {
        render(<NewsCardShell {...defaultProps} title={null} />);
        const heading = screen.getByRole('heading', { level: 3 });
        expect(heading).toBeEmptyDOMElement();
    });
});
