import path from 'path';
import {
    buildGuideSeed,
    computeContentHash,
    planGuideUpsert,
    parseGuideFile,
    type ParsedGuideFile,
} from '@/../db/scripts/lib/guideSeed';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

function ko(
    slug: string,
    data: Record<string, unknown> = {},
    body = '본문'
): ParsedGuideFile {
    return {
        slug,
        dirCategory: 'indicators',
        locale: 'ko',
        data: {
            category: 'indicators',
            order: 10,
            related: [],
            title: `${slug} 제목`,
            aliases: ['별칭'],
            summary: '요약',
            seoTitle: 'seo 제목',
            seoDescription: 'seo 설명',
            faq: [{ q: '질문', a: '답' }],
            ...data,
        },
        body,
        sourceFile: `${slug}/ko.md`,
    };
}

function translation(
    slug: string,
    locale: 'en' | 'ja' | 'zh',
    data: Record<string, unknown> = {}
): ParsedGuideFile {
    return {
        slug,
        dirCategory: 'indicators',
        locale,
        data: {
            title: `${slug} ${locale}`,
            aliases: [],
            summary: 'summary',
            seoTitle: 'seo title',
            seoDescription: 'seo description',
            faq: [],
            ...data,
        },
        body: 'body',
        sourceFile: `${slug}/${locale}.md`,
    };
}

describe('buildGuideSeed', () => {
    it('ko 원문 하나로 항목을 만들고 skills 기본값은 [slug]다', () => {
        const seed = buildGuideSeed([ko('rsi')]);

        expect(seed.entries).toHaveLength(1);
        expect(seed.entries[0]).toMatchObject({
            slug: 'rsi',
            category: 'indicators',
            order: 10,
            skills: ['rsi'],
        });
    });

    it('skills를 명시하면 그 값을 쓰고 빈 배열도 존중한다', () => {
        const seed = buildGuideSeed([
            ko('candle-basics', { skills: [] }),
            ko('macd', { skills: ['macd', 'macd-v'] }),
        ]);

        const bySlug = Object.fromEntries(
            seed.entries.map(e => [e.slug, e.skills])
        );
        expect(bySlug).toEqual({
            'candle-basics': [],
            macd: ['macd', 'macd-v'],
        });
    });

    it('번역이 없으면 에러가 아니라 로케일별 경고다', () => {
        const seed = buildGuideSeed([ko('rsi'), translation('rsi', 'en')]);

        expect(seed.warnings).toEqual([
            'rsi: ja 번역이 없다 (ko로 폴백)',
            'rsi: zh 번역이 없다 (ko로 폴백)',
        ]);
    });

    it('번역을 모두 갖추면 경고가 없다', () => {
        const seed = buildGuideSeed([
            ko('rsi'),
            translation('rsi', 'en'),
            translation('rsi', 'ja'),
            translation('rsi', 'zh'),
        ]);

        expect(seed.warnings).toEqual([]);
        expect(seed.entries[0]!.contents.map(c => c.locale).toSorted()).toEqual(
            ['en', 'ja', 'ko', 'zh']
        );
    });

    it('ko 원문이 없으면 던진다', () => {
        expect(() => buildGuideSeed([translation('rsi', 'en')])).toThrow(
            /rsi: ko 원문이 없다/
        );
    });

    it('frontmatter category가 디렉터리와 다르면 던진다', () => {
        expect(() =>
            buildGuideSeed([ko('rsi', { category: 'strategies' })])
        ).toThrow(/category\(strategies\)가 디렉터리\(indicators\)와 다르다/);
    });

    it('알 수 없는 category는 스키마 위반으로 던진다', () => {
        expect(() => buildGuideSeed([ko('rsi', { category: 'nope' })])).toThrow(
            /category/
        );
    });

    it('존재하지 않는 slug를 related로 가리키면 던진다', () => {
        expect(() =>
            buildGuideSeed([ko('rsi', { related: ['ghost'] })])
        ).toThrow(/related\(ghost\)가 존재하지 않는 slug다/);
    });

    it('자기 자신을 related로 가리키면 던진다', () => {
        expect(() => buildGuideSeed([ko('rsi', { related: ['rsi'] })])).toThrow(
            /자기 자신/
        );
    });

    it('필수 필드가 빠진 번역 파일은 던진다', () => {
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                translation('rsi', 'en', { title: undefined }),
            ])
        ).toThrow(/rsi\/en\.md: title/);
    });

    it('에러는 모아서 한 번에 알린다', () => {
        expect(() =>
            buildGuideSeed([
                ko('a', { related: ['ghost'] }),
                translation('b', 'en'),
            ])
        ).toThrow(/2건/);
    });

    it('demoCaption이 없으면 null이다', () => {
        const seed = buildGuideSeed([ko('rsi')]);
        expect(seed.entries[0]!.contents[0]!.demoCaption).toBeNull();
    });
});

describe('computeContentHash', () => {
    const fields = {
        title: '제목',
        aliases: ['a'],
        summary: '요약',
        seoTitle: 't',
        seoDescription: 'd',
        demoCaption: null,
        bodyMd: '본문',
        faq: [{ q: 'q', a: 'a' }],
    };

    it('같은 내용이면 같다', () => {
        expect(computeContentHash({ ...fields })).toBe(
            computeContentHash({ ...fields, faq: [{ a: 'a', q: 'q' }] })
        );
    });

    it('본문이 바뀌면 달라진다', () => {
        expect(computeContentHash({ ...fields, bodyMd: '다른 본문' })).not.toBe(
            computeContentHash(fields)
        );
    });

    it('frontmatter 필드가 바뀌어도 달라진다', () => {
        expect(
            computeContentHash({ ...fields, summary: '다른 요약' })
        ).not.toBe(computeContentHash(fields));
    });

    it('64자리 hex다', () => {
        expect(computeContentHash(fields)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('줄바꿈 정규화 덕에 CRLF 본문도 같은 해시를 낸다', () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'guide-seed-'));
        onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
        const make = (name: string, text: string) => {
            const target = path.join(dir, 'indicators', name);
            mkdirSync(target, { recursive: true });
            const file = path.join(target, 'ko.md');
            writeFileSync(file, text);
            return parseGuideFile(file);
        };
        const front =
            '---\ncategory: indicators\norder: 1\ntitle: t\nsummary: s\nseoTitle: a\nseoDescription: b\n---\n';

        const lf = make('x', `${front}줄1\n줄2\n`);
        const crlf = make('y', `${front}줄1\n줄2\n`.replace(/\n/g, '\r\n'));

        expect(crlf.body).toBe(lf.body);
    });
});

describe('parseGuideFile', () => {
    it('알 수 없는 로케일 파일명은 던진다', () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'guide-seed-'));
        onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
        const target = path.join(dir, 'indicators', 'rsi');
        mkdirSync(target, { recursive: true });
        const file = path.join(target, 'fr.md');
        writeFileSync(file, '---\ntitle: x\n---\n');

        expect(() => parseGuideFile(file)).toThrow(/Invalid guide seed path/);
    });

    it('경로에서 카테고리·slug·로케일을 읽는다', () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'guide-seed-'));
        onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
        const target = path.join(dir, 'indicators', 'rsi');
        mkdirSync(target, { recursive: true });
        const file = path.join(target, 'en.md');
        writeFileSync(file, '---\ntitle: x\n---\n\n본문\n');

        expect(parseGuideFile(file)).toMatchObject({
            slug: 'rsi',
            dirCategory: 'indicators',
            locale: 'en',
            body: '본문',
        });
    });
});

describe('planGuideUpsert', () => {
    const seed = buildGuideSeed([ko('rsi', { related: ['macd'] }), ko('macd')]);
    const existingEntries = seed.entries.map(e => ({
        slug: e.slug,
        category: e.category,
        sortOrder: e.order,
        related: e.related,
        skills: e.skills,
    }));
    const existingContents = seed.entries.flatMap(e =>
        e.contents.map(c => ({
            slug: c.slug,
            locale: c.locale,
            contentHash: c.contentHash,
        }))
    );

    it('DB가 비어 있으면 전부 적재한다', () => {
        const plan = planGuideUpsert(seed, [], []);

        expect(plan.entries).toHaveLength(2);
        expect(plan.contents).toHaveLength(2);
    });

    it('아무것도 안 바뀌면 적재할 행이 없다', () => {
        const plan = planGuideUpsert(seed, existingEntries, existingContents);

        expect(plan).toEqual({ entries: [], contents: [], orphans: [] });
    });

    it('본문 해시가 다른 행만 고른다', () => {
        const stale = existingContents.map(c =>
            c.slug === 'macd' ? { ...c, contentHash: 'old' } : c
        );

        const plan = planGuideUpsert(seed, existingEntries, stale);

        expect(plan.contents.map(c => c.slug)).toEqual(['macd']);
        expect(plan.entries).toEqual([]);
    });

    it('항목 메타(order, related)가 다르면 그 항목만 고른다', () => {
        const plan = planGuideUpsert(
            seed,
            existingEntries.map(e =>
                e.slug === 'rsi' ? { ...e, sortOrder: 99 } : e
            ),
            existingContents
        );

        expect(plan.entries.map(e => e.slug)).toEqual(['rsi']);
    });

    it('related 목록이 바뀐 것도 감지한다', () => {
        const plan = planGuideUpsert(
            seed,
            existingEntries.map(e =>
                e.slug === 'rsi' ? { ...e, related: [] } : e
            ),
            existingContents
        );

        expect(plan.entries.map(e => e.slug)).toEqual(['rsi']);
    });

    it('시드에 없는 DB 행은 지우지 않고 고아로 알린다', () => {
        const plan = planGuideUpsert(
            seed,
            [
                ...existingEntries,
                {
                    slug: 'gone',
                    category: 'indicators',
                    sortOrder: 1,
                    related: [],
                    skills: [],
                },
            ],
            [
                ...existingContents,
                { slug: 'rsi', locale: 'en', contentHash: 'x' },
            ]
        );

        expect(plan.orphans).toEqual(['entry gone', 'content rsi:en']);
    });
});
