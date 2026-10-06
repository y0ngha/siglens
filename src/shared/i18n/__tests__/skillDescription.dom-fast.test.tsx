import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import koMessages from '../../../../messages/ko.json';
import enMessages from '../../../../messages/en.json';
import jaMessages from '../../../../messages/ja.json';
import zhMessages from '../../../../messages/zh.json';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { useSkillDescription } from '@/shared/i18n/skillDescription';

const SKILLS_DIR = join(process.cwd(), 'skills');
const CORE_DIR = join(SKILLS_DIR, '_core');

function collectMarkdown(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) collectMarkdown(full, acc);
        else if (name.endsWith('.md')) acc.push(full);
    }
    return acc;
}

interface VisibleSkill {
    readonly name: string;
    readonly description: string;
}

/**
 * 홈 쇼케이스에 실제로 나가는 스킬 — front-matter가 있고 `_core/`가 아닌 것(`CLAUDE.md` 같은
 * 안내 문서는 front-matter가 없어 `loadShowcaseSkills`도 건너뛴다).
 */
const visibleSkills: VisibleSkill[] = collectMarkdown(SKILLS_DIR)
    .filter(file => !file.startsWith(`${CORE_DIR}/`))
    .flatMap(file => {
        const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'));
        if (!front) return [];
        const field = (key: string) =>
            new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(front[1]!)?.[1]?.trim();
        const name = field('name');
        return name ? [{ name, description: field('description') ?? '' }] : [];
    });

const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
} as const;

type SummaryTable = Record<string, string>;
const summaryOf = (locale: keyof typeof CATALOGS): SummaryTable =>
    (CATALOGS[locale].shared as { skillSummary: SummaryTable }).skillSummary;

/** 방문자에게 보이는 문장에 내부 용어가 새지 않게 막는 목록. */
const INTERNAL_TERMS = /게이팅|primer|코어|Bulkowski|엣지|프리스크리너|digest/i;

function SummaryProbe({ name, description }: VisibleSkill) {
    const resolveDescription = useSkillDescription();
    return (
        <span data-testid="summary">
            {resolveDescription(name, description)}
        </span>
    );
}

/**
 * **skills 디렉터리 ↔ `shared.skillSummary` 카탈로그 완전성.**
 *
 * 소스는 카탈로그가 아니라 skills 파일이다 — 새 스킬을 추가하면서 요약을 빠뜨리면 카드가
 * 영어 원문 `description`("… with Bulkowski measured rates")으로 조용히 떨어진다. 폴백이
 * 에러 없이 동작하는 구조라 이 테스트가 유일한 방어선이다.
 */
describe('useSkillDescription — skills ↔ shared.skillSummary 완전성', () => {
    it('스킬 파일에서 쇼케이스 대상 스킬을 실제로 찾아낸다', () => {
        // 0건이면 아래 it.each가 사라져 가드가 조용히 무력화된다.
        expect(visibleSkills.length).toBeGreaterThan(80);
    });

    it('_core 스킬은 대상에서 빠져 있다', () => {
        const names = visibleSkills.map(skill => skill.name);

        expect(names).not.toContain('Candle Reading Primer');
        expect(names).not.toContain('Indicator Core Reference');
        expect(names).not.toContain('Pattern Index Reference');
    });

    it('이름에 마침표가 없다 — next-intl 키로 쓸 수 없는 문자다', () => {
        for (const { name } of visibleSkills) {
            expect(name, name).not.toContain('.');
        }
    });

    it('카탈로그에 대응하는 스킬이 없는 요약(고아)이 없다', () => {
        const names = new Set(visibleSkills.map(skill => skill.name));

        expect(
            Object.keys(summaryOf('ko')).filter(key => !names.has(key))
        ).toEqual([]);
    });

    describe.each(visibleSkills)('$name', skill => {
        it('ko 요약이 있고 한국어이며 내부 용어가 없다', () => {
            const summary = summaryOf('ko')[skill.name];

            expect(summary).toBeDefined();
            expect(summary).toMatch(/[가-힣]/);
            expect(summary).not.toMatch(INTERNAL_TERMS);
            // 카드 두 줄(`line-clamp-2`)에 들어가는 분량 — 한 줄 요약이다.
            expect(summary!.length).toBeGreaterThanOrEqual(15);
            expect(summary!.length).toBeLessThanOrEqual(60);
        });

        it.each(['en', 'ja', 'zh'] as const)(
            '%s 요약이 있고 한국어가 남지 않았다',
            locale => {
                const summary = summaryOf(locale)[skill.name];

                expect(summary).toBeDefined();
                expect(summary).not.toMatch(/[가-힣]/);
            }
        );
    });
});

describe('useSkillDescription', () => {
    const rsi: VisibleSkill = {
        name: 'RSI Signal Guide',
        description: 'RSI(14) 신호 해석 가이드 — 과매수/과매도 기준선',
    };

    it('ko: 이름으로 찾은 한 줄 요약을 보여준다 — front-matter 원문이 아니다', () => {
        renderWithIntl(<SummaryProbe {...rsi} />, { locale: 'ko' });

        const rendered = screen.getByTestId('summary').textContent;
        expect(rendered).toBe(summaryOf('ko')[rsi.name]);
        expect(rendered).not.toBe(rsi.description);
    });

    it('en: 같은 이름의 영어 요약이다', () => {
        renderWithIntl(<SummaryProbe {...rsi} />, { locale: 'en' });

        expect(screen.getByTestId('summary').textContent).toBe(
            summaryOf('en')[rsi.name]
        );
    });

    it('영문 이름의 스킬도 한국어 페이지에서 한국어 문장으로 나온다', () => {
        renderWithIntl(
            <SummaryProbe
                name="Bearish Engulfing Guide"
                description="Bearish Engulfing two-candle reversal interpretation guide with Bulkowski measured rates"
            />,
            { locale: 'ko' }
        );

        const rendered = screen.getByTestId('summary').textContent ?? '';
        expect(rendered).toMatch(/[가-힣]/);
        expect(rendered).not.toMatch(/Bulkowski/);
    });

    it('카탈로그에 없는 스킬은 원문 description으로 떨어진다 — 카드가 비지 않는다', () => {
        renderWithIntl(
            <SummaryProbe
                name="Brand New Skill"
                description="an already-written description"
            />,
            { locale: 'en' }
        );

        expect(screen.getByTestId('summary')).toHaveTextContent(
            'an already-written description'
        );
    });
});
