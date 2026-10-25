import path from 'path';
import {
    bodyCharCount,
    buildGuideSeed,
    computeContentHash,
    planGuideUpsert,
    parseGuideFile,
    type ParsedGuideFile,
} from '@/../db/scripts/lib/guideSeed';
import { LIVE_ANCHOR_HEADING } from '@/shared/config/guideLive';
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
        about: e.about,
        signals: e.signals,
        demoFrom: e.demoFrom,
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
                    about: [],
                    signals: [],
                    demoFrom: null,
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

/** 공백 제외 1,500자 이상이 되도록 채운 본문 조각. */
const LONG_PARAGRAPH = `${'가나다라마바사 '.repeat(250)}\n`;

function howto(
    slug: string,
    data: Record<string, unknown> = {},
    body = `## 이렇게 봐요\n\n${LONG_PARAGRAPH}\n${LIVE_ANCHOR_HEADING}\n\n본문`
): ParsedGuideFile {
    return {
        slug,
        dirCategory: 'howto',
        locale: 'ko',
        data: {
            category: 'howto',
            order: 10,
            related: [],
            skills: [],
            about: ['rsi'],
            signals: ['rsi_oversold'],
            title: 'RSI 보는 법',
            aliases: ['RSI 지표 보는법'],
            summary: '요약',
            seoTitle: 'RSI 보는 법: 50선·추세 순서',
            seoDescription: 'seo 설명',
            faq: [{ q: '질문', a: '답' }],
            ...data,
        },
        body,
        sourceFile: `${slug}/ko.md`,
    };
}

describe('howto 규칙', () => {
    const base = [ko('rsi'), howto('rsi-how-to-read')];

    it('about·signals·demoFrom·skills를 항목에 싣는다', () => {
        const seed = buildGuideSeed([
            ko('rsi'),
            howto('rsi-how-to-read', { demoFrom: 'rsi' }),
        ]);
        const entry = seed.entries.find(e => e.slug === 'rsi-how-to-read')!;
        expect(entry.about).toEqual(['rsi']);
        expect(entry.signals).toEqual(['rsi_oversold']);
        expect(entry.demoFrom).toBe('rsi');
        expect(entry.skills).toEqual([]);
        const term = seed.entries.find(e => e.slug === 'rsi')!;
        expect(term.about).toEqual([]);
        expect(term.signals).toEqual([]);
        expect(term.demoFrom).toBeNull();
        expect(term.skills).toEqual(['rsi']);
    });

    it('howto는 skills: []를 명시해야 한다', () => {
        expect(() =>
            buildGuideSeed([ko('rsi'), howto('x', { skills: undefined })])
        ).toThrow(/skills: \[\]/);
        expect(() =>
            buildGuideSeed([ko('rsi'), howto('x', { skills: ['rsi'] })])
        ).toThrow(/skills: \[\]/);
    });

    it('howto는 about이 1개 이상이고 존재하는 비-howto slug여야 한다', () => {
        expect(() =>
            buildGuideSeed([ko('rsi'), howto('x', { about: [] })])
        ).toThrow(/about/);
        expect(() =>
            buildGuideSeed([ko('rsi'), howto('x', { about: ['nope'] })])
        ).toThrow(/about\(nope\)/);
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x'),
                howto('y', { about: ['x'] }),
            ])
        ).toThrow(/about\(x\).*howto/);
    });

    it('signals는 SignalType 집합 안이어야 한다(모든 카테고리)', () => {
        expect(() =>
            buildGuideSeed([ko('rsi', { signals: ['not_a_signal'] })])
        ).toThrow(/signals\(not_a_signal\)/);
    });

    it('용어(비-howto) 항목은 about을 쓸 수 없다', () => {
        expect(() =>
            buildGuideSeed([ko('rsi'), ko('macd', { about: ['rsi'] })])
        ).toThrow(/macd: 용어 항목은 about을 쓰지 않는다/);
    });

    it('demoFrom은 about 안의 slug여야 한다', () => {
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                ko('macd'),
                howto('x', { demoFrom: 'macd' }),
            ])
        ).toThrow(/demoFrom\(macd\)/);
    });

    it('howto 제목은 30자 이하, seoTitle 폭은 55 이하다', () => {
        expect(() =>
            buildGuideSeed([ko('rsi'), howto('x', { title: '가'.repeat(31) })])
        ).toThrow(/title.*30/);
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', { seoTitle: '가'.repeat(28) }),
            ])
        ).toThrow(/seoTitle.*55/);
    });

    it('howto 본문·FAQ에 매매 지시 표현이 있으면 에러다', () => {
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', {}, '## 이렇게 봐요\n\n70을 넘으면 매도하세요.'),
            ])
        ).toThrow(/매매 지시 표현/);
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', { faq: [{ q: 'q', a: '지금 사세요.' }] }),
            ])
        ).toThrow(/매매 지시 표현/);
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', { faq: [{ q: '지금 사세요?', a: '답' }] }),
            ])
        ).toThrow(/매매 지시 표현/);
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', { title: '지금 사세요 가이드' }),
            ])
        ).toThrow(/매매 지시 표현/);
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', { seoDescription: '지금 사세요.' }),
            ])
        ).toThrow(/매매 지시 표현/);
        expect(() =>
            buildGuideSeed([ko('rsi'), howto('x', { aliases: ['매도하세요'] })])
        ).toThrow(/매매 지시 표현/);
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', { summary: '70을 넘으면 매도하세요.' }),
            ])
        ).toThrow(/매매 지시 표현/);
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', { demoCaption: '지금 사세요.' }),
            ])
        ).toThrow(/매매 지시 표현/);
        // 용어 항목(기존 90편)은 이 린트를 적용하지 않는다 — 소급 실패를 막는다.
        expect(() =>
            buildGuideSeed([ko('rsi', {}, '70을 넘으면 매도하세요.')])
        ).not.toThrow();
    });

    it('howto 본문은 공백 제외 1,500자 이상이어야 한다', () => {
        const anchored = (paragraph: string) =>
            `## 이렇게 봐요\n\n${paragraph}\n\n${LIVE_ANCHOR_HEADING}\n\n본문`;
        const chars = (n: number) => '가'.repeat(n);
        // 앵커 절 제목·"본문"·"이렇게 봐요"도 글자 수에 들어가므로 빈 본문의 기준선을 잰다.
        const baseline = bodyCharCount(anchored(''));
        const need = 1500 - baseline;
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', {}, anchored(chars(need - 1))),
            ])
        ).toThrow(/1500자 이상/);
        expect(() =>
            buildGuideSeed([ko('rsi'), howto('x', {}, anchored(chars(need)))])
        ).not.toThrow();
        // 공백·줄바꿈은 세지 않는다.
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', {}, anchored(`${chars(need - 1)}\n\n   \n`)),
            ])
        ).toThrow(/1500자 이상/);
        // 용어 항목에는 적용하지 않는다.
        expect(() => buildGuideSeed([ko('rsi')])).not.toThrow();
    });

    it('bodyCharCount는 마크다운 문법을 빼고 읽히는 글자만 센다', () => {
        const body = [
            '## 제목',
            '',
            '- **강조** 항목',
            '1. _기울임_ `코드`',
            '> 인용',
            '[링크문구](/guide/indicators/adx) 끝',
        ].join('\n');
        // 제목+강조+항목+기울임+코드+인용+링크문구+끝
        expect(bodyCharCount(body)).toBe(
            [...'제목강조항목기울임코드인용링크문구끝'].length
        );
    });

    it('howto 본문에 라이브 모듈 앵커 절이 없으면 에러다', () => {
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto('x', {}, '## 이렇게 봐요\n\n본문'),
            ])
        ).toThrow(/라이브 모듈 앵커/);
        // 코드 펜스 안의 제목은 앵커가 아니다.
        expect(() =>
            buildGuideSeed([
                ko('rsi'),
                howto(
                    'x',
                    {},
                    `## 이렇게 봐요\n\n\`\`\`\n${LIVE_ANCHOR_HEADING}\n\`\`\``
                ),
            ])
        ).toThrow(/라이브 모듈 앵커/);
        // 용어 항목은 앵커가 없어도 된다.
        expect(() => buildGuideSeed([ko('rsi')])).not.toThrow();
    });

    it('howto 제목이 about 항목의 seoTitle 안에 있으면 에러다', () => {
        expect(() =>
            buildGuideSeed([
                ko('rsi', { seoTitle: 'RSI 보는 법과 70·30' }),
                howto('x'),
            ])
        ).toThrow(/RSI 보는 법.*seoTitle/);
        expect(() =>
            buildGuideSeed([
                ko('rsi', { seoTitle: 'RSI 뜻과 계산법' }),
                howto('x'),
            ])
        ).not.toThrow();
    });

    it('planGuideUpsert가 about·signals·demoFrom 변경을 감지한다', () => {
        const seed = buildGuideSeed(base);
        const existing = seed.entries.map(e => ({
            slug: e.slug,
            category: e.category,
            sortOrder: e.order,
            related: e.related,
            skills: e.skills,
            about: e.about,
            signals: e.signals,
            demoFrom: e.demoFrom,
        }));
        expect(planGuideUpsert(seed, existing, []).entries).toEqual([]);
        const changed = existing.map(e =>
            e.slug === 'rsi-how-to-read' ? { ...e, signals: [] } : e
        );
        expect(
            planGuideUpsert(seed, changed, []).entries.map(e => e.slug)
        ).toEqual(['rsi-how-to-read']);
        const changedAbout = existing.map(e =>
            e.slug === 'rsi-how-to-read' ? { ...e, about: [] } : e
        );
        expect(
            planGuideUpsert(seed, changedAbout, []).entries.map(e => e.slug)
        ).toEqual(['rsi-how-to-read']);
        const changedDemoFrom = existing.map(e =>
            e.slug === 'rsi-how-to-read' ? { ...e, demoFrom: 'rsi' } : e
        );
        expect(
            planGuideUpsert(seed, changedDemoFrom, []).entries.map(e => e.slug)
        ).toEqual(['rsi-how-to-read']);
    });
});

describe('중복 제목 린트', () => {
    it('한 본문에 같은 h2/h3 제목이 두 번 나오면 에러다(모든 카테고리)', () => {
        expect(() =>
            buildGuideSeed([ko('rsi', {}, '## 가\n\n본문\n\n## 가\n\n또')])
        ).toThrow(/제목 "가".*두 번/);
        expect(() =>
            buildGuideSeed([
                ko('rsi', {}, '## 가\n\n### 나\n\n본문\n\n### 나 ##\n'),
            ])
        ).toThrow(/제목 "나"/);
    });

    it('github-slugger가 같은 id로 만드는 제목(구두점·대소문자 차이)은 충돌이다', () => {
        expect(() =>
            buildGuideSeed([ko('rsi', {}, '## RSI\n\n본문\n\n### RSI?\n\n또')])
        ).toThrow(/제목 "RSI\?".*두 번/);
        expect(() =>
            buildGuideSeed([ko('rsi', {}, '## Rsi\n\n본문\n\n### RSI\n')])
        ).toThrow(/두 번/);
    });

    it('서로 다른 제목과 코드 펜스 안의 # 줄은 통과한다', () => {
        expect(() =>
            buildGuideSeed([
                ko(
                    'rsi',
                    {},
                    '## 가\n\n```\n## 가\n```\n\n## 나\n\n### 다\n\n### 라'
                ),
            ])
        ).not.toThrow();
    });
});
