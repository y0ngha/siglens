import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import enMessages from '../../../../messages/en.json';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import {
    useSkillDescription,
    toSkillDescriptionKey,
} from '@/shared/i18n/skillDescription';

const SKILLS_DIR = join(process.cwd(), 'skills');

function collectMarkdown(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) collectMarkdown(full, acc);
        else if (name.endsWith('.md')) acc.push(full);
    }
    return acc;
}

/** front-matter `description:` 중 **한국어가 든 것**만. 영문 스킬 7종은 이미 영어다. */
const koreanSkillDescriptions = [
    ...new Set(
        collectMarkdown(SKILLS_DIR)
            .map(
                file =>
                    /^description:\s*(.+)$/m.exec(
                        readFileSync(file, 'utf8')
                    )?.[1]
            )
            .filter((desc): desc is string => !!desc && /[가-힣]/.test(desc))
    ),
];

function DescriptionProbe({ description }: { description: string }) {
    const resolveDescription = useSkillDescription();
    return (
        <span data-testid="description">{resolveDescription(description)}</span>
    );
}

/**
 * **skills 디렉터리 ↔ `shared.skillDescription` 카탈로그 완전성.**
 *
 * `useSkillLabel — skills ↔ 카탈로그 완전성`(`skillLabel.test.tsx`)과 동일한
 * 이유·동일한 형태 — `useSkillDescription`이 `useSkillLabel`을 미러링한다.
 * 소스는 카탈로그가 아니라 skills 파일이다 — 새 스킬을 추가하면서 설명 번역을
 * 빠뜨리면 조용히 새는 상태였다.
 */
describe('useSkillDescription — skills ↔ 카탈로그 완전성', () => {
    it('스킬 파일에서 한국어 설명을 실제로 찾아낸다', () => {
        // 0건이면 아래 it.each가 사라져 가드가 조용히 무력화된다.
        expect(koreanSkillDescriptions.length).toBeGreaterThan(30);
    });

    it.each(koreanSkillDescriptions)(
        '%s: en에서 한국어로 렌더되지 않는다',
        description => {
            renderWithIntl(<DescriptionProbe description={description} />, {
                locale: 'en',
            });

            const rendered =
                screen.getByTestId('description').textContent ?? '';

            expect(rendered).not.toMatch(/[가-힣]/);
            expect(
                (
                    enMessages as unknown as {
                        shared: { skillDescription: object };
                    }
                ).shared.skillDescription
            ).toHaveProperty(toSkillDescriptionKey(description));
        }
    );

    it('카탈로그에 없는 설명은 원문 그대로 둔다', () => {
        renderWithIntl(
            <DescriptionProbe description="an already-English description" />,
            { locale: 'en' }
        );

        expect(screen.getByTestId('description')).toHaveTextContent(
            'an already-English description'
        );
    });
});
