vi.mock('@/shared/config/time', () => ({
    MS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60,
}));
vi.mock('@/shared/config/pollingConfig', () => ({
    AUGMENT_AND_OVERALL_POLL_INTERVAL_MS: 5000,
}));

import { render, screen } from '@testing-library/react';
import type { OverallAxis } from '@y0ngha/siglens-core';

import { DependencyProgress } from '../DependencyProgress';

const ALL_PENDING: Record<OverallAxis, string | undefined> = {
    technical: 'job-1',
    news: 'job-2',
    fundamental: 'job-3',
    options: 'job-4',
};

const TWO_DONE: Record<OverallAxis, string | undefined> = {
    technical: undefined,
    news: undefined,
    fundamental: 'job-3',
    options: 'job-4',
};

describe('DependencyProgress', () => {
    it('renders completed / total count', () => {
        render(<DependencyProgress pendingJobs={TWO_DONE} retryCount={0} />);

        expect(screen.getByText(/2\/4/)).toBeInTheDocument();
    });

    it('marks completed axes with the checkmark', () => {
        render(<DependencyProgress pendingJobs={TWO_DONE} retryCount={0} />);

        expect(screen.getByText(/기술적 분석/)).toBeInTheDocument();
        expect(screen.getAllByText(/— 완료/)).toHaveLength(2);
        expect(screen.getAllByText(/— 진행 중…/)).toHaveLength(2);
    });

    it('shows all four axis labels', () => {
        render(<DependencyProgress pendingJobs={ALL_PENDING} retryCount={0} />);

        expect(screen.getByText(/기술적 분석/)).toBeInTheDocument();
        expect(screen.getByText(/뉴스 분석/)).toBeInTheDocument();
        expect(screen.getByText(/펀더멘털 분석/)).toBeInTheDocument();
        expect(screen.getByText(/옵션 시장 분석/)).toBeInTheDocument();
    });

    it('displays remaining minutes estimate', () => {
        render(<DependencyProgress pendingJobs={ALL_PENDING} retryCount={0} />);

        expect(screen.getByText(/약 \d+분 소요/)).toBeInTheDocument();
    });

    it('decreases remaining estimate as retryCount increases', () => {
        const { rerender } = render(
            <DependencyProgress pendingJobs={ALL_PENDING} retryCount={0} />
        );
        const firstText = screen.getByText(/약 \d+분 소요/).textContent;

        rerender(
            <DependencyProgress pendingJobs={ALL_PENDING} retryCount={40} />
        );
        const secondText = screen.getByText(/약 \d+분 소요/).textContent;

        expect(firstText).not.toBe(secondText);
    });

    it('sets aria-busy on the section', () => {
        render(<DependencyProgress pendingJobs={ALL_PENDING} retryCount={0} />);

        const section = screen.getByRole('region', {
            name: /종합 분석에 필요한 데이터 수집 중/,
        });
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    describe('crypto applicableAxes (2 axes)', () => {
        const CRYPTO_PENDING: Record<OverallAxis, string | undefined> = {
            technical: 'job-1',
            news: 'job-2',
            fundamental: undefined,
            options: undefined,
        };

        it('shows 0/2 when both crypto axes are pending', () => {
            render(
                <DependencyProgress
                    pendingJobs={CRYPTO_PENDING}
                    retryCount={0}
                    applicableAxes={['technical', 'news']}
                />
            );

            expect(screen.getByText(/0\/2/)).toBeInTheDocument();
        });

        it('renders technical and news axis labels', () => {
            render(
                <DependencyProgress
                    pendingJobs={CRYPTO_PENDING}
                    retryCount={0}
                    applicableAxes={['technical', 'news']}
                />
            );

            expect(screen.getByText(/기술적 분석/)).toBeInTheDocument();
            expect(screen.getByText(/뉴스 분석/)).toBeInTheDocument();
        });

        it('does NOT render fundamental or options axis labels', () => {
            render(
                <DependencyProgress
                    pendingJobs={CRYPTO_PENDING}
                    retryCount={0}
                    applicableAxes={['technical', 'news']}
                />
            );

            expect(screen.queryByText(/펀더멘털 분석/)).not.toBeInTheDocument();
            expect(
                screen.queryByText(/옵션 시장 분석/)
            ).not.toBeInTheDocument();
        });
    });
});
