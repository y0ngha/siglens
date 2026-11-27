import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '@/shared/i18n/locales';

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
 *
 * 코드에 하드코딩한 문구(로그, AI 프롬프트, 빈 값 기호 `–`)는 대상이 아니다. llms.txt 본문은
 * `src/app/api/llms/_lib/__tests__/llmsCopyRules.test.ts`가 따로 본다.
 */
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MESSAGES_DIR = path.join(ROOT_DIR, 'messages');
const GUIDE_DIR = path.join(ROOT_DIR, 'db/seeds/guide');
const TERMS_DIR = path.join(ROOT_DIR, 'db/seeds/terms');
const TERMS_KINDS = ['privacy', 'tos'] as const;

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
    if (LOCALES.includes(tag as Locale)) return tag as Locale;
    if (/^v\d+$/.test(name)) return 'ko';
    throw new Error(`로케일을 알 수 없는 파일: ${file}`);
}

function flattenValues(
    node: unknown,
    prefix: string,
    out: Array<{ key: string; value: string }>
): void {
    if (typeof node === 'string') {
        out.push({ key: prefix, value: node });
        return;
    }
    if (Array.isArray(node)) {
        node.forEach((item, index) =>
            flattenValues(item, `${prefix}[${index}]`, out)
        );
        return;
    }
    if (typeof node === 'object' && node !== null) {
        for (const [key, value] of Object.entries(node)) {
            flattenValues(value, prefix ? `${prefix}.${key}` : key, out);
        }
    }
}

function catalogEntries(locale: string): Array<{ key: string; value: string }> {
    const out: Array<{ key: string; value: string }> = [];
    flattenValues(
        JSON.parse(
            readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8')
        ),
        '',
        out
    );
    return out;
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
});
