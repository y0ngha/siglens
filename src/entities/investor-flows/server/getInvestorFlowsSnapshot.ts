import 'server-only';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY, SECONDS_PER_MINUTE } from '@/shared/config/time';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { isRegShoThresholdDataEnabled } from '@/shared/api/exchange/regShoThresholdDataEnabled';
import type { InvestorFlowsSnapshotWithStatus } from '../model';
import {
    INVESTOR_FLOWS_READINESS_TAG,
    investorFlowsTag,
} from '../lib/investorFlowsTag';
import { getInvestorFlowsDataProvider } from './getInvestorFlowsDataProvider';

/**
 * FMP 일시 오류로 일부가 빈 스냅샷(`degraded`)을 캐시에 두는 시간 — 12시간 동안 "불러오지 못했어요"가 굳지 않게 짧게 둔다.
 * 이 짧은 읽기가 그 렌더의 ISR revalidate를 10분으로 낮춰, 장애 중 degrade 페이지가 10분마다 한 번만 다시 만들어진다.
 */
export const INVESTOR_FLOWS_DEGRADED_SNAPSHOT_TTL_SECONDS =
    10 * SECONDS_PER_MINUTE;

/** 12시간 캐시에 넣지 않을 degrade 스냅샷을 캐시 밖으로 나르는 제어 흐름용 오류(`unstable_cache`는 던진 값을 저장하지 않는다). */
class DegradedSnapshotError extends Error {
    constructor(readonly snapshot: InvestorFlowsSnapshotWithStatus) {
        super('[investor-flows] degraded snapshot — short-lived cache');
    }
}

/**
 * 렌더 경로에서 읽는 수급 스냅샷(`staticSymbolCache` — ISR이 정적 생성 중 DB·Redis·FMP no-store
 * 읽기에 막히지 않게 한다). 데이터가 일 단위로 바뀌므로 12시간.
 *
 * 수집 파이프라인 준비 상태 태그(`INVESTOR_FLOWS_READINESS_TAG`)도 단다 — 부트스트랩 중에 비어 있던 스냅샷이 13F 백필·FINRA
 * 첫 수집이 끝난 뒤에도 12시간 남지 않도록, 그 전환이 모든 종목의 스냅샷(과 이 스냅샷을 렌더 중 읽은 ISR 페이지)을 한 번에
 * 무효화한다. Next는 렌더 중 읽힌 `unstable_cache`의 태그를 페이지 캐시 엔트리에 모은다(`unstable-cache.js`의 `workUnitStore.tags`).
 *
 * 키에 **FINRA·Reg SHO 플래그 상태를 넣는다**(SERVER.md#DC-1): 스냅샷의 공매도·과열 목록 필드가 플래그에 따라 달라지는데
 * 키가 같으면 플래그를 꺼도 TTL 동안 옛(그 데이터 포함) 스냅샷이 남는다 — 라이선스 때문에 끄는 스위치가
 * 즉시 듣지 않는 것은 허용할 수 없다. 반환 형태가 바뀌면 버전을 올린다(`-v2`: FTD·Form 144·증자 공시·13F 옵션·과열 목록 추가,
 * `-v3`: `degraded` 표식, `-v4`: 한국 대량보유 `ratioChangePct`를 같은 보고자의 직전 보고 대비 값으로,
 * `-v5`: Form 144 행에 `formType`을 싣고 90일 집계 창 안의 행은 60행 상한에서 빼서 `proposedSalesCounts`가 정확해지도록).
 * degrade 키는 올리지 않았다 — 10분 수명이라 옛 조립 결과가 곧 사라진다.
 *
 * **일시 degrade는 12시간 캐시에 넣지 않는다.** FMP 429·5xx로 13D/G·유통주식수가 빈 스냅샷(`degraded`)을 12시간 두면 그동안
 * 화면이 "데이터 부족"을 거짓으로 말한다. 그래서 조립 결과가 degrade면 12시간 엔트리를 만들지 않고(던져서 저장을 막는다) 별도
 * 키의 **10분** 엔트리(`INVESTOR_FLOWS_DEGRADED_SNAPSHOT_TTL_SECONDS`)로 돌려준다. 이 짧은 읽기는 그 렌더의 라우트 revalidate를
 * 10분으로 낮춘다(`symbolTabRevalidateClamp.test.ts`의 하향 규칙) — degrade된 페이지만 곧 다시 만들어지게 하려는 **의도된**
 * 하향이다(온전한 렌더는 이 키를 읽지 않는다). 12시간 엔트리가 이미 있으면(만료 뒤 백그라운드 갱신이 degrade로 실패) Next가
 * 옛 온전한 값을 계속 준다.
 *
 * **한계 — 10분 엔트리는 조립을 아끼지 않는다.** 12시간 엔트리가 없는 동안 매 호출이 12시간 fetcher(DB·13D/G·유통주식수
 * 조회)를 먼저 돌린 뒤에야 10분 엔트리로 내려간다. 그래서 ISR 밖의 호출(에이전트 도구 등)은 장애 동안 호출마다 FMP를 다시
 * 친다. 10분 엔트리를 먼저 읽는 순서는 쓰지 않는다: 그 엔트리가 만료되면 `unstable_cache`가 stale 값을 주고 백그라운드로
 * 갱신하는데, "아직 degrade 아님"을 뜻하는 fetcher는 던질 수밖에 없어 갱신이 늘 실패하고 stale degrade 값이 FMP가 돌아온
 * 뒤에도 남는다. 페이지 경로의 부하는 위 ISR 하향으로 묶이고, 도구 호출은 사용자 질문 단위라 양이 작다.
 */
export async function getInvestorFlowsSnapshot(
    symbol: string
): Promise<InvestorFlowsSnapshotWithStatus | null> {
    const upper = symbol.toUpperCase();
    const flags = [
        isFinraShortDataEnabled() ? 'finra-on' : 'finra-off',
        isRegShoThresholdDataEnabled() ? 'regsho-on' : 'regsho-off',
    ];
    const tags = [investorFlowsTag(upper), INVESTOR_FLOWS_READINESS_TAG];
    try {
        return await staticSymbolCache<InvestorFlowsSnapshotWithStatus | null>(
            ['investor-flows:snapshot-v5', ...flags, upper],
            upper,
            async () => {
                const snapshot: InvestorFlowsSnapshotWithStatus | null =
                    await getInvestorFlowsDataProvider().getInvestorFlowsSnapshot(
                        upper
                    );
                if (snapshot !== null && (snapshot.degraded?.length ?? 0) > 0)
                    throw new DegradedSnapshotError(snapshot);
                return snapshot;
            },
            tags,
            SECONDS_PER_HALF_DAY
        );
    } catch (error) {
        if (!(error instanceof DegradedSnapshotError)) throw error;
        const { snapshot } = error;
        return staticSymbolCache<InvestorFlowsSnapshotWithStatus | null>(
            ['investor-flows:snapshot-degraded-v2', ...flags, upper],
            upper,
            async () => snapshot,
            tags,
            INVESTOR_FLOWS_DEGRADED_SNAPSHOT_TTL_SECONDS
        );
    }
}
