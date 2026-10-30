import 'server-only';
import {
    runOptionsAnalysis,
    DEEPSEEK_V4_1_FLASH_MODEL,
    type RunOptionsAnalysisResult,
} from '@y0ngha/siglens-core';
import { PREWARM_PROVIDER_FALLBACK } from '@/shared/config/prewarm';
import { resolveSnapshotSlots } from './lib/optionsSlots';
import { fetchOptionsSnapshot } from './server/optionsDataCache';

/**
 * SEO pre-warm 전용 options submit. `submitOptionsAnalysisAction`의 기본(`cacheOnly`가 아닌)
 * 경로를 요청 컨텍스트 없이 재현한다. 차이는 `skipEnqueueIfMiss: false`와 `force`뿐이다.
 *
 * 만기(`expirationDate`) 기본값은 `OptionsPageClient`의 초기 마운트와 같다 — 스냅샷의 첫
 * 슬롯 만기(가장 가까운 만기, `0D` 우선), 매핑되는 슬롯이 없으면 `'all'`. 이렇게 해야 익명
 * 방문자의 첫 마운트가 만드는 캐시 키와 맞는다. 슬롯은 `resolveSnapshotSlots`로 구해
 * 페이지가 그리는 첫 chip과 같은 만기를 보장한다.
 *
 * modelId는 익명·free 방문자가 실제로 보내는 기본값(`DEEPSEEK_V4_1_FLASH_MODEL`)을 명시
 * 전달한다 — core의 options submit은 modelId를 그대로 캐시 키에 쓰고 내부 fallback이 없다.
 *
 * 요청 헤더·세션 사용자·봇 판별·쿠키 접근 금지 — cron의 `after()` 컨텍스트에서 실행되며
 * React 요청 스코프가 없다. 옵션 데이터가 없는 종목(스냅샷 `null`)이면 submit을 건너뛰고
 * `null`을 돌려준다.
 */
export async function prewarmOptions(
    symbol: string,
    companyName: string,
    force: boolean
): Promise<RunOptionsAnalysisResult | null> {
    const snapshot = await fetchOptionsSnapshot(symbol);
    if (snapshot === null) return null;

    const expirationDate =
        resolveSnapshotSlots(snapshot, new Date())[0]?.expirationDate ?? 'all';

    return runOptionsAnalysis({
        symbol,
        companyName,
        expirationDate,
        modelId: DEEPSEEK_V4_1_FLASH_MODEL,
        snapshot,
        tier: 'free',
        reasoning: false,
        providerFallback: PREWARM_PROVIDER_FALLBACK,
        skipEnqueueIfMiss: false,
        ...(force ? { force: true } : {}),
    });
}
