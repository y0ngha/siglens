import 'server-only';
import {
    submitOptionsAnalysis,
    pollOptionsAnalysis,
    mapExpirationsToSlots,
    DEEPSEEK_V4_FLASH_MODEL,
    type SubmitOptionsAnalysisResult,
    type PollOptionsAnalysisResult,
    type SlotMapping,
} from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot } from './lib/optionsDataCache';

const isSlotMapping = (s: SlotMapping | null): s is SlotMapping => s !== null;

/**
 * SEO pre-warm 전용 options submit (spec 2026-07-24 §4 seam, Task 7).
 * `submitOptionsAnalysisAction`의 비봇 경로를 요청-컨텍스트 없이 재현한다.
 * 차이는 skipEnqueueIfMiss:false와 force 뿐.
 *
 * 만기(`expirationDate`) 기본값은 `OptionsPageClient.tsx`의 초기 client
 * mount 로직을 그대로 재현한다:
 * `useState<OptionsExpirationSelector>(() => slots.find(isSlotMapping)?.expirationDate ?? 'all')`
 * (widgets/options/OptionsPageClient.tsx:58-61). `slots`는 `[symbol]/options/page.tsx`가
 * `mapExpirationsToSlots(expirations, new Date())`로 만든 것과 동일하게, 이
 * 함수도 스냅샷의 만기 목록을 같은 헬퍼에 통과시켜 재현한다 — `mapExpirationsToSlots`가
 * 반환하는 첫 non-null 슬롯(가장 가까운 만기, `EXPIRATION_SLOTS`의 `0D` 우선)을
 * 선택하고, 매핑되는 슬롯이 하나도 없으면 `'all'`로 폴백한다. 이렇게 해야
 * 익명 방문자의 initial page mount가 만드는 cache key와 정합한다.
 *
 * modelId는 익명/free 방문자가 실제로 보내는 기본값(`DEEPSEEK_V4_FLASH_MODEL`)을
 * 명시 전달한다 — core의 options submit 옵션은 modelId를 그대로 캐시 키에
 * 쓰고 내부 fallback이 없다.
 *
 * ⚠️ 요청 헤더 읽기·세션 사용자 조회·봇 판별·쿠키 접근 금지 — cron의
 * after() 컨텍스트에서 실행되며 React 요청 스코프가 없다.
 */
export async function prewarmOptions(
    symbol: string,
    companyName: string,
    force: boolean
): Promise<SubmitOptionsAnalysisResult | null> {
    const snapshot = await fetchOptionsSnapshot(symbol);
    // 옵션 데이터가 없으면(NoChains) 스냅샷 생성 대상이 아니다 — submit 자체를 스킵한다.
    if (snapshot === null) return null;

    const expirations = snapshot.chains.map(c => c.expirationDate);
    const slots = mapExpirationsToSlots(expirations, new Date());
    const expirationDate = slots.find(isSlotMapping)?.expirationDate ?? 'all';

    return submitOptionsAnalysis({
        symbol,
        companyName,
        expirationDate,
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        snapshot,
        tier: 'free',
        reasoning: false,
        skipEnqueueIfMiss: false,
        ...(force ? { force: true } : {}),
    });
}

/**
 * FIX Z(감사) — `prewarmOptions`와 짝을 이루는 pre-warm 전용 poll seam.
 * options의 poll은 request-context에 의존하는 별도 액션이 없다(현재
 * `OptionsPageClient`가 클라 훅으로 직접 polling) — 신규 server-only seam.
 */
export async function prewarmPollOptions(
    jobId: string
): Promise<PollOptionsAnalysisResult> {
    return pollOptionsAnalysis(jobId);
}
