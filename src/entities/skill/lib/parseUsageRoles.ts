import type { SkillUsageRole } from '@y0ngha/siglens-core';

/**
 * 사용 역할의 정규 순서 — siglens-core confidenceLevel 모듈의 `USAGE_ROLE_ORDER`와 같다.
 * 파서는 frontmatter 배열을 이 순서로 재정렬해, 작성 순서와 무관하게 소비자가 결정적인
 * 순서를 보게 한다(예: `[confirmation, signal]` → `['signal', 'confirmation']`).
 *
 * 미러 계약: core의 `USAGE_ROLE_ORDER`와 항상 같아야 한다. core에 역할이 늘면 여기도 추가한다
 * (`satisfies`와 아래 완전성 가드가 컴파일 타임에 SkillUsageRole 멤버십을 강제한다).
 */
const USAGE_ROLE_ORDER = [
    'signal',
    'confirmation',
    'regime',
    'measurement',
    'risk',
] as const satisfies readonly SkillUsageRole[];

// 완전성 가드: core에 새 SkillUsageRole이 생기고 위에 반영되지 않으면
// MissingUsageRole이 `never`가 아닌 유니온이 되어 tsc가 여기서 실패한다.
type MissingUsageRole = Exclude<
    SkillUsageRole,
    (typeof USAGE_ROLE_ORDER)[number]
>;
const _usageRolesAreExhaustive: MissingUsageRole extends never ? true : never =
    true;
void _usageRolesAreExhaustive;

const USAGE_ROLE_SET: ReadonlySet<string> = new Set(USAGE_ROLE_ORDER);

/**
 * `usage_roles` frontmatter 값을 검증·정규화한다.
 *
 * 다음이면 `undefined`(fail-open)를 돌려준다.
 * - `raw`가 배열이 아니거나 빈 배열
 * - 원소가 문자열이 아니거나, 알 수 없는 역할이거나, 중복
 *
 * 유효하면 `USAGE_ROLE_ORDER` 순서로 재정렬해 항상 결정적인 배열을 돌려준다.
 *
 * siglens-core infrastructure/skills/loader의 `parseUsageRoles`와 같은 규칙이다. 두 구현을
 * 함께 맞춘다.
 */
export const parseUsageRoles = (raw: unknown): SkillUsageRole[] | undefined => {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const seen = new Set<string>();
    for (const r of raw) {
        if (typeof r !== 'string') return undefined;
        if (seen.has(r)) return undefined;
        if (!USAGE_ROLE_SET.has(r)) return undefined;
        seen.add(r);
    }
    return USAGE_ROLE_ORDER.filter(r => seen.has(r));
};
