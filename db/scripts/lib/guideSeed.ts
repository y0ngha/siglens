import path from 'path';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';
import { z } from 'zod';
import {
    GUIDE_CATEGORIES,
    type GuideCategory,
    type GuideFaqItem,
} from '@/entities/guide/types';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * `db/seeds/guide/{category}/{slug}/{locale}.md`를 읽어 검증하는 **순수 파서/검증기**.
 *
 * DB에는 닿지 않는다(적재는 `seedGuide.ts`). 규칙: ko 원문은 필수이고, 번역이 없으면
 * 에러가 아니라 경고다(읽기 경로가 요청 로케일 행이 없을 때 ko로 폴백한다).
 */

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
            skills: meta.skills ?? [slug],
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
            !sameList(existing.skills, entry.skills)
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
