import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import enMessages from '../../../../messages/en.json';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { useSkillLabel } from '@/shared/i18n/skillLabel';

const SKILLS_DIR = join(process.cwd(), 'skills');

function collectMarkdown(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) collectMarkdown(full, acc);
        else if (name.endsWith('.md')) acc.push(full);
    }
    return acc;
}

/** front-matter `name:` 중 **한국어가 든 것**만. 영문 스킬은 원문이 곧 표시명이다. */
const koreanSkillNames = [
    ...new Set(
        collectMarkdown(SKILLS_DIR)
            .map(file =>
                /^name:\s*(.+)$/m.exec(readFileSync(file, 'utf8'))?.[1].trim()
            )
            .filter((name): name is string => !!name && /[가-힣]/.test(name))
    ),
];

function Probe({ name }: { name: string }) {
    const label = useSkillLabel();
    return <span data-testid="label">{label(name)}</span>;
}

/**
 * **skills 디렉터리 ↔ 카탈로그 완전성.**
 *
 * `useSkillLabel`의 폴백은 원문(한국어)을 그대로 돌려주므로, 카탈로그에 없는
 * 스킬은 **에러 없이 전 로케일에서 한국어로** 렌더된다. 자매 헬퍼
 * `useAssetLabel`은 정확히 이 이유로 완전성 가드를 받았는데 이쪽은 없었다 —
 * 한국어 이름의 스킬을 하나 추가하면 조용히 새는 상태였다.
 *
 * 스킬 파일이 소스이므로 카탈로그가 아니라 **파일에서** 목록을 만든다.
 */
describe('useSkillLabel — skills ↔ 카탈로그 완전성', () => {
    it('스킬 파일에서 한국어 이름을 실제로 찾아낸다', () => {
        // 0건이면 아래 it.each가 사라져 가드가 조용히 무력화된다.
        expect(koreanSkillNames.length).toBeGreaterThan(30);
    });

    it.each(koreanSkillNames)('%s: en에서 한국어로 렌더되지 않는다', name => {
        renderWithIntl(<Probe name={name} />, { locale: 'en' });

        const rendered = screen.getByTestId('label').textContent ?? '';

        expect(rendered).not.toMatch(/[가-힣]/);
        expect(
            (enMessages as unknown as { shared: { skillName: object } }).shared
                .skillName
        ).toHaveProperty(name);
    });

    it('카탈로그에 없는 이름은 원문 그대로 둔다', () => {
        renderWithIntl(<Probe name="RSI Signal Guide" />, { locale: 'en' });

        expect(screen.getByTestId('label')).toHaveTextContent(
            'RSI Signal Guide'
        );
    });
});
