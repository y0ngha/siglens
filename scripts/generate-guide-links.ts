/**
 * 스킬 → 가이드 링크 맵 생성기.
 *
 * `skills/**\/*.md` frontmatter(`name`, `pattern`, `gating.triggers`)와
 * `db/seeds/guide/{category}/{slug}/ko.md`(`category`, `order`, `skills`)를 읽어
 * `src/shared/config/guideLinks.generated.ts`를 쓴다. 클라이언트 컴포넌트도 import하는
 * 순수 데이터라 DB를 읽지 않는다.
 *
 * `yarn guide:links`로 재생성한다. 가드 테스트
 * (`src/__tests__/guards/guideCoverage.test.ts`)가 생성물이 최신인지 확인한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import matter from 'gray-matter';
import { GUIDE_CATEGORIES, type GuideCategory } from '@/entities/guide/types';
import { guideEntryPath } from '@/shared/lib/guidePaths';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const SKILLS_DIR = join(REPO_ROOT, 'skills');
const GUIDE_SEEDS_DIR = join(REPO_ROOT, 'db/seeds/guide');
export const GUIDE_LINKS_OUTPUT = join(
    REPO_ROOT,
    'src/shared/config/guideLinks.generated.ts'
);

/** 가이드로 설명하는 스킬 디렉터리. */
export const GUIDE_COVERED_SKILL_DIRS = [
    'candlesticks',
    'patterns',
    'indicators',
    'strategies',
    'support-resistance',
] as const;

/**
 * 가이드 대상이 아닌 스킬 디렉터리.
 * - `_core`: 프롬프트 내부 primer·색인(`candle-primer`는 `candle-basics` 항목이 따로 다룬다).
 * - `fundamental`, `news`: 차트로 탐지하지 않는 분석 관점.
 */
export const GUIDE_EXCLUDED_SKILL_DIRS = [
    '_core',
    'fundamental',
    'news',
] as const;

/**
 * 가이드 항목이 아직 없는 스킬 파일 basename. 스킬 추가 PR이 가이드 작성에 막히지
 * 않도록 임시로 올리는 목록이다 — 항목을 쓰면 여기서 뺀다.
 */
export const GUIDE_PENDING_SKILLS: readonly string[] = [];

export interface GuideSeedMeta {
    readonly slug: string;
    readonly category: GuideCategory;
    readonly order: number;
    /** ko frontmatter에 `skills`가 있으면 그 값, 없으면 `null`(기본 `[slug]`). */
    readonly skills: readonly string[] | null;
}

export interface SkillMeta {
    /** 파일 basename(확장자 제외). 가이드 `skills`가 가리키는 값. */
    readonly basename: string;
    readonly dir: string;
    readonly name: string;
    /** `pattern` + `gating.triggers`. */
    readonly triggerIds: readonly string[];
}

export interface GuideLinks {
    readonly byName: Readonly<Record<string, string>>;
    readonly byTrigger: Readonly<Record<string, string>>;
    /** 같은 트리거를 서로 다른 경로가 주장한 경우(먼저 쓴 쪽이 이긴다). */
    readonly collisions: readonly string[];
}

/** 순수: 가이드 메타 + 스킬 메타 → 링크 맵. 순서는 카테고리 → order → slug로 고정한다. */
export function buildGuideLinks(
    guides: readonly GuideSeedMeta[],
    skills: readonly SkillMeta[]
): GuideLinks {
    const skillByBasename = new Map<string, SkillMeta>();
    for (const skill of skills) {
        if (skillByBasename.has(skill.basename)) {
            throw new Error(
                `스킬 basename이 겹친다: ${skill.basename} (${skillByBasename.get(skill.basename)!.dir}, ${skill.dir})`
            );
        }
        skillByBasename.set(skill.basename, skill);
    }

    const ordered = guides.toSorted(
        (a, b) =>
            GUIDE_CATEGORIES.indexOf(a.category) -
                GUIDE_CATEGORIES.indexOf(b.category) ||
            a.order - b.order ||
            a.slug.localeCompare(b.slug)
    );

    const byName: Record<string, string> = {};
    const byTrigger: Record<string, string> = {};
    const collisions: string[] = [];

    for (const guide of ordered) {
        const path = guideEntryPath(guide.category, guide.slug);
        const explicit = guide.skills !== null;
        for (const skillBasename of guide.skills ?? [guide.slug]) {
            const skill = skillByBasename.get(skillBasename);
            if (skill === undefined) {
                // 기본값(`[slug]`)은 같은 이름의 스킬이 없어도 된다(예: candle-basics).
                if (explicit) {
                    throw new Error(
                        `${guide.slug}: skills에 적은 ${skillBasename} 스킬 파일이 없다`
                    );
                }
                continue;
            }
            if (
                byName[skill.name] !== undefined &&
                byName[skill.name] !== path
            ) {
                collisions.push(
                    `name "${skill.name}": ${byName[skill.name]} 유지, ${path} 무시`
                );
            } else {
                byName[skill.name] = path;
            }
            for (const id of skill.triggerIds) {
                const existing = byTrigger[id];
                if (existing === undefined) {
                    byTrigger[id] = path;
                } else if (existing !== path) {
                    collisions.push(
                        `trigger "${id}": ${existing} 유지, ${path} 무시`
                    );
                }
            }
        }
    }

    return { byName, byTrigger, collisions };
}

const BARE_KEY = /^[\p{ID_Start}_$][\p{ID_Continue}$]*$/u;
const MAX_LINE = 80;
const WIDE_CHAR =
    /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/;

/** 포매터와 같게 한글·한자는 2칸으로 센다. */
function displayWidth(text: string): number {
    return [...text].reduce((sum, ch) => sum + (WIDE_CHAR.test(ch) ? 2 : 1), 0);
}

/** oxfmt(prettier 호환) 출력과 바이트 단위로 같게 렌더한다 — 가드가 문자열 동등을 비교한다. */
function renderRecord(
    name: string,
    record: Readonly<Record<string, string>>
): string {
    const keys = Object.keys(record);
    const lines = keys.map(key => {
        // oxfmt는 식별자로 쓸 수 있는 키(한글 포함)만 따옴표를 벗긴다.
        const renderedKey = BARE_KEY.test(key)
            ? key
            : `'${key.replace(/'/g, "\\'")}'`;
        const value = `'${record[key]}'`;
        const oneLine = `    ${renderedKey}: ${value},`;
        return displayWidth(oneLine) <= MAX_LINE
            ? oneLine
            : `    ${renderedKey}:\n        ${value},`;
    });
    const body = lines.length === 0 ? '' : `\n${lines.join('\n')}\n`;
    return `export const ${name}: Readonly<Record<string, string>> = {${body}};\n`;
}

export function renderGuideLinksSource(links: GuideLinks): string {
    return [
        '// 이 파일은 생성물이다. 직접 고치지 않는다.',
        '// 재생성: yarn guide:links  (scripts/generate-guide-links.ts)',
        '// 원천: skills/**/*.md frontmatter(name, pattern, gating.triggers) + db/seeds/guide/*/*/ko.md(category, skills)',
        '',
        '/** 스킬 frontmatter `name` → 가이드 경로. */',
        renderRecord('GUIDE_PATH_BY_SKILL_NAME', links.byName),
        '/** 탐지 id(`pattern`·`gating.triggers`) → 가이드 경로. 겹치면 카테고리 순서상 먼저 쓴 쪽이 이긴다. */',
        renderRecord('GUIDE_PATH_BY_TRIGGER', links.byTrigger),
    ].join('\n');
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : [];
}

export async function loadSkillMetas(
    skillsDir: string = SKILLS_DIR
): Promise<SkillMeta[]> {
    const files = await glob(`{${GUIDE_COVERED_SKILL_DIRS.join(',')}}/*.md`, {
        cwd: skillsDir,
        absolute: true,
    });
    return files.toSorted().map(file => {
        const data = matter(readFileSync(file, 'utf-8')).data;
        const gating = (data.gating ?? {}) as { triggers?: unknown };
        const pattern = typeof data.pattern === 'string' ? [data.pattern] : [];
        if (typeof data.name !== 'string') {
            throw new Error(`${file}: name이 없다`);
        }
        return {
            basename: basename(file, '.md'),
            dir: basename(dirname(file)),
            name: data.name,
            triggerIds: [...pattern, ...asStringArray(gating.triggers)],
        };
    });
}

export async function loadGuideMetas(
    seedsDir: string = GUIDE_SEEDS_DIR
): Promise<GuideSeedMeta[]> {
    const files = await glob('*/*/ko.md', { cwd: seedsDir, absolute: true });
    return files.toSorted().map(file => {
        const data = matter(readFileSync(file, 'utf-8')).data;
        const slug = basename(dirname(file));
        const category = data.category as GuideCategory;
        if (!GUIDE_CATEGORIES.includes(category)) {
            throw new Error(
                `${file}: category(${String(data.category)})가 올바르지 않다`
            );
        }
        if (typeof data.order !== 'number') {
            throw new Error(`${file}: order가 숫자가 아니다`);
        }
        return {
            slug,
            category,
            order: data.order,
            skills:
                data.skills === undefined ? null : asStringArray(data.skills),
        };
    });
}

/** 저장소의 실제 skills·시드로 생성물 본문과 충돌 목록을 만든다. */
export async function generateGuideLinks(): Promise<{
    source: string;
    links: GuideLinks;
}> {
    const [guides, skills] = await Promise.all([
        loadGuideMetas(),
        loadSkillMetas(),
    ]);
    const links = buildGuideLinks(guides, skills);
    return { source: renderGuideLinksSource(links), links };
}

async function main(): Promise<void> {
    const { source, links } = await generateGuideLinks();
    writeFileSync(GUIDE_LINKS_OUTPUT, source);
    for (const collision of links.collisions) {
        console.warn(`[guide:links] 충돌: ${collision}`);
    }
    console.log(
        `[guide:links] skill ${Object.keys(links.byName).length}개, trigger ${Object.keys(links.byTrigger).length}개 → ${GUIDE_LINKS_OUTPUT}`
    );
}

const executedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (executedDirectly) {
    main().catch((error: unknown) => {
        console.error(
            `[guide:links] 실패: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
    });
}
