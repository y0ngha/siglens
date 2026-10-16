import 'server-only';
import { revalidateTag } from 'next/cache';
import { INVESTOR_FLOWS_READINESS_TAG } from '@/entities/investor-flows/lib/investorFlowsTag';

/**
 * 수급 탭의 "수집 중" 안내가 의존하는 준비 상태 캐시를 무효화한다. 13F 초기 백필이 끝났거나 FINRA 첫 파일이 저장된 실행이
 * 한 번 부른다 — 안 부르면 안내가 캐시 TTL(12시간)만큼 더 남는다.
 */
export function revalidateFlowsReadiness(): void {
    revalidateTag(INVESTOR_FLOWS_READINESS_TAG, 'max');
}
