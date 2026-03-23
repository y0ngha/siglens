import type { Skill } from '@/domain/types';

export interface SkillsProvider {
    loadSkills(): Promise<Skill[]>;
}
