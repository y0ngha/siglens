import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';

/**
 * useOverallAnalysis 훅을 mock하지 않고 실제로 구동한다 — OverallContent.test.tsx가
 * state를 강제 주입해 개별 분기를 보는 것과 달리, 이 파일은 CTA 클릭 → submit →
 * polling → done(또는 error → 재시도) 전이가 사용자 상호작용으로 실제 일어나는지
 * 본다. 그래서 Server Action과 sleep만 mock한다: 네트워크 호출을 결정적으로
 * 만들고, 3초 polling 대기(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS)를 즉시 resolve해
 * 테스트가 done까지 빠르게 진행되게 하기 위함이다.
 *
 * vi.mock은 hoist되지만 ESLint(import/first)와 가독성을 위해 import 위에 둔다.
 */
vi.mock('@/entities/analysis/actions', () => ({
    submitOverallAnalysisAction: vi.fn(),
    pollOverallAnalysisAction: vi.fn(),
    pollAnalysisAction: vi.fn(),
    pollFundamentalAnalysisAction: vi.fn(),
    cancelAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelFundamentalAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelOverallAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/news-article/actions', () => ({
    pollNewsAnalysisAction: vi.fn(),
    cancelNewsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/options-chain/actions', () => ({
    pollOptionsAnalysisAction: vi.fn(),
    cancelOptionsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
// polling 루프의 3초 sleep을 즉시 resolve해 테스트가 done까지 빠르게 진행되게 한다.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('@/widgets/symbol-page/hooks/useDefaultModelId', () => ({
    useDefaultModelId: vi.fn(() => 'gemini-2.5-flash-lite'),
}));
// react-markdown은 ESM-only라 테스트 환경에서 직접 로드하면 실패한다. 본 테스트는
// 서사 텍스트 노출 여부만 보므로 MarkdownText를 단순 wrapper로 대체한다.
vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

import { OverallContent } from '@/widgets/overall/OverallContent';
import {
    submitOverallAnalysisAction,
    pollOverallAnalysisAction,
} from '@/entities/analysis/actions';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

const mockSubmit = submitOverallAnalysisAction as MockedFunction<
    typeof submitOverallAnalysisAction
>;
const mockPollOverall = pollOverallAnalysisAction as MockedFunction<
    typeof pollOverallAnalysisAction
>;

const DONE_RESULT: OverallAnalysisResponse = {
    headlineKo: 'AAPL 종합 분석 헤드라인',
    technicalBulletsKo: ['기술적 신호'],
    fundamentalBulletsKo: ['펀더멘털 신호'],
    newsBulletsKo: ['뉴스 신호'],
    optionsBulletsKo: ['옵션 신호'],
    integratedConclusionKo: '통합 결론',
    scenarios: [],
    riskFactorsKo: [],
};

function renderOverall() {
    // 매 호출이 격리된 새 QueryClient를 만들어 테스트 간 캐시 공유가 없다. 그래서
    // hook 테스트(useOverallAnalysis.test.tsx)처럼 client를 추적해 afterEach에서
    // clear할 필요가 없다 — 컴포넌트는 RTL cleanup이 unmount하고 client는 GC된다.
    return render(
        <OverallContent
            symbol="AAPL"
            companyName="Apple Inc."
            timeframe="1Day"
        />,
        { wrapper: createQueryClientWrapper().wrapper }
    );
}

describe('OverallContent 사용자 분석 플로우 (userEvent)', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPollOverall.mockReset();
    });

    it('CTA 클릭 → submit → polling → done 서사를 렌더한다', async () => {
        const user = userEvent.setup();
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'overall-job',
        });
        mockPollOverall
            .mockResolvedValueOnce({ status: 'processing' })
            .mockResolvedValueOnce({ status: 'done', result: DONE_RESULT });

        renderOverall();

        const cta = await screen.findByRole('button', {
            name: /AI 종합 분석 받기/,
        });
        await user.click(cta);

        expect(
            await screen.findByText('AAPL 종합 분석 헤드라인')
        ).toBeInTheDocument();

        // 훅은 첫 trigger에서 queryFnForceRef(false)를 그대로 options로 넘기므로
        // 5번째 인자는 정확히 { force: false }다 — done 상태에서의 재분석만 force:true.
        expect(mockSubmit).toHaveBeenCalledTimes(1);
        const firstArgs = mockSubmit.mock.calls[0]!;
        expect(firstArgs[0]).toBe('AAPL');
        expect(firstArgs[4]).toEqual({ force: false });

        expect(mockPollOverall).toHaveBeenCalledWith('overall-job');
        expect(mockPollOverall).toHaveBeenCalledTimes(2);
    });

    it('CTA 클릭 → submit 에러 → "다시 시도" 클릭 → 재시도해 done이 된다', async () => {
        const user = userEvent.setup();
        mockSubmit
            .mockResolvedValueOnce({
                status: 'error',
                axis: 'technical',
                error: '일시적 오류',
            })
            .mockResolvedValueOnce({
                status: 'cached',
                result: DONE_RESULT,
            });

        renderOverall();

        await user.click(
            await screen.findByRole('button', { name: /AI 종합 분석 받기/ })
        );

        expect(
            await screen.findByText(/일시적 오류 \(technical 축 실패\)/)
        ).toBeInTheDocument();
        const retry = screen.getByRole('button', { name: '다시 시도' });
        await user.click(retry);

        expect(
            await screen.findByText('AAPL 종합 분석 헤드라인')
        ).toBeInTheDocument();
        expect(mockSubmit).toHaveBeenCalledTimes(2);
    });
});
