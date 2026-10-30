import type { Skill, SkillShowcaseItem } from '@y0ngha/siglens-core';

/**
 * `Skill[]` → `SkillShowcaseItem[]` 프로젝션. RSC 경계에서 **반드시** 거쳐야 한다.
 *
 * `SkillsShowcase`의 prop 타입은 `SkillShowcaseItem`
 * (`Pick<Skill,'name'|'description'|'type'|'confidenceWeight'>`)인데, 구조적 타이핑이
 * 상위집합인 `Skill`을 그대로 통과시킨다. 그러면 `skill.content`(스킬 전체의 LLM 프롬프트
 * 본문, 합계 수백 KB)가 아무도 읽지 않은 채 경계를 넘어 모든 홈 방문자에게 직렬화된다.
 *
 * 페이지 안의 인라인 `.map`이 아니라 별도 함수인 이유: 인라인이면 되돌려도 `tsc`도
 * 테스트도 못 잡는다(구조적 타이핑이 통과시키고, 페이지 테스트는 `loadSkills`를 빈
 * 배열로 mock해 `.map`이 무동작이 된다). 여기 있으면 단위 테스트가 "content가
 * 빠졌다"를 직접 단언할 수 있다.
 */
export function toSkillShowcaseItems(
    skills: readonly Skill[]
): SkillShowcaseItem[] {
    return skills.map(({ name, description, type, confidenceWeight }) => ({
        name,
        description,
        type,
        confidenceWeight,
    }));
}
