import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { SkillsShowcase } from './SkillsShowcase';

export async function SkillsShowcaseServer() {
    const loader = new FileSkillsLoader();
    const skills = await loader.loadSkills();
    return <SkillsShowcase skills={skills} />;
}
