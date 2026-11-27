import {
    GUIDE_PATH_BY_SKILL_NAME,
    GUIDE_PATH_BY_TRIGGER,
    PATTERN_ID_BY_SKILL_NAME,
} from '@/shared/config/guideLinks.generated';

/**
 * 스킬(또는 탐지 id)에 대응하는 차트 가이드 경로. 없으면 `null`.
 *
 * 스킬 이름이 정본이고, 이름이 맵에 없을 때만 탐지 id(`patternName` 등)로 한 번 더 찾는다.
 * `Object.hasOwn`으로 읽어 `constructor`·`toString` 같은 프로토타입 키가 경로로 새지 않게 한다.
 */
export function guidePathForSkill(
    skillName: string,
    triggerId?: string
): string | null {
    if (Object.hasOwn(GUIDE_PATH_BY_SKILL_NAME, skillName)) {
        return GUIDE_PATH_BY_SKILL_NAME[skillName] ?? null;
    }
    if (
        triggerId !== undefined &&
        Object.hasOwn(GUIDE_PATH_BY_TRIGGER, triggerId)
    ) {
        return GUIDE_PATH_BY_TRIGGER[triggerId] ?? null;
    }
    return null;
}

/**
 * 차트 패턴 스킬 이름(카드의 `skillName`)에 대응하는 정본 패턴 id. 카탈로그에 없으면 `null`.
 * `Object.hasOwn`으로 읽어 프로토타입 키가 id로 새지 않게 한다.
 */
export function patternIdForSkill(skillName: string): string | null {
    return Object.hasOwn(PATTERN_ID_BY_SKILL_NAME, skillName)
        ? (PATTERN_ID_BY_SKILL_NAME[skillName] ?? null)
        : null;
}
