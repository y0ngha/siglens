import { isSignalHubIndexable } from '@/entities/signal-history/lib/signalHubs';
import type { SignalHubData } from './loadSignalHub';

/**
 * 이 데이터로 그린 페이지를 색인하는가 — 메타데이터(robots)와 본문(구조화데이터)이 둘 다 이 함수를 부른다.
 * 기록을 못 읽었으면(degraded) 빈 목록과 같은 이유로 색인하지 않는다. 목록은 시장마다 상한으로 잘리므로
 * 줄 수가 아니라 전체 종목 수(`counts`)로 판정한다 — 사이트맵이 집계(`recentCountsByType`)에 같은 기준
 * (`isSignalHubIndexable`)을 적용하는 것과 같은 수다.
 */
export function isSignalHubDataIndexable(data: SignalHubData): boolean {
    return (
        !data.degraded && isSignalHubIndexable(data.counts.us + data.counts.kr)
    );
}
