import type { Skill, SkillShowcaseItem } from '@y0ngha/siglens-core';

/**
 * `Skill[]` → `SkillShowcaseItem[]` 프로젝션. RSC 경계에서 **반드시** 거쳐야 한다.
 *
 * `SkillsShowcase`의 prop 타입은 이미
 * `SkillShowcaseItem = Pick<Skill,'name'|'description'|'type'|'confidenceWeight'>`인데,
 * 구조적 타이핑이 상위집합인 `Skill`을 그대로 통과시킨다. 그래서 `skill.content` —
 * 스킬 81개의 LLM 프롬프트 본문 전체, 합계 586KB — 가 아무도 읽지 않은 채 경계를 넘어
 * **모든 홈 방문자에게** 배송됐다(2026-08 실측: flight의 79%, 홈 brotli 149.1KB).
 * 프로젝션 후 23.3KB(−84.4%), 크롤러 가시 텍스트는 11,895자로 동일.
 *
 * 페이지 안의 인라인 `.map`이 아니라 별도 함수인 이유: 인라인이면 되돌려도
 * `tsc`도 테스트도 못 잡는다(구조적 타이핑이 통과시키고, 페이지 테스트는
 * `loadSkills`를 빈 배열로 mock해 `.map`이 무동작이 된다). 여기 있으면 단위
 * 테스트가 "content가 빠졌다"를 직접 단언할 수 있다.
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
