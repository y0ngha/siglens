import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import koMessages from '../../../../messages/ko.json';
import enMessages from '../../../../messages/en.json';
import jaMessages from '../../../../messages/ja.json';
import zhMessages from '../../../../messages/zh.json';
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

const CORE_DIR = join(SKILLS_DIR, '_core');

/** 쇼케이스·분석 패널에 이름이 나가는 스킬 — front-matter `name`, `_core/` 제외. */
const visibleSkillNames = [
    ...new Set(
        collectMarkdown(SKILLS_DIR)
            .filter(file => !file.startsWith(`${CORE_DIR}/`))
            .map(file =>
                /^name:\s*(.+)$/m.exec(readFileSync(file, 'utf8'))?.[1].trim()
            )
            .filter((name): name is string => !!name)
    ),
];

/** front-matter `name:` 중 **한국어가 든 것**만. */
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
        renderWithIntl(<Probe name="Brand New Skill Guide" />, {
            locale: 'ko',
        });

        expect(screen.getByTestId('label')).toHaveTextContent(
            'Brand New Skill Guide'
        );
    });
});

/**
 * **영문 이름 스킬(캔들 패턴 19 + 지표 35)도 한국어 표시명을 갖는다.**
 *
 * 한국어 사이트의 홈·분석 패널에 "Bearish Engulfing Guide" 같은 영어 이름이 그대로 나갔다.
 * 원본 `name`은 프롬프트와 캐시 지문의 일부라 못 바꾸므로 카탈로그가 표시명을 대신한다.
 * 폴백이 원문이라 빠져도 에러가 없다 — 이 테스트가 유일한 방어선이다.
 */
describe('useSkillLabel — 영문 이름 스킬의 한국어 표시명', () => {
    const englishNames = visibleSkillNames.filter(
        name => !/[가-힣]/.test(name)
    );

    it('영문 이름 스킬을 실제로 찾아낸다', () => {
        expect(englishNames.length).toBeGreaterThan(40);
    });

    it.each(englishNames)('%s: ko 카탈로그에 한국어 표시명이 있다', name => {
        const table = (
            koMessages as unknown as {
                shared: { skillName: Record<string, string> };
            }
        ).shared.skillName;

        expect(table[name]).toBeDefined();
        expect(table[name]).toMatch(/[가-힣]/);
    });

    it('ko에서 영문 이름이 한국어 표시명으로 렌더된다', () => {
        renderWithIntl(<Probe name="Bearish Engulfing Guide" />, {
            locale: 'ko',
        });

        expect(screen.getByTestId('label')).toHaveTextContent('하락 장악형');
    });

    it('en은 영문 원본 이름을 그대로 유지한다 — 번역으로 이름이 흔들리지 않는다', () => {
        renderWithIntl(<Probe name="Bearish Engulfing Guide" />, {
            locale: 'en',
        });

        expect(screen.getByTestId('label')).toHaveTextContent(
            'Bearish Engulfing Guide'
        );
    });

    it.each([
        ['en', enMessages],
        ['ja', jaMessages],
        ['zh', zhMessages],
    ] as const)(
        '%s 카탈로그가 쇼케이스 대상 스킬 이름을 전부 갖고 있다',
        (_locale, messages) => {
            const table = (
                messages as unknown as {
                    shared: { skillName: Record<string, string> };
                }
            ).shared.skillName;

            expect(
                visibleSkillNames.filter(name => table[name] === undefined)
            ).toEqual([]);
        }
    );
});
