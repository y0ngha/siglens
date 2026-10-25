import path from 'path';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { slug as githubSlug } from 'github-slugger';
import { glob } from 'glob';
import matter from 'gray-matter';
import { z } from 'zod';
import {
    GUIDE_CATEGORIES,
    type GuideCategory,
    type GuideFaqItem,
} from '@/entities/guide/types';
import { findAdvicePhrases } from '@/entities/analysis-plain/lib/guardPlainText';
import { LIVE_ANCHOR_HEADING } from '@/shared/config/guideLive';
import { isSignalType } from '@/shared/config/signalTypes';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';
import {
    parseHeadingLine,
    scanMarkdownLines,
} from '@/shared/lib/markdownHeadings';
import { SEO_TITLE_MAX_WIDTH, seoTitleWidth } from '@/shared/lib/seo';
import type { SignalType } from '@y0ngha/siglens-core';

/**
 * `db/seeds/guide/{category}/{slug}/{locale}.md`를 읽어 검증하는 **순수 파서/검증기**.
 *
 * DB에는 닿지 않는다(적재는 `seedGuide.ts`). 규칙: ko 원문은 필수이고, 번역이 없으면
 * 에러가 아니라 경고다(읽기 경로가 요청 로케일 행이 없을 때 ko로 폴백한다).
 */

/** 실전 가이드 카테고리 — 탐지기 매핑이 없고 `about`으로 용어 항목을 가리킨다. */
const HOWTO_CATEGORY = 'howto' as const satisfies GuideCategory;
/** 네이버 웹문서 제목 절단 기준(한글). howto만 적용 — 기존 용어 항목은 소급하지 않는다. */
const HOWTO_TITLE_MAX_CHARS = 30;

/**
 * howto 본문 최소 분량(공백 제외 글자 수). 이보다 짧은 글은 질문에 답하는 페이지가 아니라 얇은 페이지로 읽혀
 * 검색 노출에서 손해라, 시드 단계에서 막는다.
 */
const HOWTO_BODY_MIN_CHARS = 1500;

const anchorTitle = parseHeadingLine(LIVE_ANCHOR_HEADING)?.title;

const LocalizedFrontmatterSchema = z.object({
    title: z.string().min(1),
    aliases: z.array(z.string().min(1)).default([]),
    summary: z.string().min(1),
    seoTitle: z.string().min(1),
    seoDescription: z.string().min(1),
    demoCaption: z.string().min(1).nullish(),
    faq: z
        .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
        .default([]),
});

/** ko 파일만 갖는 항목 공통 메타. */
const KoFrontmatterSchema = LocalizedFrontmatterSchema.extend({
    category: z.enum(GUIDE_CATEGORIES),
    order: z.number().int(),
    related: z.array(z.string().min(1)).default([]),
    /** 이 항목이 설명하는 스킬 파일 basename. 생략하면 `[slug]`. */
    skills: z.array(z.string().min(1)).optional(),
    /** howto: 다루는 용어 항목 slug(비-howto). 용어 항목은 생략(= []). */
    about: z.array(z.string().min(1)).default([]),
    /** 라이브 종목 모듈이 섹터 스캐너에서 고를 신호 타입. */
    signals: z.array(z.string().min(1)).default([]),
    /** 데모 차트를 빌려 올 항목 slug(`about` 중 하나). */
    demoFrom: z.string().min(1).nullish(),
});

export interface ParsedGuideFile {
    readonly slug: string;
    /** 디렉터리에서 읽은 카테고리. */
    readonly dirCategory: string;
    readonly locale: Locale;
    readonly data: unknown;
    readonly body: string;
    readonly sourceFile: string;
}

export interface GuideSeedContent {
    readonly slug: string;
    readonly locale: Locale;
    readonly title: string;
    readonly aliases: readonly string[];
    readonly summary: string;
    readonly seoTitle: string;
    readonly seoDescription: string;
    readonly demoCaption: string | null;
    readonly bodyMd: string;
    readonly faq: readonly GuideFaqItem[];
    readonly contentHash: string;
}

export interface GuideSeedEntry {
    readonly slug: string;
    readonly category: GuideCategory;
    readonly order: number;
    readonly related: readonly string[];
    readonly skills: readonly string[];
    readonly about: readonly string[];
    readonly signals: readonly SignalType[];
    readonly demoFrom: string | null;
    readonly contents: readonly GuideSeedContent[];
}

export interface GuideSeed {
    readonly entries: readonly GuideSeedEntry[];
    readonly warnings: readonly string[];
}

function isLocale(value: string): value is Locale {
    return (LOCALES as readonly string[]).includes(value);
}

/** 키 순서와 무관한 JSON — 해시가 frontmatter 키 순서에 흔들리지 않게 한다. */
function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
        return `{${Object.entries(value)
            .toSorted(([a], [b]) => (a < b ? -1 : Number(a > b)))
            .map(
                ([key, child]) =>
                    `${JSON.stringify(key)}:${stableStringify(child)}`
            )
            .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

/** 줄바꿈·앞뒤 공백 차이로 해시가 바뀌지 않게 본문을 정규화한다. */
function normalizeBody(body: string): string {
    return body.replace(/\r\n/g, '\n').trim();
}

/**
 * (slug, locale) 한 건의 content_hash — **노출 필드 전체**(frontmatter + 본문)의 sha256.
 * `category`·`order`·`related`·`skills`는 항목 행의 몫이라 제외한다.
 */
export function computeContentHash(
    fields: Omit<GuideSeedContent, 'slug' | 'locale' | 'contentHash'>
): string {
    return createHash('sha256')
        .update(
            stableStringify({
                title: fields.title,
                aliases: fields.aliases,
                summary: fields.summary,
                seoTitle: fields.seoTitle,
                seoDescription: fields.seoDescription,
                demoCaption: fields.demoCaption,
                faq: fields.faq,
                body: fields.bodyMd,
            })
        )
        .digest('hex');
}

/**
 * 파일 하나를 읽는다. 경로 모양 `…/{category}/{slug}/{locale}.md`에서 카테고리·slug·로케일을
 * 뽑는다 — 파일명 오타가 그 파일을 조용히 무시하지 않도록 알 수 없는 로케일은 던진다.
 */
export function parseGuideFile(filePath: string): ParsedGuideFile {
    const parts = path.resolve(filePath).split(path.sep);
    const locale = path.basename(filePath, '.md');
    const slug = parts.at(-2);
    const dirCategory = parts.at(-3);
    if (!isLocale(locale) || slug === undefined || dirCategory === undefined) {
        throw new Error(
            `Invalid guide seed path ${filePath} — {category}/{slug}/{ko|en|ja|zh}.md 형태여야 한다`
        );
    }
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    return {
        slug,
        dirCategory,
        locale,
        data: parsed.data,
        body: normalizeBody(parsed.content),
        sourceFile: filePath,
    };
}

/**
 * 읽히는 본문 글자 수. 마크다운 문법(링크 URL·제목 `#`·강조·인라인 코드·목록/인용 표식)은 세지 않고
 * 공백(줄바꿈 포함)도 뺀다.
 */
export function bodyCharCount(body: string): number {
    const prose = body
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(
            /^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+\.[ \t]+)/gm,
            ''
        )
        .replace(/[*_`]/g, '')
        .replace(/\s+/g, '');
    return [...prose].length;
}

/** h2·h3 제목은 코드 펜스 밖에서 github-slugger id 기준으로 유일해야 한다. 본문이 두 `GuideMarkdown`으로 나뉘어 렌더되면 slugger가 리셋되므로 id 충돌을 막으려 유일해야 한다. */
function duplicateHeadingErrors(file: ParsedGuideFile): string[] {
    // rehype-slug가 id를 만드는 것과 같은 알고리즘으로 비교한다 — `RSI?`와 `RSI`는 같은 id다.
    const titles = scanMarkdownLines(file.body).flatMap(line =>
        line.heading === null ? [] : [line.heading.title]
    );
    const duplicated = titles.filter(
        (title, index) =>
            titles.findIndex(other => githubSlug(other) === githubSlug(title)) <
            index
    );
    return [...new Set(duplicated)].map(
        title =>
            `${file.sourceFile}: h2/h3 제목 "${title}"이 한 본문에 두 번 나온다(heading id 충돌)`
    );
}

function formatIssues(error: z.ZodError): string {
    return error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
}

interface EntryBuild {
    readonly entry: GuideSeedEntry | null;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
}

type ContentBuild =
    | { readonly content: GuideSeedContent }
    | { readonly error: string };

function failedEntry(...errors: string[]): EntryBuild {
    return { entry: null, errors, warnings: [] };
}

function buildContent(
    slug: string,
    file: ParsedGuideFile,
    result: ReturnType<typeof LocalizedFrontmatterSchema.safeParse>
): ContentBuild {
    if (!result.success) {
        return {
            error: `${file.sourceFile}: ${formatIssues(result.error)}`,
        };
    }
    const fields = {
        title: result.data.title,
        aliases: result.data.aliases,
        summary: result.data.summary,
        seoTitle: result.data.seoTitle,
        seoDescription: result.data.seoDescription,
        demoCaption: result.data.demoCaption ?? null,
        bodyMd: file.body,
        faq: result.data.faq,
    };
    return {
        content: {
            slug,
            locale: file.locale,
            ...fields,
            contentHash: computeContentHash(fields),
        },
    };
}

/** slug 하나(= 로케일 파일 묶음)를 항목으로 조립한다. 에러가 있으면 항목은 `null`이다. */
function buildEntry(
    slug: string,
    group: readonly ParsedGuideFile[]
): EntryBuild {
    const ko = group.find(file => file.locale === DEFAULT_LOCALE);
    if (ko === undefined) return failedEntry(`${slug}: ko 원문이 없다`);

    const koResult = KoFrontmatterSchema.safeParse(ko.data);
    if (!koResult.success) {
        return failedEntry(`${ko.sourceFile}: ${formatIssues(koResult.error)}`);
    }
    const meta = koResult.data;
    if (meta.category !== ko.dirCategory) {
        return failedEntry(
            `${ko.sourceFile}: category(${meta.category})가 디렉터리(${ko.dirCategory})와 다르다`
        );
    }

    const isHowto = meta.category === HOWTO_CATEGORY;
    const badSignals = meta.signals.filter(signal => !isSignalType(signal));
    const advice = isHowto
        ? [
              ko.body,
              meta.title,
              ...meta.aliases,
              meta.summary,
              meta.seoTitle,
              meta.seoDescription,
              ...(meta.demoCaption == null ? [] : [meta.demoCaption]),
              ...meta.faq.flatMap(item => [item.q, item.a]),
          ].flatMap(text => findAdvicePhrases(text, 'ko'))
        : [];
    const hasLiveAnchor = scanMarkdownLines(ko.body).some(
        line => line.heading?.level === 2 && line.heading.title === anchorTitle
    );
    const howtoErrors = isHowto
        ? [
              ...(meta.skills === undefined || meta.skills.length > 0
                  ? [
                        `${ko.sourceFile}: howto는 skills: []를 명시한다(탐지기 매핑이 없다)`,
                    ]
                  : []),
              ...(meta.about.length === 0
                  ? [`${ko.sourceFile}: howto는 about이 1개 이상이어야 한다`]
                  : []),
              ...([...meta.title].length > HOWTO_TITLE_MAX_CHARS
                  ? [
                        `${ko.sourceFile}: title은 ${HOWTO_TITLE_MAX_CHARS}자 이하여야 한다(네이버 제목 절단)`,
                    ]
                  : []),
              ...(seoTitleWidth(meta.seoTitle) > SEO_TITLE_MAX_WIDTH
                  ? [
                        `${ko.sourceFile}: seoTitle 폭이 ${SEO_TITLE_MAX_WIDTH}를 넘는다`,
                    ]
                  : []),
              ...(bodyCharCount(ko.body) < HOWTO_BODY_MIN_CHARS
                  ? [
                        `${ko.sourceFile}: howto 본문은 공백 제외 ${HOWTO_BODY_MIN_CHARS}자 이상이어야 한다(현재 ${bodyCharCount(ko.body)}자)`,
                    ]
                  : []),
              ...(hasLiveAnchor
                  ? []
                  : [
                        `${ko.sourceFile}: howto 본문에 라이브 모듈 앵커 "${LIVE_ANCHOR_HEADING}" 절이 있어야 한다`,
                    ]),
              ...(advice.length > 0
                  ? [
                        `${ko.sourceFile}: 매매 지시 표현이 있다 — ${[...new Set(advice)].join(', ')}`,
                    ]
                  : []),
          ]
        : [];
    const ruleErrors = [
        ...howtoErrors,
        ...group.flatMap(duplicateHeadingErrors),
        ...(badSignals.length > 0
            ? [
                  `${ko.sourceFile}: signals(${badSignals.join(', ')})가 SignalType이 아니다`,
              ]
            : []),
    ];
    if (ruleErrors.length > 0) return failedEntry(...ruleErrors);

    const builds = group.map(file =>
        buildContent(
            slug,
            file,
            file === ko
                ? koResult
                : LocalizedFrontmatterSchema.safeParse(file.data)
        )
    );
    const duplicateKoErrors =
        group.filter(file => file.locale === DEFAULT_LOCALE).length > 1
            ? [`${slug}: ko 원문이 둘 이상이다`]
            : [];

    return {
        entry: {
            slug,
            category: meta.category,
            order: meta.order,
            related: meta.related,
            skills: meta.skills ?? (isHowto ? [] : [slug]),
            about: meta.about,
            signals: meta.signals.filter(isSignalType),
            demoFrom: meta.demoFrom ?? null,
            contents: builds.flatMap(build =>
                'content' in build ? [build.content] : []
            ),
        },
        errors: [
            ...duplicateKoErrors,
            ...builds.flatMap(build => ('error' in build ? [build.error] : [])),
        ],
        warnings: LOCALES.filter(
            locale => !group.some(file => file.locale === locale)
        ).map(locale => `${slug}: ${locale} 번역이 없다 (ko로 폴백)`),
    };
}

function relatedErrors(entries: readonly GuideSeedEntry[]): string[] {
    const knownSlugs = new Set(entries.map(entry => entry.slug));
    return entries.flatMap(entry =>
        entry.related.flatMap(related => {
            if (related === entry.slug) {
                return [`${entry.slug}: related에 자기 자신이 들어 있다`];
            }
            return knownSlugs.has(related)
                ? []
                : [`${entry.slug}: related(${related})가 존재하지 않는 slug다`];
        })
    );
}

/**
 * howto 제목이 자기 `about` 항목의 seoTitle 안에 들어 있으면 두 페이지가 같은 검색어를 두고 겹친다(카니발라이제이션).
 * 용어 쪽 seoTitle을 정의·계산 같은 다른 의도로 돌려야 한다.
 */
function cannibalizationErrors(entries: readonly GuideSeedEntry[]): string[] {
    const bySlug = new Map(entries.map(entry => [entry.slug, entry]));
    const koContent = (entry: GuideSeedEntry) =>
        entry.contents.find(content => content.locale === DEFAULT_LOCALE);
    return entries
        .filter(entry => entry.category === HOWTO_CATEGORY)
        .flatMap(entry => {
            const title = koContent(entry)?.title;
            if (title === undefined) return [];
            return entry.about.flatMap(slug => {
                const target = bySlug.get(slug);
                const seoTitle = target && koContent(target)?.seoTitle;
                return seoTitle?.includes(title)
                    ? [
                          `${entry.slug}: howto 제목 "${title}"이 about(${slug})의 seoTitle "${seoTitle}"에 들어 있다(검색어 겹침)`,
                      ]
                    : [];
            });
        });
}

/** `about`은 존재하는 비-howto slug만, `demoFrom`은 `about` 안의 slug만 허용한다. */
function aboutErrors(entries: readonly GuideSeedEntry[]): string[] {
    const bySlug = new Map(entries.map(entry => [entry.slug, entry]));
    return entries.flatMap(entry => {
        const aboutProblems = entry.about.flatMap(slug => {
            const target = bySlug.get(slug);
            if (target === undefined) {
                return [`${entry.slug}: about(${slug})가 존재하지 않는 slug다`];
            }
            if (target.category === HOWTO_CATEGORY) {
                return [
                    `${entry.slug}: about(${slug})가 howto다 — 용어 항목만 가리킨다`,
                ];
            }
            return [];
        });
        const termAboutProblems =
            entry.category !== HOWTO_CATEGORY && entry.about.length > 0
                ? [`${entry.slug}: 용어 항목은 about을 쓰지 않는다`]
                : [];
        const demoProblems =
            entry.demoFrom !== null && !entry.about.includes(entry.demoFrom)
                ? [`${entry.slug}: demoFrom(${entry.demoFrom})이 about에 없다`]
                : [];
        return [...termAboutProblems, ...aboutProblems, ...demoProblems];
    });
}

/**
 * 파싱된 파일 묶음을 항목 단위로 검증·조립한다. 에러는 모아서 한 번에 던진다.
 *
 * 에러: 카테고리 불일치, 알 수 없는 related, ko 누락, frontmatter 스키마 위반.
 * 경고: 번역 누락(읽기 경로가 ko로 폴백한다).
 */
export function buildGuideSeed(files: readonly ParsedGuideFile[]): GuideSeed {
    const builds = [...Map.groupBy(files, file => file.slug)].map(
        ([slug, group]) => buildEntry(slug, group)
    );
    const entries = builds.flatMap(build =>
        build.entry === null ? [] : [build.entry]
    );
    const errors = [
        ...builds.flatMap(build => build.errors),
        ...relatedErrors(entries),
        ...aboutErrors(entries),
        ...cannibalizationErrors(entries),
    ];

    if (errors.length > 0) {
        throw new Error(
            `guide seed 검증 실패 (${errors.length}건)\n- ${errors.join('\n- ')}`
        );
    }

    return { entries, warnings: builds.flatMap(build => build.warnings) };
}

/** 시드 디렉터리 전체를 읽어 검증한다. */
export async function loadGuideSeed(seedsRoot: string): Promise<GuideSeed> {
    const files = await glob('*/*/*.md', {
        cwd: seedsRoot,
        absolute: true,
    });
    return buildGuideSeed(files.toSorted().map(parseGuideFile));
}

/** DB에 이미 있는 행의 비교용 사본. */
export interface ExistingGuideEntry {
    readonly slug: string;
    readonly category: string;
    readonly sortOrder: number;
    readonly related: readonly string[];
    readonly skills: readonly string[];
    readonly about: readonly string[];
    readonly signals: readonly string[];
    readonly demoFrom: string | null;
}

export interface ExistingGuideContent {
    readonly slug: string;
    readonly locale: string;
    readonly contentHash: string;
}

export interface GuideSeedPlan {
    readonly entries: readonly GuideSeedEntry[];
    readonly contents: readonly GuideSeedContent[];
    /** DB에는 있는데 시드에는 없는 slug / (slug, locale). 지우지 않고 경고만 한다. */
    readonly orphans: readonly string[];
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** 바뀐 행만 골라낸다. 항목 행은 메타 비교, 본문 행은 content_hash 비교. */
export function planGuideUpsert(
    seed: GuideSeed,
    existingEntries: readonly ExistingGuideEntry[],
    existingContents: readonly ExistingGuideContent[]
): GuideSeedPlan {
    const entryBySlug = new Map(existingEntries.map(e => [e.slug, e]));
    const hashByKey = new Map(
        existingContents.map(c => [`${c.slug}:${c.locale}`, c.contentHash])
    );

    const entries = seed.entries.filter(entry => {
        const existing = entryBySlug.get(entry.slug);
        return (
            existing === undefined ||
            existing.category !== entry.category ||
            existing.sortOrder !== entry.order ||
            !sameList(existing.related, entry.related) ||
            !sameList(existing.skills, entry.skills) ||
            !sameList(existing.about, entry.about) ||
            !sameList(existing.signals, entry.signals) ||
            existing.demoFrom !== entry.demoFrom
        );
    });

    const seedContents = seed.entries.flatMap(entry => entry.contents);
    const contents = seedContents.filter(
        content =>
            hashByKey.get(`${content.slug}:${content.locale}`) !==
            content.contentHash
    );

    const seedSlugs = new Set(seed.entries.map(entry => entry.slug));
    const seedKeys = new Set(seedContents.map(c => `${c.slug}:${c.locale}`));
    const orphans = [
        ...existingEntries
            .filter(e => !seedSlugs.has(e.slug))
            .map(e => `entry ${e.slug}`),
        ...existingContents
            .filter(c => !seedKeys.has(`${c.slug}:${c.locale}`))
            .map(c => `content ${c.slug}:${c.locale}`),
    ];

    return { entries, contents, orphans };
}
