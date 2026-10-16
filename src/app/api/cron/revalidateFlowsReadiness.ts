import 'server-only';
import { revalidateTag } from 'next/cache';
import { INVESTOR_FLOWS_READINESS_TAG } from '@/entities/investor-flows/lib/investorFlowsTag';

/**
 * 수급 탭의 "수집 중" 안내가 의존하는 준비 상태 캐시를 무효화한다. 한 번뿐인 전환을 만든 실행이 부른다 — 13F 초기 백필 완료,
 * FINRA 첫 파일, SEC FTD 첫 파일, Reg SHO 첫 목록, Form 144·증자 공시 커서가 최근까지 따라잡음. 안 부르면 안내가 캐시
 * TTL(12시간)만큼 더 남는다.
 */
export function revalidateFlowsReadiness(): void {
    revalidateTag(INVESTOR_FLOWS_READINESS_TAG, 'max');
}
