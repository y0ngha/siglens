import type { Skill } from '@y0ngha/siglens-core';

/** 프롬프트에 주입할 스킬 목록을 공급하는 포트. 구현은 `api.ts`의 `FileSkillsLoader`. */
export interface SkillsProvider {
    loadSkills(): Promise<Skill[]>;
}
