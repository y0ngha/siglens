import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCongressTrendAction } from '@/entities/analysis/actions/runCongressTrendAction';
import { runFinancialsAnalysisAction } from '@/entities/analysis/actions/runFinancialsAnalysisAction';
import { runFundamentalAnalysisAction } from '@/entities/analysis/actions/runFundamentalAnalysisAction';
import { runInvestorFlowsAction } from '@/entities/analysis/actions/runInvestorFlowsAction';
import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';
import { submitMarketNewsDigestAction } from '@/entities/market-news/actions/submitMarketNewsDigestAction';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions/submitMarketBriefingAction';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions/submitNewsAnalysisAction';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions/optionsActions';
import {
    dispatchHandlerFor,
    isDispatchedType,
    PROMPT_PROBED_TYPES,
    QUOTA_EXEMPT_TYPES,
} from '../dispatch';
import { runOverallDispatch } from '../overallDispatch';
import type { DispatchQuotaContext } from '../types';

vi.mock('@/entities/analysis/actions/runCongressTrendAction', () => ({
    runCongressTrendAction: vi.fn(),
}));
vi.mock('@/entities/analysis/actions/runFinancialsAnalysisAction', () => ({
    runFinancialsAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/analysis/actions/runFundamentalAnalysisAction', () => ({
    runFundamentalAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/analysis/actions/runInvestorFlowsAction', () => ({
    runInvestorFlowsAction: vi.fn(),
}));
vi.mock('@/entities/economy/actions/submitMacroBriefingAction', () => ({
    submitMacroBriefingAction: vi.fn(),
}));
vi.mock('@/entities/market-news/actions/submitMarketNewsDigestAction', () => ({
    submitMarketNewsDigestAction: vi.fn(),
}));
vi.mock('@/entities/market-summary/actions/submitMarketBriefingAction', () => ({
    submitMarketBriefingAction: vi.fn(),
}));
vi.mock('@/entities/news-article/actions/submitNewsAnalysisAction', () => ({
    submitNewsAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/options-chain/actions/optionsActions', () => ({
    submitOptionsAnalysisAction: vi.fn(),
}));
vi.mock('../overallDispatch', () => ({ runOverallDispatch: vi.fn() }));

const signal = new AbortController().signal;
const quota: DispatchQuotaContext = {
    cacheOnly: true,
    rateLimited: false,
    onPromptAssembled: () => {},
};
const params = {
    symbol: 'AAPL',
    companyName: 'Apple',
    modelId: 'm1',
    reasoning: true,
    expirationDate: 'all',
    category: 'macro',
    scope: 'us',
};

describe('isDispatchedType', () => {
    it.each([
        'overall',
        'fundamental',
        'financials',
        'news',
        'marketNewsDigest',
        'options',
        'congress',
        'investorFlows',
        'briefing',
        'macroBriefing',
    ])('%s는 위임 종류다', type => {
        expect(isDispatchedType(type)).toBe(true);
    });

    it('technical은 표에 없다(전용 핸들러가 맡는다)', () => {
        expect(isDispatchedType('technical')).toBe(false);
    });

    it('프로토타입 멤버 이름은 위임 종류가 아니다', () => {
        expect(isDispatchedType('toString')).toBe(false);
        expect(isDispatchedType('constructor')).toBe(false);
    });

    it('문자열이 아니면 위임 종류가 아니다', () => {
        expect(isDispatchedType(undefined)).toBe(false);
        expect(isDispatchedType(5)).toBe(false);
    });
});

describe('dispatchHandlerFor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('overall은 종합 분석 핸들러로 위임한다', () => {
        expect(dispatchHandlerFor('overall')).toBe(runOverallDispatch);
    });

    it('fundamental은 심볼·모델·로케일·reasoning·signal·cacheOnly를 순서대로 넘긴다', () => {
        dispatchHandlerFor('fundamental')(params, signal, 'ja', quota);
        expect(runFundamentalAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'm1',
            'ja',
            true,
            signal,
            true
        );
    });

    it('financials는 fundamental과 같은 인자 모양으로 넘긴다', () => {
        dispatchHandlerFor('financials')(params, signal, 'ko', quota);
        expect(runFinancialsAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'm1',
            'ko',
            true,
            signal,
            true
        );
    });

    it('news는 회사명을 모델 앞에 넘긴다', () => {
        dispatchHandlerFor('news')(params, signal, 'ko', quota);
        expect(submitNewsAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            'm1',
            'ko',
            true,
            signal,
            true
        );
    });

    it('marketNewsDigest는 카테고리·로케일·signal만 넘기고 한도 강등을 받지 않는다', () => {
        dispatchHandlerFor('marketNewsDigest')(params, signal, 'en', quota);
        expect(submitMarketNewsDigestAction).toHaveBeenCalledWith(
            'macro',
            'en',
            signal
        );
    });

    it('options는 만기 선택자를 회사명 뒤에 넘긴다', () => {
        dispatchHandlerFor('options')(params, signal, 'ko', quota);
        expect(submitOptionsAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            'all',
            'm1',
            'ko',
            true,
            signal,
            true
        );
    });

    it('congress는 fundamental과 같은 인자 모양으로 넘긴다', () => {
        dispatchHandlerFor('congress')(params, signal, 'ko', quota);
        expect(runCongressTrendAction).toHaveBeenCalledWith(
            'AAPL',
            'm1',
            'ko',
            true,
            signal,
            true
        );
    });

    it('investorFlows는 fundamental과 같은 인자 모양으로 넘긴다', () => {
        dispatchHandlerFor('investorFlows')(params, signal, 'ko', quota);
        expect(runInvestorFlowsAction).toHaveBeenCalledWith(
            'AAPL',
            'm1',
            'ko',
            true,
            signal,
            true
        );
    });

    it('briefing은 클라이언트 scope 문자열을 좁히지 않고 액션에 넘긴다', () => {
        dispatchHandlerFor('briefing')(
            { scope: 'anything' },
            signal,
            'ko',
            quota
        );
        expect(submitMarketBriefingAction).toHaveBeenCalledWith(
            'anything',
            signal
        );
    });

    it('macroBriefing은 signal만 넘긴다', () => {
        dispatchHandlerFor('macroBriefing')({}, signal, 'ko', quota);
        expect(submitMacroBriefingAction).toHaveBeenCalledWith(signal);
    });
});

describe('종류 집합', () => {
    it('생성 한도 면제는 종목과 무관한 허브 콘텐츠 셋뿐이다', () => {
        expect([...QUOTA_EXEMPT_TYPES].toSorted()).toEqual([
            'briefing',
            'macroBriefing',
            'marketNewsDigest',
        ]);
    });

    it('프롬프트 조립으로 생성 여부를 판정하는 종류는 overall뿐이다', () => {
        expect([...PROMPT_PROBED_TYPES]).toEqual(['overall']);
    });
});
