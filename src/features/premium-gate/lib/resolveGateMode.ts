/**
 * 모델 선택 게이트 판정 — 어떤 모달을 띄울지(또는 통과시킬지)만 정하는 순수 함수.
 *
 * 등급 분류(`getModelAccess`)와 BYOK 요구 규칙은 siglens-core가 소유한다. 이 파일은 그
 * 결과를 클라이언트 모달 종류(`GateMode`)로 옮기는 어댑터일 뿐이며, 서버의
 * `resolveTierAndByok`(`shared/lib/byokGate.ts`)와 같은 순서로 판정한다.
 */
import type { LlmProvider, ModelAccess, UserTier } from '@y0ngha/siglens-core';
import type { GateMode } from '@/shared/lib/types';

/** 게이트가 걸릴 수 있는 등급. free는 누구에게나 열려 있어 판정 대상이 아니다. */
export type GatedModelAccess = Exclude<ModelAccess, 'free'>;

/** {@link resolveGateMode}의 입력. */
export interface ResolveGateModeInput {
    /** 고른 모델의 등급. */
    access: GatedModelAccess;
    /** 고른 모델을 호출하는 프로바이더. */
    provider: LlmProvider;
    /** 로그인한 회원, 또는 비회원/아직 모름이면 `null`·`undefined`. */
    user: { tier: UserTier } | null | undefined;
    /** 회원이 API 키를 등록해 둔 프로바이더 목록. */
    registeredProviders: readonly LlmProvider[];
}

/**
 * 잠긴 모델을 골랐을 때 띄울 게이트 모달 종류를 정한다.
 *
 * - 비회원(또는 회원 여부를 아직 모름)은 등급과 무관하게 `auth`.
 * - member 등급은 로그인만으로 열린다 — 서버 키가 요금을 낸다.
 * - byok 등급은 pro가 아니면 해당 프로바이더 키가 있어야 한다. 없으면 `byok`.
 *
 * @returns 띄울 모달 종류, 또는 통과면 `null`.
 */
export function resolveGateMode({
    access,
    provider,
    user,
    registeredProviders,
}: ResolveGateModeInput): GateMode | null {
    if (!user) return 'auth';
    if (access !== 'byok' || user.tier === 'pro') return null;
    return registeredProviders.includes(provider) ? null : 'byok';
}
