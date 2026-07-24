import 'server-only';
import {
    submitAnalysis,
    type SubmitAnalysisGatedResult,
} from '@y0ngha/siglens-core';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';

/**
 * SEO pre-warm 전용 technical submit (spec 2026-07-24 §4 seam).
 * 익명 free 방문자의 submitAnalysisAction 익명 브랜치와 동일한 core 호출을
 * 재현한다(캐시 키 5축 정합: model default / tier free / reasoning false /
 * no bucket / 동일 core fingerprint). 차이는 skipEnqueueIfMiss:false와 force 뿐.
 * ⚠️ request-context 호출(요청 헤더 읽기·세션 사용자 조회·봇 판별·쿠키 접근)
 * 금지 — cron의 after() 컨텍스트에서 실행되며 React 요청 스코프가 없다.
 */
export async function prewarmTechnical(
    symbol: string,
    companyName: string,
    fmpSymbol: string | undefined,
    force: boolean
): Promise<SubmitAnalysisGatedResult> {
    const marketProfile = await resolveMarketProfile(symbol);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const marketDataProvider = getCachedMarketDataProvider(
        sessionSpecFor(marketProfile)
    );
    return submitAnalysis(symbol, companyName, '1Day', force, fmpSymbol, {
        skipEnqueueIfMiss: false,
        marketDataProvider,
        assetClass,
        tierContext: { userId: null, tier: 'free' },
        reasoning: false,
        positionBucket: undefined,
    });
}
