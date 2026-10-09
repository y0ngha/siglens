import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    GUIDE_COVERED_SKILL_DIRS,
    GUIDE_EXCLUDED_SKILL_DIRS,
    GUIDE_LINKS_OUTPUT,
    GUIDE_PENDING_SKILLS,
    generateGuideLinks,
    loadGuideMetas,
    loadSkillMetas,
} from '../../../scripts/generate-guide-links';

/**
 * **차트 가이드 ↔ 스킬 동기화 가드.**
 *
 * 스킬→가이드 링크 맵(`guideLinks.generated.ts`)은 생성물이고, 가이드 항목은 스킬 파일을
 * 설명한다. 둘이 표류하면 홈·분석 패널의 "뜻 보기" 링크가 조용히 사라지거나 죽은 링크가 된다.
 * 스킬 추가 PR을 막지 않도록 아직 가이드가 없는 스킬은 `GUIDE_PENDING_SKILLS`에 올려 둔다.
 */
const SKILLS_DIR = path.resolve(__dirname, '../../../skills');

describe('차트 가이드 커버리지', () => {
    it('생성물이 최신이다 — 어긋나면 yarn guide:links', async () => {
        const { source } = await generateGuideLinks();

        expect(readFileSync(GUIDE_LINKS_OUTPUT, 'utf-8')).toBe(source);
    });

    it('skills/ 아래 모든 디렉터리는 가이드 대상이거나 제외 목록에 있다', () => {
        const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
        const classified: readonly string[] = [
            ...GUIDE_COVERED_SKILL_DIRS,
            ...GUIDE_EXCLUDED_SKILL_DIRS,
        ];

        expect(dirs.filter(dir => !classified.includes(dir))).toEqual([]);
    });

    it('가이드 대상 스킬은 모두 어떤 항목의 skills에 있거나 GUIDE_PENDING_SKILLS에 있다', async () => {
        const [guides, skills] = await Promise.all([
            loadGuideMetas(),
            loadSkillMetas(),
        ]);
        const covered = new Set(guides.flatMap(g => g.skills ?? [g.slug]));

        const uncovered = skills
            .map(skill => skill.basename)
            .filter(
                name =>
                    !covered.has(name) && !GUIDE_PENDING_SKILLS.includes(name)
            );

        expect(uncovered).toEqual([]);
    });

    it('GUIDE_PENDING_SKILLS에는 실제로 가이드가 없는 스킬만 남는다', async () => {
        const [guides, skills] = await Promise.all([
            loadGuideMetas(),
            loadSkillMetas(),
        ]);
        const covered = new Set(guides.flatMap(g => g.skills ?? [g.slug]));
        const existing = new Set(skills.map(skill => skill.basename));

        const stale = GUIDE_PENDING_SKILLS.filter(
            name => covered.has(name) || !existing.has(name)
        );

        expect(stale).toEqual([]);
    });

    it('가이드 항목이 가리키는 스킬 파일이 모두 존재한다', async () => {
        // buildGuideLinks가 명시한 skills의 부재를 던진다.
        await expect(generateGuideLinks()).resolves.toBeDefined();
    });
});
