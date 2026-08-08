/**
 * core `run*` 함수의 재노출 지점.
 *
 * SSE 라우트가 core를 직접 import하지 않고 이 파일을 거치는 이유는 테스트 때문이다 —
 * 라우트 테스트는 `'../runAnalysisBridge'` 하나만 mock하면 되고, `@y0ngha/siglens-core`
 * 전체를 mock해서 다른 모든 core export까지 함께 무력화하는 일을 피할 수 있다.
 *
 * 타입은 core가 소유한다. 여기서 재선언하면 core 시그니처가 바뀔 때 조용히 어긋난다.
 */

export {
    runAnalysis,
    runBriefing,
    runNewsAnalysis,
    runNewsCardAnalysis,
    runMarketNewsDigest,
    runOverallAnalysis,
    runCongressTrend,
    runFundamentalAnalysis,
    runFinancialsAnalysis,
    runOptionsAnalysis,
    runMacroBriefing,
    runEconomicEventAnalysis,
    runIndicatorTranslation,
} from '@y0ngha/siglens-core';

export type { SubmitAnalysisOptions } from '@y0ngha/siglens-core';
