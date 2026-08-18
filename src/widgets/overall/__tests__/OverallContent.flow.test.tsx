import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
 * 만들고, polling 대기(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS)를 즉시 resolve해
 * 테스트가 done까지 빠르게 진행되게 하기 위함이다.
 *
 * vi.mock은 hoist되지만 ESLint(import/first)와 가독성을 위해 import 위에 둔다.
 */
vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));
vi.mock('@/entities/news-article/actions', () => ({
    submitNewsAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/options-chain/actions', () => ({
    submitOptionsAnalysisAction: vi.fn(),
}));
// polling 루프의 sleep을 즉시 resolve해 테스트가 done까지 빠르게 진행되게 한다.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('@/features/symbol-model', () => ({
    useDefaultModelId: vi.fn(() => 'gemini-2.5-flash-lite'),
    useDefaultReasoning: vi.fn(() => false),
    useAnalysisSettingsHydrated: vi.fn(() => true),
    useSymbolModel: vi.fn(() => ({ tier: 'member', isTierHydrated: true })),
}));
// /news와 동일 게이트 적용 후 mock 필요. flow 테스트는 hasEnrichedNews=true 전제로
// 게이트를 즉시 통과시키고 본래 검증(submit→polling→done 서사)을 그대로 유지한다.
// barrel(@/widgets/news)을 mock — production이 barrel을 import하므로 일치 필요.
vi.mock('@/widgets/news', async importOriginal => ({
    ...(await importOriginal<typeof import('@/widgets/news')>()),
    useNewsAnalysisTrigger: vi.fn(),
    useWaitForNewsCards: vi.fn(() => ({ isReady: true, pollError: null })),
}));
// useSearchParams를 테스트별로 바꿀 수 있도록 mutable ref로 모킹한다(고정 빈 값 X).
const { searchParamsRef } = vi.hoisted(() => ({
    searchParamsRef: { value: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
    useRouter: () => ({ replace: vi.fn() }),
}));
// react-markdown은 ESM-only라 테스트 환경에서 직접 로드하면 실패한다. 본 테스트는
// 서사 텍스트 노출 여부만 보므로 MarkdownText를 단순 wrapper로 대체한다.
vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

import { OverallContent } from '@/widgets/overall/OverallContent';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

const mockSubmit = runAnalysisStream as MockedFunction<
    typeof runAnalysisStream
>;

const DONE_RESULT: OverallAnalysisResponse = {
    headlineKo: 'AAPL 종합 분석 헤드라인',
    technicalBulletsKo: ['기술적 신호'],
    fundamentalBulletsKo: ['펀더멘털 신호'],
    newsBulletsKo: ['뉴스 신호'],
    optionsBulletsKo: ['옵션 신호'],
    financialsBulletsKo: [],
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
            hasEnrichedNews={true}
            hasOptions={true}
        />,
        {
            wrapper: createQueryClientWrapper().wrapper,
        }
    );
}

describe('OverallContent 사용자 분석 플로우 (userEvent)', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        searchParamsRef.value = new URLSearchParams();
    });

    afterEach(() => {
        searchParamsRef.value = new URLSearchParams();
    });

    // tf 분기의 단위 검증(참/거짓 양쪽)은 OverallContent.test.tsx에 있고, 여기서는
    // 실제 useOverallAnalysis를 통해 유효 tf가 submit까지 전파되는지(참 분기)를 확인한다.
    it('유효한 tf 쿼리가 있으면 그 timeframe으로 submit한다 (§18 참 분기)', async () => {
        const user = userEvent.setup();
        searchParamsRef.value = new URLSearchParams('tf=1Hour');
        mockSubmit.mockResolvedValue({
            status: 'done',
            result: DONE_RESULT,
        });

        renderOverall();
        await user.click(
            await screen.findByRole('button', { name: /AI 종합 분석 받기/ })
        );
        await screen.findByText('AAPL 종합 분석 헤드라인');

        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'overall',
                params: expect.objectContaining({
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Hour',
                }),
            })
        );
    });

    it('CTA 클릭 → submit → done 서사를 렌더한다', async () => {
        const user = userEvent.setup();
        mockSubmit.mockResolvedValue({
            status: 'done',
            result: DONE_RESULT,
        });

        renderOverall();

        const cta = await screen.findByRole('button', {
            name: /AI 종합 분석 받기/,
        });
        await user.click(cta);

        expect(
            await screen.findByText('AAPL 종합 분석 헤드라인')
        ).toBeInTheDocument();

        // `force`는 전송하지 않는다 — 서버가 재분석 쿨다운에서 파생한다.
        // 클라이언트가 캐시 우회를 지시할 수 있으면 인증 없는 공개 라우트에서
        // 누구나 서버 키로 LLM을 무제한 태울 수 있다.
        expect(mockSubmit).toHaveBeenCalledTimes(1);
        const [firstCall] = mockSubmit.mock.calls[0]!;
        expect(firstCall).toMatchObject({
            type: 'overall',
            params: expect.objectContaining({
                symbol: 'AAPL',
                reasoning: false,
            }),
        });
        expect(firstCall.params).not.toHaveProperty('force');
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
