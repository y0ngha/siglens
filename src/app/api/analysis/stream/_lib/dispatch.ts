import type { ModelId } from '@y0ngha/siglens-core';
import { runCongressTrendAction } from '@/entities/analysis/actions/runCongressTrendAction';
import { runFinancialsAnalysisAction } from '@/entities/analysis/actions/runFinancialsAnalysisAction';
import { runFundamentalAnalysisAction } from '@/entities/analysis/actions/runFundamentalAnalysisAction';
import { runInvestorFlowsAction } from '@/entities/analysis/actions/runInvestorFlowsAction';
import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { submitMarketNewsDigestAction } from '@/entities/market-news/actions/submitMarketNewsDigestAction';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions/submitMarketBriefingAction';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions/submitNewsAnalysisAction';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions/optionsActions';
import type { Locale } from '@/shared/i18n/locales';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { runOverallDispatch } from './overallDispatch';
import type {
    AnalysisType,
    DispatchedAnalysisType,
    DispatchParams,
    DispatchQuotaContext,
} from './types';

/**
 * `technical`이 아닌 종류별 핸들러 표. 원시 `params`와 마감 `AbortSignal`을 받아 Promise를 돌려주고,
 * 그 Promise가 `heartbeatStream`으로 흘러 LLM 왕복 내내 SSE 연결을 살려 둔다. 각 항목은 인증·tier/BYOK
 * 게이트·E2E 단락·데이터 조회를 이미 가진 entity 액션에 위임한다 — 로직을 여기서 복제하지 않는다.
 * 받는 `signal`은 `withDeadline`이 소유한 **마감** 컨트롤러이지 `request.signal`이 아니다(클라이언트별
 * signal을 core에 넘기면 안 되는 이유는 `withDeadline` JSDoc).
 *
 * ⚠️ `locale`은 **반드시 여기로 흘러야 한다.** 액션이 돌려주는 게이트 오류
 * (`{ status: 'error', error: { code, message } }`)는 훅이 그대로 화면에 던지는 사용자 문구인데,
 * `/api/*`는 next-intl matcher에서 제외돼 있어 액션이 스스로 로케일을 알아낼 방법이 없다
 * (`byokGate.ts`의 `gateMessage` JSDoc).
 */
const DISPATCH: Record<
    DispatchedAnalysisType,
    (
        params: DispatchParams,
        signal: AbortSignal | undefined,
        locale: Locale,
        quota: DispatchQuotaContext
    ) => Promise<unknown>
> = {
    overall: runOverallDispatch,

    fundamental: (params, signal, locale, quota) =>
        runFundamentalAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    financials: (params, signal, locale, quota) =>
        runFinancialsAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    news: (params, signal, locale, quota) =>
        submitNewsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    marketNewsDigest: (params, signal, locale) =>
        submitMarketNewsDigestAction(
            params.category as NewsFeedCategoryId,
            locale,
            signal
        ),

    options: (params, signal, locale, quota) =>
        submitOptionsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.expirationDate as OptionsExpirationSelector,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    congress: (params, signal, locale, quota) =>
        runCongressTrendAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    investorFlows: (params, signal, locale, quota) =>
        runInvestorFlowsAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    // scope는 클라이언트가 보낸 문자열이다. 여기서 좁히지 않고 그대로 넘기는 것은 의도된 설계다 —
    // 액션이 `isPageDashboardScopeId`(허브 페이지가 있는 시장만)로 검증하고 그 밖의 값이면 에러를
    // 돌려준다(라우트와 액션 양쪽에 검증을 두면 규칙이 갈린다).
    briefing: (params, signal) =>
        submitMarketBriefingAction(params.scope as string, signal),

    // 게이트를 쓰지 않아 사용자 문구를 만들지 않는다 — 로케일이 필요 없다.
    macroBriefing: (_params, signal) => submitMacroBriefingAction(signal),
};

/**
 * 이 라우트가 위임하는 종류인지. `Object.hasOwn`으로 본다: `type`이 'toString' 같은 프로토타입
 * 멤버면 표 인덱싱이 상속된 함수를 돌려줘 핸들러 존재 검사를 통과한다 — 400이어야 할 입력이 500이 된다.
 */
export function isDispatchedType(
    type: unknown
): type is DispatchedAnalysisType {
    return typeof type === 'string' && Object.hasOwn(DISPATCH, type);
}

/** 종류에 맞는 핸들러. `isDispatchedType`을 통과한 값만 받는다. */
export function dispatchHandlerFor(
    type: DispatchedAnalysisType
): (typeof DISPATCH)[DispatchedAnalysisType] {
    return DISPATCH[type];
}

/**
 * 생성 한도를 걸지 않는 종류 — 종목과 무관한 허브 콘텐츠다.
 *
 * 캐시 키가 클라이언트 입력으로 늘어나지 않는다(브리핑 scope·다이제스트 카테고리는 액션이 고정 목록으로
 * 검증하고, 매크로 브리핑은 입력이 없다). 그래서 이 경로로는 공격자가 생성 수를 키울 수 없고, 막으면
 * 정상 방문자의 허브 화면만 비게 된다. 방문자 재생성 빈도 자체는 각 액션의 쿨다운이 담당한다.
 */
export const QUOTA_EXEMPT_TYPES: ReadonlySet<AnalysisType> = new Set([
    'briefing',
    'macroBriefing',
    'marketNewsDigest',
]);

/**
 * core `onPromptAssembled`로 생성 여부를 정확히 아는 디스패치 종류. 나머지는 결과 상태로
 * 근사한다(`DONE_STATUS_PROBE` JSDoc).
 */
export const PROMPT_PROBED_TYPES: ReadonlySet<AnalysisType> = new Set([
    'overall',
]);

/*
 * 의도적으로 여기 없는 것: `newsCard` / `economicEvent` / `indicatorTranslation`.
 *
 * 이 셋은 게이팅 액션이 없어 core를 직접 호출해야 하는데, 이 라우트는 인증 없는 공개 POST다
 * (`proxy.ts`가 `/api`를 미들웨어 매처에서 제외). 브라우저 호출자도 없으므로 노출할 이유가 없고,
 * 노출하면 익명 루프가 서버 키로 LLM 비용을 태우는 경로가 된다 — 특히 `newsCard`는 요청 본문의
 * `NewsItem`이 그대로 프롬프트에 들어간다. 서버 내부(크론·시딩)는 브라우저 연결이 없으므로 SSE가
 * 필요 없고 core `run*`을 직접 `await`하면 된다. 브라우저에서 필요해지면 먼저 게이팅 액션을 만들고
 * 그 액션을 여기에 등록할 것.
 */
