import 'server-only';
import { revalidateTag } from 'next/cache';
import { investorFlowsTag } from '@/entities/investor-flows/lib/investorFlowsTag';

/**
 * 수급 스냅샷 캐시(`staticSymbolCache`)의 종목별 태그를 무효화한다. 개수 상한은 호출부(수집 오케스트레이터)가
 * 건다 — 여기는 받은 만큼만 처리한다.
 */
export function revalidateSymbols(symbols: readonly string[]): void {
    for (const symbol of symbols) {
        revalidateTag(investorFlowsTag(symbol), 'max');
    }
}
