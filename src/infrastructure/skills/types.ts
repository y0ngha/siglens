import type { Skill } from '@y0ngha/siglens-core';

export interface SkillsProvider {
    loadSkills(): Promise<Skill[]>;
}
