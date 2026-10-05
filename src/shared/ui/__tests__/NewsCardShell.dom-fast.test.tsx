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

    describe('제목 stretched link', () => {
        it('제목이 원문으로 가는 새 탭 링크다 (h3 안의 a)', () => {
            render(<NewsCardShell {...defaultProps} pending={false} />);
            const link = screen.getByRole('link', {
                name: /테스트 뉴스 제목/,
            });
            expect(link).toHaveAttribute('href', 'https://example.com/news/1');
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
            expect(link.closest('h3')).toBe(
                screen.getByRole('heading', { level: 3 })
            );
        });

        it('링크 이름에 새 탭 안내가 스크린리더용으로 붙는다', () => {
            render(<NewsCardShell {...defaultProps} />);
            const link = screen.getByRole('link');
            expect(link).toHaveAccessibleName('테스트 뉴스 제목 (새 탭)');
            expect(link.querySelector('.sr-only')).toHaveTextContent('(새 탭)');
        });

        it('::after가 relative인 article 전체를 덮는다', () => {
            const { container } = render(<NewsCardShell {...defaultProps} />);
            expect(container.firstChild).toHaveClass('relative');
            const link = screen.getByRole('link');
            expect(link).toHaveClass(
                'after:absolute',
                'after:inset-0',
                "after:content-['']"
            );
            // 링크 자신이 positioned면 ::after가 제목 크기로 갇힌다.
            expect(link).not.toHaveClass('relative');
            expect(link).not.toHaveClass('absolute');
        });

        it('분석 중(pending)에도 제목은 링크다', () => {
            render(<NewsCardShell {...defaultProps} pending={true} />);
            expect(
                screen.getByRole('link', { name: /테스트 뉴스 제목/ })
            ).toHaveAttribute('href', 'https://example.com/news/1');
        });

        it('링크가 제목 하나뿐이다 — 하단 "원문 보기"는 링크가 아니다', () => {
            render(<NewsCardShell {...defaultProps} pending={false} />);
            expect(screen.getAllByRole('link')).toHaveLength(1);
            const cue = screen.getByText('원문 보기 →', { ignore: 'none' });
            expect(cue.closest('a')).toBeNull();
            expect(cue).toHaveAttribute('aria-hidden', 'true');
        });

        it('분석 중에는 하단 "원문 보기" 단서를 그리지 않는다', () => {
            render(<NewsCardShell {...defaultProps} pending={true} />);
            expect(screen.queryByText('원문 보기 →')).not.toBeInTheDocument();
        });

        it('a 안에 a를 중첩하지 않는다 (티커 칩 같은 슬롯 링크는 형제)', () => {
            const { container } = render(
                <NewsCardShell
                    {...defaultProps}
                    tickerChipSlot={
                        <a
                            href="https://example.com/chip"
                            className="relative z-10"
                        >
                            AAPL
                        </a>
                    }
                />
            );
            expect(container.querySelectorAll('a a')).toHaveLength(0);
            expect(container.querySelectorAll('a')).toHaveLength(2);
        });

        it('제목이 없으면 출처 이름을 링크 텍스트로 쓴다 (stretched link 유지)', () => {
            render(
                <NewsCardShell
                    {...defaultProps}
                    title={null}
                    fallbackTitle="Reuters"
                />
            );
            const link = screen.getByRole('link', { name: /Reuters/ });
            expect(link).toHaveAttribute('href', 'https://example.com/news/1');
            expect(link).toHaveClass('after:absolute', 'after:inset-0');
            expect(link.closest('h3')).not.toBeNull();
        });

        it('빈 문자열 제목도 같은 폴백을 쓴다', () => {
            render(
                <NewsCardShell
                    {...defaultProps}
                    title=""
                    fallbackTitle="Reuters"
                />
            );
            expect(
                screen.getByRole('link', { name: /Reuters/ })
            ).toBeInTheDocument();
        });

        it('제목도 출처도 없으면 URL 호스트를 쓴다', () => {
            render(<NewsCardShell {...defaultProps} title={null} />);
            expect(
                screen.getByRole('link', { name: /example\.com/ })
            ).toHaveAttribute('href', 'https://example.com/news/1');
        });

        it('제목·출처가 없고 URL도 파싱되지 않으면 링크를 그리지 않는다', () => {
            render(
                <NewsCardShell {...defaultProps} title={null} url="not a url" />
            );
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
        });
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

    it('제목·출처·호스트가 모두 없으면 h3를 빈 내용으로 렌더한다', () => {
        render(
            <NewsCardShell {...defaultProps} title={null} url="not a url" />
        );
        const heading = screen.getByRole('heading', { level: 3 });
        expect(heading).toBeEmptyDOMElement();
    });
});
