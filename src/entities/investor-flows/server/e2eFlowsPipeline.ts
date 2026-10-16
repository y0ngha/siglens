import { isE2E } from '@/shared/api/e2eEnv';

/**
 * E2E에서 수집 중 상태를 재현하는 스위치. `E2E_TEST=1`**이고** `E2E_FLOWS_PIPELINE=collecting`일 때만 참이다 — 운영에서
 * 이 env가 실수로 설정돼도 아무 효과가 없다(`isE2E()`가 거짓이면 항상 거짓). 켜지면 준비 상태가 `collecting`이고
 * (`getInvestorFlowsPipelineReadiness`) 가짜 공급자도 같은 스위치로 13F·FINRA 행이 없는 스냅샷을 준다
 * (`FakeInvestorFlowsDataProvider`) — 실제 파이프라인이 비어 있을 때의 모습과 같다.
 */
export function isE2EFlowsPipelineCollecting(): boolean {
    return isE2E() && process.env.E2E_FLOWS_PIPELINE === 'collecting';
}
