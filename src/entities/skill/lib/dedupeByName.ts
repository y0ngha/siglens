import type { Skill } from '@y0ngha/siglens-core';

/**
 * `name`이 이미 나온 스킬을 버린다(첫 등장 우선). core 로더의 `dedupeByName`과 같은 규칙이다 —
 * 프롬프트 경로는 core가 먹이지만 `FileSkillsLoader`는 백테스트 스크립트처럼 직접 쓰이기도 해서,
 * `name`이 같은 `.md` 두 개가 같은 스킬을 두 번 주입하거나 선택 결과가 순서에 의존하면 안 된다.
 */
export const dedupeByName = (skills: readonly Skill[]): Skill[] => {
    const seen = new Set<string>();
    return skills.filter(skill => {
        if (seen.has(skill.name)) return false;
        seen.add(skill.name);
        return true;
    });
};
