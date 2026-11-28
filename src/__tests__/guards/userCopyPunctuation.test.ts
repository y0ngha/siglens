import { parse } from '@babel/parser';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, isLocale, type Locale } from '@/shared/i18n/locales';

/**
 * **사용자 카피 문장부호 가드.**
 *
 * 화면과 메일에 나가는 문구는 줄표(—), 문장부호로 쓴 en dash(–), 가운뎃점(·), 일본어 나카구로(・)를
 * 쓰지 않는다. 쉼표, "와/과", 괄호나 문장을 고쳐 잇는다. en dash는 en/zh의 숫자 범위(`0–9`, `25th–75th`,
 * `$1,001–$15,000`, `{v0}–{v1}`)에서만 허용한다. 영어와 중국어 범위 표기의 관례라서다. ko와 ja는 범위도
 * `~`/`〜`로 쓰므로 en dash가 하나라도 있으면 위반이다. 로케일은 카탈로그 파일, 가이드 파일 이름(`en.md`),
 * 약관 파일 이름(`vN.md`는 ko, `vN.en.md`)에서 읽는다.
 *
 * 대상은 사람이 읽는 카피 원본 전부다.
 * - `messages/{ko,en,ja,zh}.json`의 모든 값(배열 값은 원소마다)
 * - `db/seeds/guide/**` 아래 가이드 본문과 frontmatter
 * - 개인정보처리방침과 이용약관의 문서별 **가장 높은 버전**(게시 여부와 무관, 4개 로케일). 그보다 옛 버전은
 *   동결돼 고치지 않으므로 보지 않는다.
 * - `src/{widgets,views,app,features}`의 `.tsx`가 JSX로 그리는 하드코딩 문구: JSX 텍스트, 사람이 읽는 속성
 *   ({@link USER_VISIBLE_ATTRIBUTES})의 문자열, JSX 식(`{'…'}`, `{a ? '…' : '…'}`, 템플릿 리터럴)의 문자열, 그리고 JSX
 *   식이 이름으로 그리는 같은 파일의 `const` 문자열(`const period = \`…\``; `{period}`). 함수 호출의 인자(`t('key')`,
 *   포맷 인자)는 보지 않는다. 카탈로그를 거치지 않아 모든 로케일에 같은 글자가 나가므로 가장 엄격한 ko 규칙으로
 *   본다(범위 en dash도 위반). 값을 모르는 칸의 대시(문자열 전체가 `–` 하나)만 허용한다. 파서가 복구한 오류가 있는
 *   파일은 판정이 틀릴 수 있어 그 자체로 실패한다.
 *
 *   이 JSX 검사가 **보지 못하는 것**: 객체·배열 리터럴의 필드를 `map`으로 그리는 문구(`[{ label: '…' }].map(…)`),
 *   위 목록에 없는 카피 prop(`description="…"` 같은 컴포넌트 prop), 다른 파일에서 import한 상수, 함수가 만들어
 *   돌려주는 문자열. 이런 문구는 카탈로그로 옮기는 것이 원칙이고, 남은 것은 리뷰가 본다.
 *
 * 그 밖에 코드에 하드코딩한 문구(로그, AI 프롬프트)는 대상이 아니다. llms.txt 본문은
 * `src/app/api/llms/_lib/__tests__/llmsCopyRules.test.ts`가 따로 본다.
 */
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MESSAGES_DIR = path.join(ROOT_DIR, 'messages');
const GUIDE_DIR = path.join(ROOT_DIR, 'db/seeds/guide');
const TERMS_DIR = path.join(ROOT_DIR, 'db/seeds/terms');
const TERMS_KINDS = ['privacy', 'tos'] as const;
const JSX_COPY_DIRS = ['widgets', 'views', 'app', 'features'].map(dir =>
    path.join(ROOT_DIR, 'src', dir)
);

/** 어디에 있어도 위반인 문자. */
const ALWAYS_BANNED = /[—·・]/u;
/**
 * 숫자 범위의 en dash. 앞 토큰은 숫자나 `}`로 끝나는 자리(접미사 `th`, `%`, `x` 허용),
 * 뒤 토큰은 숫자, `{`, `$`로 시작한다. 공백은 양쪽에 하나까지.
 */
const RANGE_EN_DASH = /(?<=[\d}][\p{L}%]*) ?– ?(?=[\d{$])/gu;

interface Violation {
    readonly where: string;
    readonly text: string;
}

/** 숫자 범위에 en dash를 쓰는 로케일. */
const RANGE_DASH_LOCALES: ReadonlySet<Locale> = new Set(['en', 'zh']);

/**
 * 문자열 하나의 위반 여부. en/zh는 범위 en dash를 지운 뒤에도 금지 문자가 남으면 위반이고,
 * ko/ja는 en dash가 있기만 해도 위반이다.
 */
function hasBannedPunctuation(text: string, locale: Locale): boolean {
    if (ALWAYS_BANNED.test(text)) return true;
    const rest = RANGE_DASH_LOCALES.has(locale)
        ? text.replace(RANGE_EN_DASH, '~')
        : text;
    return rest.includes('–');
}

/** 가이드(`en.md`)와 약관(`v15.md`, `v15.en.md`) 파일 이름의 로케일. */
function localeOfFile(file: string): Locale {
    const name = path.basename(file, '.md');
    const tag = name.includes('.') ? name.split('.').at(-1) : name;
    if (tag !== undefined && isLocale(tag)) return tag;
    if (/^v\d+$/.test(name)) return 'ko';
    throw new Error(`로케일을 알 수 없는 파일: ${file}`);
}

interface CatalogEntry {
    readonly key: string;
    readonly value: string;
}

function flattenValues(node: unknown, prefix: string): CatalogEntry[] {
    if (typeof node === 'string') return [{ key: prefix, value: node }];
    if (Array.isArray(node)) {
        return node.flatMap((item, index) =>
            flattenValues(item, `${prefix}[${index}]`)
        );
    }
    if (typeof node === 'object' && node !== null) {
        return Object.entries(node).flatMap(([key, value]) =>
            flattenValues(value, prefix ? `${prefix}.${key}` : key)
        );
    }
    return [];
}

function catalogEntries(locale: Locale): CatalogEntry[] {
    return flattenValues(
        JSON.parse(
            readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8')
        ),
        ''
    );
}

function markdownFilesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return markdownFilesUnder(full);
        return entry.name.endsWith('.md') ? [full] : [];
    });
}

/** `vN.md`(ko)와 `vN.{en,ja,zh}.md` 중 가장 높은 N의 파일들. */
function latestTermsFiles(kind: (typeof TERMS_KINDS)[number]): string[] {
    const dir = path.join(TERMS_DIR, kind);
    const names = readdirSync(dir);
    const versions = names.flatMap(name => {
        const match = /^v(\d+)\.md$/.exec(name);
        return match?.[1] === undefined ? [] : [Number(match[1])];
    });
    const latest = Math.max(...versions);
    return LOCALES.map(locale =>
        path.join(
            dir,
            locale === 'ko' ? `v${latest}.md` : `v${latest}.${locale}.md`
        )
    );
}

function lineViolations(file: string): Violation[] {
    const relative = path.relative(ROOT_DIR, file);
    const locale = localeOfFile(file);
    return readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
            hasBannedPunctuation(line, locale)
                ? [{ where: `${relative}:${index + 1}`, text: line.trim() }]
                : []
        );
}

/** 화면이나 보조 기술이 사람에게 읽어 주는 JSX 속성. `className`·`href` 같은 값은 카피가 아니다. */
const USER_VISIBLE_ATTRIBUTES: ReadonlySet<string> = new Set([
    'alt',
    'aria-description',
    'aria-label',
    'aria-placeholder',
    'aria-roledescription',
    'aria-valuetext',
    'label',
    'placeholder',
    'title',
]);

/** 값을 모르는 칸에 두는 대시. 문자열 전체가 이 글자 하나일 때만 허용한다. */
const EMPTY_VALUE_DASH = '–';

/** 금지 문자가 하나도 없는 파일은 파싱하지 않는다. */
const ANY_BANNED = /[—–·・]/u;

interface AstNode {
    type: string;
    loc?: { start: { line: number } };
    [key: string]: unknown;
}

function isNode(value: unknown): value is AstNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { type?: unknown }).type === 'string'
    );
}

function childNodes(node: AstNode): AstNode[] {
    return Object.entries(node).flatMap(([key, value]) => {
        if (key === 'loc' || key.endsWith('Comments')) return [];
        if (Array.isArray(value)) return value.filter(isNode);
        return isNode(value) ? [value] : [];
    });
}

function walk(node: AstNode, visit: (node: AstNode) => void): void {
    visit(node);
    for (const child of childNodes(node)) walk(child, visit);
}

/** 같은 파일의 `const 이름 = 초기값` — 스코프는 가리지 않는다(같은 이름이면 모두 본다). */
function constInitializers(program: AstNode): Map<string, AstNode[]> {
    const out = new Map<string, AstNode[]>();
    walk(program, node => {
        if (node.type !== 'VariableDeclarator') return;
        const id = node.id as AstNode;
        const init = node.init;
        if (id.type !== 'Identifier' || !isNode(init)) return;
        const name = id.name as string;
        out.set(name, [...(out.get(name) ?? []), init]);
    });
    return out;
}

interface RenderedString {
    readonly line: number;
    readonly text: string;
}

/**
 * JSX 식이 그대로 그리는 문자열. 분기·연결·괄호·타입 단언은 따라가고, 이름은 같은 파일의 `const` 초기값으로 한 번
 * 따라간다. 함수 호출과 그 인자는 그리는 값이 아니라서(번역 키·포맷 인자) 보지 않는다.
 */
function renderedStrings(
    node: AstNode,
    consts: ReadonlyMap<string, AstNode[]>,
    followNames = true
): RenderedString[] {
    const line = node.loc?.start.line ?? 0;
    const inner = (child: unknown): RenderedString[] =>
        isNode(child) ? renderedStrings(child, consts, followNames) : [];
    switch (node.type) {
        case 'StringLiteral':
            return [{ line, text: node.value as string }];
        case 'TemplateLiteral':
            return [
                {
                    line,
                    text: (node.quasis as AstNode[])
                        .map(q => (q.value as { cooked?: string }).cooked ?? '')
                        .join('{}'),
                },
            ];
        case 'ConditionalExpression':
            return [...inner(node.consequent), ...inner(node.alternate)];
        case 'LogicalExpression':
        case 'BinaryExpression':
            return [...inner(node.left), ...inner(node.right)];
        case 'ParenthesizedExpression':
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression':
            return inner(node.expression);
        case 'Identifier':
            return followNames
                ? (consts.get(node.name as string) ?? []).flatMap(init =>
                      renderedStrings(init, consts, false)
                  )
                : [];
        default:
            return [];
    }
}

/** 파일 하나가 JSX로 그리는 하드코딩 문구. */
function jsxCopyStrings(source: string): RenderedString[] {
    const file = parse(source, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: ['typescript', 'jsx'],
    });
    // 복구된 구문 오류가 있으면 AST가 소스와 어긋나 위반을 놓칠 수 있다 — 조용히 넘기지 않는다.
    if (file.errors !== undefined && file.errors.length > 0)
        throw new Error(
            `파싱 오류: ${file.errors.map(e => e.message).join('; ')}`
        );
    const program = file.program as unknown as AstNode;
    const consts = constInitializers(program);
    const out: RenderedString[] = [];
    walk(program, node => {
        const line = node.loc?.start.line ?? 0;
        if (node.type === 'JSXText') {
            out.push({ line, text: (node.value as string).trim() });
            return;
        }
        if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
            for (const child of node.children as AstNode[]) {
                if (child.type === 'JSXExpressionContainer')
                    out.push(
                        ...renderedStrings(child.expression as AstNode, consts)
                    );
            }
            return;
        }
        if (node.type === 'JSXAttribute') {
            const name = node.name as AstNode;
            const value = node.value;
            if (
                name.type !== 'JSXIdentifier' ||
                !USER_VISIBLE_ATTRIBUTES.has(name.name as string) ||
                !isNode(value)
            )
                return;
            out.push(
                ...renderedStrings(
                    value.type === 'JSXExpressionContainer'
                        ? (value.expression as AstNode)
                        : value,
                    consts
                )
            );
        }
    });
    return out;
}

/** 하드코딩 JSX 문구의 위반 — 모든 로케일에 나가므로 ko 규칙, 값 모름 대시 하나만 허용. */
function jsxCopyViolations(source: string): RenderedString[] {
    if (!ANY_BANNED.test(source)) return [];
    return jsxCopyStrings(source).filter(
        ({ text }) =>
            text.trim() !== EMPTY_VALUE_DASH && hasBannedPunctuation(text, 'ko')
    );
}

/** 파싱 오류에 파일 경로를 붙인다. */
function jsxCopyViolationsIn(file: string, source: string): RenderedString[] {
    try {
        return jsxCopyViolations(source);
    } catch (error) {
        throw new Error(`${path.relative(ROOT_DIR, file)}: ${String(error)}`, {
            cause: error,
        });
    }
}

function tsxFilesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            return entry.name === '__tests__' ? [] : tsxFilesUnder(full);
        return entry.name.endsWith('.tsx') &&
            !/\.(test|spec|stories)\.tsx$/.test(entry.name)
            ? [full]
            : [];
    });
}

describe('사용자 카피 문장부호', () => {
    describe('판정 규칙', () => {
        it.each(LOCALES)(
            '금지(%s): 줄표, 가운뎃점, 나카구로, 문장부호 en dash',
            locale => {
                for (const text of [
                    '진입 구간·목표가',
                    'SIGLENS — AI',
                    '保存・送信',
                    'Price – Volume',
                    '{name} –',
                ]) {
                    expect(hasBannedPunctuation(text, locale)).toBe(true);
                }
            }
        );

        it.each(['en', 'zh'] as const)(
            '허용(%s): 숫자 범위 en dash',
            locale => {
                for (const text of [
                    '0–9',
                    '(0–9)',
                    '25th–75th percentile',
                    '$1,001–$15,000',
                    '{v0}–{v1}',
                    '2–3x',
                    '10 – 30',
                    '0~100',
                ]) {
                    expect(hasBannedPunctuation(text, locale)).toBe(false);
                }
            }
        );

        it.each(['ko', 'ja'] as const)(
            '금지(%s): 숫자 범위도 en dash 대신 ~ 또는 〜',
            locale => {
                for (const text of ['0–9', '{v0}–{v1}', '$1,001–$15,000']) {
                    expect(hasBannedPunctuation(text, locale)).toBe(true);
                }
                expect(hasBannedPunctuation('0~9', locale)).toBe(false);
                expect(hasBannedPunctuation('10〜30', locale)).toBe(false);
            }
        );

        it.each([
            ['JSX 텍스트', '<p>A · B</p>'],
            ['속성', '<img alt="A — B" />'],
            ['속성 식', "<a title={'A · B'} />"],
            ['식 문자열', "<p>{ok ? 'A' : 'A — B'}</p>"],
            ['템플릿 리터럴', '<p>{`${a} – ${b}`}</p>'],
            [
                '이름으로 그린 const',
                'const p = `${a} – ${b}`;\nconst X = () => <p>{p}</p>;',
            ],
            ['ko 규칙: 숫자 범위 en dash', '<p>0–9</p>'],
        ])('JSX 금지: %s', (_label, source) => {
            expect(jsxCopyViolations(source)).toHaveLength(1);
        });

        it.each([
            ['값 모름 대시 텍스트', '<span>–</span>'],
            [
                '값 모름 대시 const',
                "const U = '–';\nconst X = () => <p>{v ?? U}</p>;",
            ],
            ['함수 인자', "<p>{format(d, 'A · B')}</p>"],
            ['카피가 아닌 속성', '<div className="a·b" />'],
            ['JSX 밖 문자열', "console.log('A — B');"],
            ['물결 범위', '<p>{`${a}~${b}`}</p>'],
        ])('JSX 허용: %s', (_label, source) => {
            expect(jsxCopyViolations(source)).toEqual([]);
        });

        it('파서가 복구한 오류가 있는 파일은 통과시키지 않는다', () => {
            // 같은 이름을 두 번 선언하면 babel이 오류를 기록하고 계속 읽는다(복구된 오류).
            expect(() =>
                jsxCopyViolations(
                    'let a = 1;\nlet a = 2;\nconst X = () => <p>A · B</p>;'
                )
            ).toThrow(/파싱 오류/);
        });

        it.each([
            ['db/seeds/guide/patterns/x/ko.md', 'ko'],
            ['db/seeds/guide/patterns/x/en.md', 'en'],
            ['db/seeds/terms/privacy/v15.md', 'ko'],
            ['db/seeds/terms/privacy/v15.ja.md', 'ja'],
            ['db/seeds/terms/tos/v2.zh.md', 'zh'],
        ] as const)('파일 로케일: %s → %s', (file, locale) => {
            expect(localeOfFile(file)).toBe(locale);
        });
    });

    it.each(LOCALES)('messages/%s.json 값에 없다', locale => {
        const entries = catalogEntries(locale);
        expect(entries.length).toBeGreaterThan(1000);

        const violations = entries
            .filter(entry => hasBannedPunctuation(entry.value, locale))
            .map(entry => ({ where: entry.key, text: entry.value }));
        expect(violations).toEqual([]);
    });

    it('가이드 본문과 frontmatter에 없다', () => {
        const files = markdownFilesUnder(GUIDE_DIR);
        expect(files.length).toBeGreaterThan(100);

        expect(files.flatMap(lineViolations)).toEqual([]);
    });

    it.each(TERMS_KINDS)('%s 최신 버전(4개 로케일)에 없다', kind => {
        const files = latestTermsFiles(kind);
        for (const file of files) {
            expect(readFileSync(file, 'utf8').length).toBeGreaterThan(0);
        }

        expect(files.flatMap(lineViolations)).toEqual([]);
    });

    it('src/{widgets,views,app,features}의 JSX 하드코딩 문구에 없다', () => {
        const files = JSX_COPY_DIRS.flatMap(tsxFilesUnder);
        expect(files.length).toBeGreaterThan(500);

        const violations = files.flatMap(file =>
            jsxCopyViolationsIn(file, readFileSync(file, 'utf8')).map(
                ({ line, text }) => ({
                    where: `${path.relative(ROOT_DIR, file)}:${line}`,
                    text,
                })
            )
        );
        expect(violations).toEqual([]);
    });
});
