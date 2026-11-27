import 'server-only';
import type { MarketDataProvider } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';
import { createStartSpacer } from '@/shared/lib/startSpacer';
import { CachedMarketDataProvider } from './CachedMarketDataProvider';
import {
    FMP_PROVIDER_OPTIONS,
    getCachedMarketDataProvider,
} from './getCachedMarketDataProvider';
import { marketDataProviderFor } from './getMarketDataProvider';
import { PacedMarketProvider } from './PacedMarketProvider';
import { sessionSpecForDashboardScope } from './sessionSpecFor';

/** 신호 기록기가 읽는 시장. 크립토는 "세션 마감 뒤"가 없어 기록하지 않는다. */
export type SignalScanMarketScope = Extract<DashboardScopeId, 'us' | 'kr'>;

/**
 * 신호 기록기의 업스트림 호출 시작 간격(ms). FMP는 분당 300건 플랜에서 200건(300ms)만 써 나머지 100건을
 * 사용자 요청에 남긴다. yahoo는 공식 한도가 없어 분당 240건(250ms)으로 조심스럽게 둔다. 기록기는 같은 잡에서
 * 배치 앞에 돌아 배치의 FMP 호출과 겹치지 않는다.
 */
export const SIGNAL_SCAN_PACING_MS: Readonly<
    Record<SignalScanMarketScope, number>
> = { us: 300, kr: 250 };

/** 기록기가 쓰는 provider와 그 업스트림 호출 수 읽기. */
export interface SignalScanMarketData {
    readonly provider: MarketDataProvider;
    /** 이 provider가 지금까지 업스트림으로 내보낸 호출 수(실행 앞뒤 차이로 한 실행의 호출 수를 읽는다). */
    upstreamCalls(): number;
}

/**
 * 기록기 provider의 히스토리 L1 엔트리 수. 기록기는 종목마다 일봉을 한 번씩만 읽고 지나가서 큰 L1은 적중 없이
 * 힙만 차지한다(128개 약 14MB × 시장 2개). 16개(약 1.8MB)면 한 종목 처리 중 연달아 읽는 몫은 덮는다.
 * 요청 경로의 공유 provider L1(128개)은 그대로다.
 */
export const SIGNAL_SCAN_HISTORY_MEMORY_ENTRIES = 16;

const instances = new Map<SignalScanMarketScope, SignalScanMarketData>();

function createSignalScanMarketData(
    scope: SignalScanMarketScope
): SignalScanMarketData {
    const session = sessionSpecForDashboardScope(scope);
    const paced = new PacedMarketProvider(
        marketDataProviderFor(scope),
        createStartSpacer(SIGNAL_SCAN_PACING_MS[scope])
    );
    return {
        // 공유 provider(`getCachedMarketDataProvider`)와 같은 옵션·같은 Redis 키라 종목 페이지가 데운 일봉을
        // 그대로 쓰고, 기록기가 데운 키도 종목 페이지가 쓴다. L1(메모리)만 따로 작게 둔다 — 기록기가 수백
        // 종목을 훑어도 요청 경로의 L1(128개)을 밀어내지 않고, 힙도 늘리지 않게.
        provider: new CachedMarketDataProvider(paced, session, {
            ...(scope === 'us' ? FMP_PROVIDER_OPTIONS : {}),
            historyMemoryMaxEntries: SIGNAL_SCAN_HISTORY_MEMORY_ENTRIES,
        }),
        upstreamCalls: () => paced.upstreamCalls(),
    };
}

/**
 * 신호 기록기 전용 provider(시장별 싱글톤). 캐시 provider 아래에 속도 제한을 둔 데코레이터를 끼워,
 * 캐시 적중은 기다리지 않고 실제 업스트림 호출만 `SIGNAL_SCAN_PACING_MS` 간격으로 시작한다.
 *
 * E2E는 공유 provider(Fake)를 그대로 쓴다 — Redis도 업스트림도 없어 속도 제한이 무의미하다.
 */
export function getSignalScanMarketDataProvider(
    scope: SignalScanMarketScope
): SignalScanMarketData {
    if (isE2E()) {
        return {
            provider: getCachedMarketDataProvider(
                sessionSpecForDashboardScope(scope)
            ),
            upstreamCalls: () => 0,
        };
    }
    const existing = instances.get(scope);
    if (existing !== undefined) return existing;
    const created = createSignalScanMarketData(scope);
    instances.set(scope, created);
    return created;
}
