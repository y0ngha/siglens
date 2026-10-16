// @vitest-environment jsdom
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('애플(AAPL)'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/requireResolvableAsset', () => ({
    requireResolvableAsset: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/symbolIndexabilityMetadata', () => ({
    getBlockedSymbolMetadata: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/entities/investor-flows/server/getInvestorFlowsScorecard', () => ({
    getInvestorFlowsScorecard: vi.fn(),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/widgets/investor-flows/InvestorFlowsContent', () => ({
    InvestorFlowsContent: ({
        finraEnabled,
        regShoEnabled,
        readiness,
    }: {
        finraEnabled: boolean;
        regShoEnabled: boolean;
        readiness: { institutional: string; short: string };
    }) => (
        <div
            data-testid="content"
            data-finra={String(finraEnabled)}
            data-regsho={String(regShoEnabled)}
            data-institutional={readiness.institutional}
            data-short={readiness.short}
        />
    ),
}));
vi.mock('@/widgets/investor-flows/InvestorFlowsEmpty', () => ({
    InvestorFlowsEmpty: ({
        collecting,
        shortCollecting,
        market,
    }: {
        collecting?: boolean;
        shortCollecting?: boolean;
        market?: string;
    }) => (
        <div
            data-testid="empty"
            data-collecting={String(collecting)}
            data-short={String(shortCollecting)}
            data-market={String(market)}
        />
    ),
}));
vi.mock('@/widgets/investor-flows/KrInvestorFlowsContent', () => ({
    KrInvestorFlowsContent: ({
        krCompany,
    }: {
        krCompany: { viaCommonShare: boolean } | null;
    }) => (
        <div
            data-testid="kr-content"
            data-via-common={String(krCompany?.viaCommonShare)}
        />
    ),
}));
vi.mock('@/widgets/investor-flows/InvestorFlowsSummary', () => ({
    InvestorFlowsSummary: ({ symbol }: { symbol: string }) => (
        <div data-testid="summary" data-symbol={symbol} />
    ),
}));
vi.mock('@/app/[locale]/[symbol]/flows/FlowsDegraded', () => ({
    FlowsDegraded: () => <div data-testid="degraded" />,
}));
vi.mock('@/views/symbol/ui/SymbolPageHeading', () => ({
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) => (
        <h1>{children}</h1>
    ),
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: ({
        current,
        marketProfile,
    }: {
        current: string;
        marketProfile?: string;
    }) => (
        <div
            data-testid="cross"
            data-current={current}
            data-profile={String(marketProfile)}
        />
    ),
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { getInvestorFlowsScorecard } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { ALWAYS_NOINDEX_TAB_ROBOTS } from '@/shared/lib/seo';
import FlowsPage, {
    generateMetadata,
    generateStaticParams,
    revalidate,
} from '@/app/[locale]/[symbol]/flows/page';

const ASSET = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    },
    degraded: false,
};
const params = (symbol = 'AAPL') => Promise.resolve({ locale: 'ko', symbol });

function arrange(flows: Record<string, unknown>) {
    vi.mocked(isTabAllowedForSymbol).mockResolvedValue(true);
    vi.mocked(getAssetInfoResilient).mockResolvedValue(ASSET as never);
    vi.mocked(requireResolvableAsset).mockResolvedValue(ASSET as never);
    vi.mocked(getProfileResilient).mockResolvedValue({
        profile: { symbol: 'AAPL' },
        degraded: false,
    } as never);
    vi.mocked(getInvestorFlowsScorecard).mockResolvedValue({
        snapshot: null,
        scorecard: null,
        degraded: false,
        finraEnabled: true,
        regShoEnabled: true,
        readiness: { institutional: 'ready', short: 'ready' },
        ...flows,
    } as never);
}

describe('flows page ISR config', () => {
    it('revalidate는 리터럴 43200(12h) — 스냅샷 캐시 TTL과 같다', () => {
        expect(revalidate).toBe(43200);
    });

    it('generateStaticParams는 빈 배열(on-demand ISR)', async () => {
        expect(await generateStaticParams()).toEqual([]);
    });
});

describe('flows page 탭 가드', () => {
    beforeEach(() => vi.clearAllMocks());

    it('수급 탭이 없는 심볼(크립토)은 데이터를 읽기 전에 notFound()다', async () => {
        vi.mocked(isTabAllowedForSymbol).mockResolvedValue(false);
        await expect(FlowsPage({ params: params('BTCUSD') })).rejects.toThrow(
            'NEXT_NOT_FOUND'
        );
        expect(isTabAllowedForSymbol).toHaveBeenCalledWith('BTCUSD', 'flows');
        expect(getInvestorFlowsScorecard).not.toHaveBeenCalled();
        expect(getProfileResilient).not.toHaveBeenCalled();
    });

    it('잘못된 심볼 형식은 가드 이전에 notFound()다', async () => {
        await expect(FlowsPage({ params: params('../x') })).rejects.toThrow(
            'NEXT_NOT_FOUND'
        );
        expect(isTabAllowedForSymbol).not.toHaveBeenCalled();
    });

    it('generateMetadata도 같은 가드로 404다', async () => {
        vi.mocked(requireResolvableAsset).mockResolvedValue(ASSET as never);
        vi.mocked(isTabAllowedForSymbol).mockResolvedValue(false);
        await expect(
            generateMetadata({ params: params('005930.KS') })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });
});

describe('flows generateMetadata', () => {
    beforeEach(() => vi.clearAllMocks());

    it('항상 noindex(follow 유지, 의회 거래 탭과 같은 정책)이고 self-canonical을 낸다', async () => {
        vi.mocked(isTabAllowedForSymbol).mockResolvedValue(true);
        vi.mocked(requireResolvableAsset).mockResolvedValue(ASSET as never);
        const meta = await generateMetadata({ params: params() });
        expect(meta.robots).toEqual(ALWAYS_NOINDEX_TAB_ROBOTS);
        expect(meta.alternates?.canonical).toContain('/AAPL/flows');
    });
});

describe('flows page 본문', () => {
    beforeEach(() => vi.clearAllMocks());

    it('데이터가 있으면 본문 + AI 해석 + 크로스링크(current=flows)를 그린다', async () => {
        arrange({
            snapshot: { asOf: 'x' },
            scorecard: { composite: {} },
            finraEnabled: false,
            regShoEnabled: false,
        });
        render(await FlowsPage({ params: params() }));
        expect(screen.getByTestId('content')).toHaveAttribute(
            'data-finra',
            'false'
        );
        expect(screen.getByTestId('content')).toHaveAttribute(
            'data-regsho',
            'false'
        );
        expect(screen.getByTestId('summary')).toHaveAttribute(
            'data-symbol',
            'AAPL'
        );
        expect(screen.getByTestId('cross')).toHaveAttribute(
            'data-current',
            'flows'
        );
        expect(screen.getByTestId('cross')).toHaveAttribute(
            'data-profile',
            'us-equity'
        );
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '애플(AAPL) 기관·공매도 수급'
        );
    });

    it('AI 해석이 본문(점수 카드·표)보다 위, 크로스링크는 맨 아래다 — 다른 분석 탭과 같은 순서', async () => {
        arrange({
            snapshot: { asOf: 'x' },
            scorecard: { composite: {} },
            finraEnabled: true,
        });
        render(await FlowsPage({ params: params() }));
        const order = ['summary', 'content', 'cross'].map(id =>
            screen.getByTestId(id)
        );
        const [summary, content, cross] = order;
        const before = Node.DOCUMENT_POSITION_FOLLOWING;
        expect(summary!.compareDocumentPosition(content!) & before).toBe(
            before
        );
        expect(content!.compareDocumentPosition(cross!) & before).toBe(before);
        expect(
            screen
                .getByRole('heading', { level: 1 })
                .compareDocumentPosition(summary!) & before
        ).toBe(before);
    });

    it('데이터 없음(정상)은 빈 상태 + 크로스링크이고 AI를 부르지 않는다', async () => {
        arrange({});
        render(await FlowsPage({ params: params() }));
        expect(screen.getByTestId('empty')).toBeInTheDocument();
        expect(screen.queryByTestId('summary')).toBeNull();
        expect(shortenRevalidateForRuntimeDegrade).not.toHaveBeenCalled();
    });

    it('준비 상태를 본문에 그대로 넘긴다(수집 중 안내의 근거)', async () => {
        arrange({
            snapshot: { asOf: 'x' },
            scorecard: { composite: {} },
            readiness: { institutional: 'collecting', short: 'ready' },
        });
        render(await FlowsPage({ params: params() }));
        const content = screen.getByTestId('content');
        expect(content).toHaveAttribute('data-institutional', 'collecting');
        expect(content).toHaveAttribute('data-short', 'ready');
    });

    it('스냅샷이 없어도 13F가 수집 중이면 빈 상태가 "수집 중" 문구로 간다(AI는 여전히 부르지 않는다)', async () => {
        arrange({
            readiness: { institutional: 'collecting', short: 'collecting' },
        });
        render(await FlowsPage({ params: params() }));
        expect(screen.getByTestId('empty')).toHaveAttribute(
            'data-collecting',
            'true'
        );
        expect(screen.getByTestId('empty')).toHaveAttribute(
            'data-short',
            'true'
        );
        expect(screen.queryByTestId('summary')).toBeNull();
    });

    it('FINRA가 꺼져 있으면 13F만 수집 중으로 넘긴다(본문이 공매도를 말하지 않는다)', async () => {
        arrange({
            finraEnabled: false,
            readiness: { institutional: 'collecting', short: 'unknown' },
        });
        render(await FlowsPage({ params: params() }));
        const empty = screen.getByTestId('empty');
        expect(empty).toHaveAttribute('data-collecting', 'true');
        expect(empty).toHaveAttribute('data-short', 'false');
    });

    it.each([
        ['ready', 'ready'],
        ['unknown', 'unknown'],
    ])(
        '13F가 %s이면 빈 상태는 예전 "데이터 없음"이다',
        async (institutional, short) => {
            arrange({ readiness: { institutional, short } });
            render(await FlowsPage({ params: params() }));
            expect(screen.getByTestId('empty')).toHaveAttribute(
                'data-collecting',
                'false'
            );
        }
    );

    it('수급 인프라 장애는 degrade 화면이고 revalidate를 5분으로 낮춘다', async () => {
        arrange({ degraded: true });
        render(await FlowsPage({ params: params() }));
        expect(screen.getByTestId('degraded')).toBeInTheDocument();
        expect(shortenRevalidateForRuntimeDegrade).toHaveBeenCalledTimes(1);
    });

    it('profile 조회 장애도 degrade 화면이다(수급 조회 결과와 무관)', async () => {
        arrange({ snapshot: { asOf: 'x' }, scorecard: {} });
        vi.mocked(getProfileResilient).mockResolvedValue({
            profile: null,
            degraded: true,
        } as never);
        render(await FlowsPage({ params: params() }));
        expect(screen.getByTestId('degraded')).toBeInTheDocument();
    });

    it('profile이 null(실존하지 않는 종목)이면 notFound()다', async () => {
        arrange({});
        vi.mocked(getProfileResilient).mockResolvedValue({
            profile: null,
            degraded: false,
        } as never);
        await expect(FlowsPage({ params: params() })).rejects.toThrow(
            'NEXT_NOT_FOUND'
        );
    });
});

describe('flows page 본문 — 한국 종목', () => {
    beforeEach(() => vi.clearAllMocks());

    const KR_ASSET = {
        assetInfo: {
            symbol: '005930.KS',
            name: 'Samsung Electronics',
            koreanName: '삼성전자',
        },
        degraded: false,
    };
    const READY_ALL = {
        institutional: 'ready',
        short: 'ready',
        failsToDeliver: 'ready',
        filings: 'ready',
        thresholdList: 'ready',
        dart: 'ready',
    };

    function arrangeKr(flows: Record<string, unknown>) {
        arrange({
            market: 'kr',
            krCompany: null,
            finraEnabled: false,
            regShoEnabled: false,
            readiness: READY_ALL,
            ...flows,
        });
        vi.mocked(getAssetInfoResilient).mockResolvedValue(KR_ASSET as never);
    }

    it('DART 레이아웃: 한국 본문 → AI 해석 → 크로스링크 순이고 미국 본문은 없다', async () => {
        arrangeKr({
            snapshot: { asOf: '2026-10-16', market: 'kr' },
            scorecard: { composite: {}, market: 'kr' },
            krCompany: { corpName: '삼성전자', viaCommonShare: true },
        });
        render(await FlowsPage({ params: params('005935.KS') }));
        expect(screen.queryByTestId('content')).toBeNull();
        const krContent = screen.getByTestId('kr-content');
        expect(krContent).toHaveAttribute('data-via-common', 'true');
        const summary = screen.getByTestId('summary');
        const before = Node.DOCUMENT_POSITION_FOLLOWING;
        expect(krContent.compareDocumentPosition(summary) & before).toBe(
            before
        );
        expect(
            summary.compareDocumentPosition(screen.getByTestId('cross')) &
                before
        ).toBe(before);
        // 크로스링크는 한국 탭 집합(옵션·의회 거래 없음)으로 그린다.
        expect(screen.getByTestId('cross')).toHaveAttribute(
            'data-profile',
            'kr-equity'
        );
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '대량보유·임원 지분 공시'
        );
    });

    it('데이터가 없으면 한국 빈 상태이고, 13F·FINRA가 수집 중이어도 "수집 중"이 아니다', async () => {
        arrangeKr({
            readiness: {
                ...READY_ALL,
                institutional: 'collecting',
                short: 'collecting',
            },
        });
        render(await FlowsPage({ params: params('005930.KS') }));
        const empty = screen.getByTestId('empty');
        expect(empty).toHaveAttribute('data-market', 'kr');
        expect(empty).toHaveAttribute('data-collecting', 'false');
        expect(screen.queryByTestId('summary')).toBeNull();
    });

    it('DART 백필 중이면 한국 빈 상태가 "수집 중"이다', async () => {
        arrangeKr({ readiness: { ...READY_ALL, dart: 'collecting' } });
        render(await FlowsPage({ params: params('005930.KS') }));
        expect(screen.getByTestId('empty')).toHaveAttribute(
            'data-collecting',
            'true'
        );
    });

    it('한국 종목도 항상 noindex이고 메타데이터가 지분공시 카피다', async () => {
        vi.mocked(isTabAllowedForSymbol).mockResolvedValue(true);
        vi.mocked(requireResolvableAsset).mockResolvedValue(KR_ASSET as never);
        const meta = await generateMetadata({ params: params('005930.KS') });
        expect(meta.robots).toEqual(ALWAYS_NOINDEX_TAB_ROBOTS);
        expect(JSON.stringify(meta.title)).toContain('지분 공시');
        expect(String(meta.description)).toContain('DART');
    });
});
