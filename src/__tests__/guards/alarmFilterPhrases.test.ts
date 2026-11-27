import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    accountCallSites,
    cronNames,
    parseFilterPatterns,
    stripComments,
    type FilterPattern,
    type SourceLang,
} from './support/alarmFilterParse';
import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';

/**
 * **알람 필터 문구 존재 가드** (`docs/conventions/TOOLCHAIN.md#TC-38`).
 *
 * CloudWatch metric filter(`infra/aws/*.sh`)는 `console.*`가 찍는 문구를 글자 그대로 매치한다.
 * 코드와 필터 사이에 연결이 없어서, 로그 문구를 고치면 알람이 아무 신호 없이 죽는다.
 * 2026-11-20 감사에서 `siglens-market-data-loader-failed`의 `[MarketContent:kr]`가 이미 죽어 있었다
 * (코드는 `[MarketContent] ...`만 남겼다). 알람 문구를 상수로 빼는 대신 이 가드가 연결이다.
 *
 * 필터 패턴 리터럴을 전부 파싱해, 각 따옴표 용어가 로그를 남기는 소스(`src` 비테스트,
 * `scripts`, `cache-handler`, 필터 선언 밖의 `infra`, 설치된 core `dist`)의 **문자열·템플릿
 * 리터럴 안에** 있는지 확인한다. 주석은 소스가 아니다(주석에만 남은 문구는 죽은 문구다).
 * 템플릿 리터럴이 만드는 문구는 `matchesTemplate`의 엄격한 규칙으로만 매치한다. 소스가 아닌
 * 곳에서 만들어지는 문구는 아래 허용 목록에 이유와 함께 둔다. JSON 패턴(`{ $.field = ... }`)은
 * 개수만 센다.
 */
const REPO_ROOT = path.resolve(__dirname, '../../..');
const INFRA_DIR = path.join(REPO_ROOT, 'infra/aws');

/** 소스가 아닌 곳이 만드는 문구. 이유를 한 줄씩 적는다. */
const EXTERNAL_PHRASES: Readonly<Record<string, string>> = {
    'JavaScript heap out of memory':
        'V8/Node 런타임이 OOM 종료 직전에 stderr로 찍는다',
};

/** 파서가 읽어야 하는 최소 패턴 수. 파서가 0개를 내는 회귀를 막는다(2026-11-20 실측: 61). */
const MIN_PATTERN_COUNT = 61;

/**
 * 슬롯 값에서 끝나는 문구를 허용하는 용어(마지막 고정 조각에 닿지 않는다). 이유를 한 줄씩 적는다.
 * 슬롯 값 자체는 여전히 소스에 정확히 있는 리터럴이어야 한다.
 */
const SLOT_END_TERMS: Readonly<Record<string, string>> = {
    '[dart-filings] auth_failed':
        '`[dart-filings] ${ctx.stop} — ...`(dartRunContext.ts)의 stop 값. 필터는 em dash 앞까지만 ASCII로 쓴다',
};

/** 템플릿으로 인정하려면 고정 글자(단어 문자)가 이만큼은 있어야 한다. */
const MIN_TEMPLATE_WORD_CHARS = 6;

/** 슬롯 값이 다시 템플릿인 경우를 따라가는 깊이 상한. */
const MAX_TEMPLATE_DEPTH = 3;

/** `${...}` 슬롯에 들어갈 수 있는 값의 모양. 공백·괄호가 든 값은 문구 조각이 아니다. */
const SLOT_VALUE = /^[\w:-]+$/;

interface SourceText {
    readonly text: string;
    readonly lang: SourceLang;
}

/**
 * 소스 문구 모음. `text`는 모든 문자열·템플릿 리터럴의 내용을 이어 붙인 것, `exact`는 리터럴
 * 내용 전체(슬롯 값의 근거), `templates`는 `${}`로 쪼갠 고정 조각들이다.
 */
interface Corpus {
    readonly text: string;
    readonly exact: ReadonlySet<string>;
    readonly templates: readonly (readonly string[])[];
}

const TEMPLATE_SLOT = /\$\{[^}]*\}/;

/**
 * 같은 파일의 `const NAME = '...'`. 템플릿의 `${NAME}` 슬롯을 값으로 풀어 근거로 쓴다
 * (`const LOG_TAG = '[xPosts]'` 뒤의 `${LOG_TAG} daily read budget exhausted`).
 */
const CONST_STRING =
    /\bconst\s+(\w+)\s*(?::\s*string\s*)?=\s*(?:'([^'\n]*)'|"([^"\n]*)")/g;

/** 주석을 뺀 소스의 문자열·템플릿 리터럴 내용(따옴표 제외). */
function stringLiterals(text: string, lang: SourceLang): string[] {
    const code = stripComments(text, lang);
    const token =
        lang === 'sh'
            ? /'([^']*)'|"((?:[^"\\]|\\.)*)"/g
            : /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\[\s\S])*)`/g;
    const consts = new Map(
        lang === 'js'
            ? [...code.matchAll(CONST_STRING)].map(
                  m => [m[1], m[2] ?? m[3]] as const
              )
            : []
    );
    return [...code.matchAll(token)].map(m =>
        (m[1] ?? m[2] ?? m[3] ?? '').replace(
            /\$\{(\w+)\}/g,
            (whole, name: string) => consts.get(name) ?? whole
        )
    );
}

/* ------------------------------------------------------------------ */
/* 소스 문구 모음과 매처                                                  */
/* ------------------------------------------------------------------ */

function buildCorpus(sources: readonly SourceText[]): Corpus {
    const literals = sources.flatMap(s => stringLiterals(s.text, s.lang));
    const templates = literals
        .filter(l => TEMPLATE_SLOT.test(l))
        .map(l => l.split(new RegExp(TEMPLATE_SLOT.source, 'g')))
        .filter(
            parts =>
                parts[0].length > 0 &&
                parts.join('').replace(/\W/g, '').length >=
                    MIN_TEMPLATE_WORD_CHARS
        );
    return {
        text: literals.join('\u0000'),
        exact: new Set(literals.filter(l => !TEMPLATE_SLOT.test(l))),
        templates,
    };
}

/**
 * 용어가 템플릿 리터럴(고정 조각 `parts`, 사이는 `${}` 슬롯)이 만들 수 있는 문구인가.
 *
 * 규칙(임의 절단 금지):
 * - 용어는 템플릿의 고정 조각을 **순서대로** 소비한다. 첫 조각은 비어 있지 않아야 하고 용어가
 *   그것으로 시작해야 한다(슬롯으로 시작하는 템플릿은 아무 문구에나 맞는다).
 * - `L`은 단어 문자가 있는 마지막 고정 조각이다. 용어는 `L`에 **한 글자 이상 닿아야** 한다:
 *   `L`을 통째로 소비한 뒤 끝나거나(그 뒤 조각이 `:`·공백뿐인 꼬리 데이터이거나 뒤 슬롯 값 하나),
 *   `L`의 **고정 글자 안에서** 끝나야 한다. `L` 앞 조각에서, 또는 슬롯 안에서 끝나면 안 된다.
 * - (`allowSlotEnd`, `SLOT_END_TERMS`의 용어만) 슬롯 값에서 정확히 끝나도 된다.
 * - 슬롯 값은 `[\w:-]+`이고, 소스에 따옴표 리터럴로 정확히 있거나(`'kr'`, `"sec-13f"`)
 *   그 값 자체가 다시 이 규칙을 만족하는 템플릿 문구여야 한다. 문서 어디에 부분 문자열로
 *   있다는 것만으로는 근거가 아니다.
 */
function matchesTemplate(
    term: string,
    parts: readonly string[],
    corpus: Corpus,
    depth: number,
    allowSlotEnd = false
): boolean {
    const first = parts[0];
    if (first === '' || !term.startsWith(first)) return false;
    const last = parts.reduce(
        (found, piece, i) => (/\w/.test(piece) ? i : found),
        -1
    );
    if (last < 0) return false;
    const justified = (value: string): boolean =>
        SLOT_VALUE.test(value) &&
        (corpus.exact.has(value) ||
            (depth < MAX_TEMPLATE_DEPTH &&
                corpus.templates.some(t =>
                    matchesTemplate(value, t, corpus, depth + 1)
                )));
    const hasTrailingSlot = last < parts.length - 1;
    /** 조각 `last`를 통째로 소비한 뒤 남은 `rest`가 허용되는가. */
    const restOk = (rest: string): boolean =>
        rest === '' || (hasTrailingSlot && justified(rest));

    if (last === 0) return restOk(term.slice(first.length));

    const walk = (pos: number, i: number): boolean =>
        Array.from({ length: term.length - pos }, (_, k) => pos + 1 + k).some(
            end => {
                if (!justified(term.slice(pos, end))) return false;
                const piece = parts[i];
                const rest = term.slice(end);
                if (allowSlotEnd && rest === '') return true;
                if (piece !== '' && rest.startsWith(piece)) {
                    return i === last
                        ? restOk(rest.slice(piece.length))
                        : walk(end + piece.length, i + 1);
                }
                // `L`의 고정 글자 안에서 끝나는 앞부분 일치.
                return i === last && rest !== '' && piece.startsWith(rest);
            }
        );
    return walk(first.length, 1);
}

interface Evidence {
    readonly literal: boolean;
    readonly templates: readonly (readonly string[])[];
}

function evidenceFor(term: string, corpus: Corpus): Evidence {
    return {
        literal: corpus.text.includes(term),
        templates: corpus.templates.filter(t =>
            matchesTemplate(term, t, corpus, 0, term in SLOT_END_TERMS)
        ),
    };
}

/** 소스에서 찾을 수 없고 허용 목록에도 없는 용어. */
function findDeadTerms(
    patterns: readonly FilterPattern[],
    corpus: Corpus,
    external: Readonly<Record<string, string>> = EXTERNAL_PHRASES
): string[] {
    const terms = [...new Set(patterns.flatMap(p => p.terms))];
    return terms.filter(t => {
        if (t in external) return false;
        if (corpus.text.includes(t)) return false;
        return !corpus.templates.some(parts =>
            matchesTemplate(t, parts, corpus, 0, t in SLOT_END_TERMS)
        );
    });
}

/** 용어를 지탱하는 리터럴·템플릿을 사본에서 걷어 낸다(코드를 그 문구에서 바꾼 것과 같다). */
function withoutEvidence(term: string, corpus: Corpus): Corpus {
    const { templates } = evidenceFor(term, corpus);
    return {
        text: corpus.text.replaceAll(term, ''),
        exact: corpus.exact,
        templates: corpus.templates.filter(t => !templates.includes(t)),
    };
}

/* ------------------------------------------------------------------ */
/* 실제 저장소 입력                                                       */
/* ------------------------------------------------------------------ */

function isTestFile(file: string): boolean {
    return /[\\/]__tests__[\\/]|\.test\.tsx?$|\.spec\.ts$/.test(file);
}

const shellScripts = () =>
    readdirSync(INFRA_DIR)
        .filter(name => name.endsWith('.sh'))
        .map(name => ({
            file: name,
            text: readFileSync(path.join(INFRA_DIR, name), 'utf8'),
        }));

/** 필터를 선언하는 스크립트는 문구를 자기 안에 갖고 있어 자기 자신이 증거가 되면 안 된다. */
function realCorpus(declaring: ReadonlySet<string>): Corpus {
    const core = path.join(REPO_ROOT, 'node_modules/@y0ngha/siglens-core/dist');
    const jsFiles = [
        ...sourceFiles(path.join(REPO_ROOT, 'src'), ['.ts', '.tsx']).filter(
            f => !isTestFile(f)
        ),
        ...sourceFiles(path.join(REPO_ROOT, 'scripts'), [
            '.ts',
            '.mts',
            '.mjs',
            '.js',
        ]),
        // ISR 캐시 핸들러(`[isr-cache] ...`)는 Next 밖의 .mjs다.
        ...sourceFiles(path.join(REPO_ROOT, 'cache-handler'), ['.mjs']).filter(
            f => !isTestFile(f)
        ),
        ...(existsSync(core) ? sourceFiles(core, ['.js']) : []),
    ].map((f): SourceText => ({ text: readFileSync(f, 'utf8'), lang: 'js' }));
    const shFiles = readdirSync(INFRA_DIR)
        .filter(n => n.endsWith('.sh') && !declaring.has(n))
        .map((n): SourceText => ({
            text: readFileSync(path.join(INFRA_DIR, n), 'utf8'),
            lang: 'sh',
        }));
    return buildCorpus([...jsFiles, ...shFiles]);
}

/** 용어의 마지막 글자와 가운데 글자를 각각 바꾼 변형(코드가 문구를 다시 쓴 것과 같다). */
function reworded(term: string): string[] {
    const swap = (i: number) =>
        `${term.slice(0, i)}${term[i] === 'Q' ? 'Z' : 'Q'}${term.slice(i + 1)}`;
    return [swap(term.length - 1), swap(Math.floor(term.length / 2))];
}

describe('알람 필터 문구가 소스에 존재한다', () => {
    const scripts = shellScripts();
    const patterns = parseFilterPatterns(scripts);
    const declaring = new Set(patterns.map(p => p.file));
    const terms = [...new Set(patterns.flatMap(p => p.terms))];
    const corpus = realCorpus(declaring);

    it('파서가 기대한 수 이상의 패턴을 찾는다', () => {
        expect(patterns.length).toBeGreaterThanOrEqual(MIN_PATTERN_COUNT);
        expect(patterns.filter(p => p.kind === 'json').length).toBe(2);
    });

    it('필터 호출처가 하나도 파서 밖에 있지 않다(회계)', () => {
        const acct = accountCallSites(scripts);
        expect(acct.unparsed).toEqual([]);
        // 리터럴 호출처 + `$` 변수를 넘기는 헬퍼 정의 줄 = 모든 후보 줄.
        expect(acct.literal).toBeGreaterThan(0);
        expect(acct.forwarding).toBeGreaterThan(0);
        // lib-cron의 `${name}` 템플릿 호출처는 크론 이름 수만큼 확장돼야 한다.
        expect(cronNames(scripts).length).toBeGreaterThan(0);
        expect(acct.templated).toBe(3);
        expect(patterns.length).toBe(
            acct.literal -
                acct.templated +
                acct.templated * cronNames(scripts).length
        );
    });

    it('필터 용어는 전부 ASCII다(CloudWatch는 non-ASCII를 매치하지 못한다)', () => {
        expect(terms.filter(t => /[^\x20-\x7e]/.test(t))).toEqual([]);
    });

    it(
        '모든 필터 용어가 로그를 남기는 소스에 있다',
        () => {
            // 실패하면 expect가 죽은 용어 목록을 그대로 보여 준다.
            expect(findDeadTerms(patterns, corpus)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '실제 용어마다 근거를 걷어 내면 그 용어가 죽은 것으로 잡힌다(생존 0)',
        () => {
            const survivors = terms
                .filter(t => !(t in EXTERNAL_PHRASES))
                .filter(
                    t =>
                        findDeadTerms(
                            [{ file: 'x', kind: 'terms', terms: [t] }],
                            withoutEvidence(t, corpus)
                        ).length === 0
                );
            expect(survivors).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '실제 용어의 문구를 바꾼 변형은 하나도 소스에서 살아남지 않는다(생존 0)',
        () => {
            const survivors = terms
                .filter(t => !(t in EXTERNAL_PHRASES))
                .flatMap(t => reworded(t))
                .filter(
                    t =>
                        findDeadTerms(
                            [{ file: 'x', kind: 'terms', terms: [t] }],
                            corpus
                        ).length === 0
                );
            expect(survivors).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '리터럴로 매치한 용어와 템플릿으로만 매치한 용어를 구분해 센다',
        () => {
            const byTemplateOnly = terms
                .filter(t => !(t in EXTERNAL_PHRASES))
                .filter(t => {
                    const ev = evidenceFor(t, corpus);
                    return !ev.literal && ev.templates.length > 0;
                });
            // 템플릿 근거에만 기대는 용어는 로그 접두가 변수인 것들뿐이어야 한다.
            expect(byTemplateOnly.length).toBeLessThan(terms.length / 2);
            expect(byTemplateOnly.every(t => t.startsWith('['))).toBe(true);
        },
        SCAN_TIMEOUT_MS
    );

    it('허용 목록 문구는 어떤 필터에서든 실제로 쓰인다', () => {
        const used = new Set(terms);
        expect(Object.keys(EXTERNAL_PHRASES).filter(t => !used.has(t))).toEqual(
            []
        );
    });
});

describe('주석 제거', () => {
    it('문자열 안의 URL(`//`)은 지우지 않고 코드 뒤 주석은 지운다', () => {
        const code = stripComments(
            `const u = "http://x.test/a"; // [gone] note\nconst k = 1;`,
            'js'
        );
        expect(code).toContain('"http://x.test/a"');
        expect(code).not.toContain('[gone]');
        expect(code).toContain('const k = 1;');
    });

    it('템플릿 리터럴 안의 `/*`는 주석을 열지 않는다', () => {
        const code = stripComments(
            'const t = `a /* keep ${x} */ b`; /* [gone] */ f();',
            'js'
        );
        expect(code).toContain('`a /* keep ${x} */ b`');
        expect(code).not.toContain('[gone]');
        expect(code).toContain('f();');
    });

    it('주석 안의 따옴표는 문자열을 열지 않는다', () => {
        const code = stripComments(`// don't\nconst a = 'real';`, 'js');
        expect(stringLiterals(code, 'js')).toEqual(['real']);
    });

    it('JSDoc 블록 주석을 지운다', () => {
        const lits = stringLiterals(
            `/**\n * "[doc only] phrase"\n */\nconst a = '[live] phrase';`,
            'js'
        );
        expect(lits).toEqual(['[live] phrase']);
    });

    it('셸: 따옴표 안의 `#`은 남기고 주석은 지운다', () => {
        const lits = stringLiterals(
            `say "[a] #not-comment" # "[gone] c"\n# "[gone2] d"\nsay '[b] x'`,
            'sh'
        );
        expect(lits).toEqual(['[a] #not-comment', '[b] x']);
    });
});

describe('가드 로직 반증', () => {
    const scripts = [
        {
            file: 'a.sh',
            text: [
                `put_alert_filter n1 '?"[x] one failed" ?"[y] two"' P2 20`,
                `put_signal_filter cron suf "\\"[\${name}] lease held\\"" 20`,
                `ensure_investor_flows_cron job1 "cron(0)" 50`,
                `aws logs put-metric-filter --filter-pattern '{ $.tag = "[U]" }'`,
                `# put_alert_filter n2 '"[commented] out"' P2 1`,
                `aws logs put-metric-filter --filter-name f \\`,
                `  --filter-pattern '"[cont] line"'`,
            ].join('\n'),
        },
    ];

    const corpusOf = (code: string) =>
        buildCorpus([{ text: code, lang: 'js' }]);

    it('인용부호·OR·템플릿·JSON·줄 이음 호출 형태를 모두 읽는다', () => {
        const parsed = parseFilterPatterns(scripts);
        expect(parsed.flatMap(p => p.terms)).toEqual([
            '[x] one failed',
            '[y] two',
            '[job1] lease held',
            '[cont] line',
        ]);
        expect(parsed.filter(p => p.kind === 'json')).toHaveLength(1);
    });

    it('회계가 인식하지 못한 새 호출 형태를 이름 붙여 잡는다', () => {
        expect(accountCallSites(scripts).unparsed).toEqual([]);
        const bad = [
            ...scripts,
            { file: 'b.sh', text: `put_alert_filter onlyname\n` },
        ];
        expect(accountCallSites(bad).unparsed).toEqual([
            'b.sh: put_alert_filter onlyname',
        ]);
    });

    it('소스에 없는 문구를 죽은 용어로 보고한다', () => {
        const parsed = parseFilterPatterns(scripts);
        const corpus = corpusOf(
            `const n = "job1"; log("[x] one failed"); log("[cont] line"); log(\`[\${n}] lease held\`);`
        );
        expect(findDeadTerms(parsed, corpus, {})).toEqual(['[y] two']);
    });

    it('주석에만 있는 문구는 죽은 용어다', () => {
        const parsed = parseFilterPatterns(scripts);
        const corpus = corpusOf(
            `const n = "job1"; // "[y] two"\n/* "[x] one failed" "[cont] line" */ log(\`[\${n}] lease held\`);`
        );
        expect(findDeadTerms(parsed, corpus, {}).sort()).toEqual(
            ['[cont] line', '[x] one failed', '[y] two'].sort()
        );
    });

    it('변조한 사본에서는 가드 로직이 실패한다', () => {
        const parsed = parseFilterPatterns(scripts);
        const mutated = parsed.map(p => ({
            ...p,
            terms: p.terms.map(t =>
                t === '[x] one failed' ? '[x] one faild' : t
            ),
        }));
        const corpus = corpusOf(
            `const n = "job1"; log("[x] one failed"); log("[y] two"); log("[cont] line"); log(\`[\${n}] lease held\`);`
        );
        expect(findDeadTerms(parsed, corpus, {})).toEqual([]);
        expect(findDeadTerms(mutated, corpus, {})).toEqual(['[x] one faild']);
    });

    describe('템플릿 매치 규칙', () => {
        const generic = corpusOf(
            'const a = "sec-13f"; log(`[${source}] ${label} mapping failed:`, e);'
        );
        const dead = (term: string, c: Corpus = generic) =>
            findDeadTerms([{ file: 'x', kind: 'terms', terms: [term] }], c, {});

        it('마지막 고정 조각까지 닿는 문구만 통과한다', () => {
            expect(dead('[sec-13f] whatever')).toEqual(['[sec-13f] whatever']);
            expect(dead('[sec-13f] ')).toEqual(['[sec-13f] ']);
        });

        it('슬롯 값이 근거 리터럴일 때만 통과한다', () => {
            const ok = corpusOf(
                'const a = "sec-13f"; const b = "dart"; log(`[${s}] ${l} mapping failed:`, e);'
            );
            expect(dead('[sec-13f] dart mapping failed', ok)).toEqual([]);
            expect(dead('[sec-13f] dart mapping faile', ok)).toEqual([]);
            expect(dead('[nope] dart mapping failed', ok)).toEqual([
                '[nope] dart mapping failed',
            ]);
            expect(dead('[sec-13f] a b mapping failed', ok)).toEqual([
                '[sec-13f] a b mapping failed',
            ]);
        });

        it('고정 조각에서 어긋나는 문구는 죽은 용어다', () => {
            const ok = corpusOf(
                'const a = "sec-13f"; const b = "dart"; log(`[${s}] ${l} mapping failed:`, e);'
            );
            expect(dead('[sec-13f] dart mapping fail!', ok)).toEqual([
                '[sec-13f] dart mapping fail!',
            ]);
        });

        it('중첩 템플릿 슬롯(`[${label}]`, label = `x:${id}`)을 따라간다', () => {
            const c = corpusOf(
                'const id = "kr"; const label = `loadSignals:${id}`; log(`[${label}] one failed:`, e);'
            );
            expect(dead('[loadSignals:kr] one failed', c)).toEqual([]);
            expect(dead('[loadSignals:us] one failed', c)).toEqual([
                '[loadSignals:us] one failed',
            ]);
        });
    });
});
