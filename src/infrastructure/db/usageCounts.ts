import type { UsageCounts, UsageRepository } from '@y0ngha/siglens-core';

// core@0.7.1 UsageCounts는 analysis/chatbot만 선언. usage_action_type enum과 UsageActionType은
// 이미 'premium_model'을 포함하므로 core가 타입을 확장하기 전까지 siglens는 widened 타입 사용.
// Sync obligation: core가 premium_model을 UsageCounts에 추가하면 본 augmentation 제거하고 직접 import.
/** SiglensUsageCounts: core UsageCounts에 premium_model 버킷을 추가한 widened 타입. */
export type SiglensUsageCounts = UsageCounts & {
    /** UTC 일자 기준 premium-model 요청 수. */
    premium_model: number;
};

// 구조적 서브타이핑상 SiglensUsageCounts ⊃ UsageCounts → core consumer도 본 인터페이스 호환.
/** UsageRepository 확장: getUsageToday가 premium_model 포함 SiglensUsageCounts 반환. */
export interface SiglensUsageRepository extends UsageRepository {
    getUsageToday(ipHash: string, now?: Date): Promise<SiglensUsageCounts>;
}
