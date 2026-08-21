#!/usr/bin/env node
/**
 * JSX 문장 조각을 **하나의 ICU 메시지로 병합**한다.
 *
 *   node scripts/i18n/mergeFragments.mjs           리포트만
 *   node scripts/i18n/mergeFragments.mjs --apply    소스·카탈로그 수정
 *
 * ## 왜 필요한가
 *
 * `{count}개 차트 패턴`처럼 표현식과 텍스트가 섞인 JSX는 추출 단계에서
 * `{count}`(표현식)와 `개 차트 패턴`(JSXText)으로 쪼개진다. 한국어는 수량이
 * 앞이라 이어 붙여도 맞지만 **영어는 어순이 반대**다(`12 Chart Patterns`).
 * 조각으로는 어느 번역기도 복구할 수 없다.
 *
 * 실측 피해: 카탈로그 1,121키 중 **140개가 조각**이었고, 중국어에서
 * `"입니다."` → `"。"`, `"뒤에 다시 시도해 주세요."` → `"后请重试。"`처럼
 * 문맥을 잃은 파편이 그대로 화면에 나갈 상태였다.
 *
 * ## 무엇을 하는가
 *
 * 한 JSX 부모 안의 연속 구간(표현식·번역호출·공백)을 찾아
 * `t('key', { v0: <표현식>, … })` 하나로 합치고, 카탈로그 값도
 * `"{v0}개 차트 패턴"`으로 다시 쓴다. 병합된 옛 키는 카탈로그에서 지우고
 * 해시를 무효화해 다음 번역이 새 문장을 다시 옮기게 한다.
 *
 * JSX 엘리먼트(`<strong>` 등)가 섞인 구간은 **건드리지 않는다** — 서식 태그를
 * 메시지 안으로 넣으려면 `t.rich`가 필요하고, 그건 사람이 문장을 보고 정할 일이다.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { namespaceFor } from './lib/scan.mjs';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');

const ROOT = resolve(process.argv[1], '../../..');
const APPLY = process.argv.includes('--apply');

const catalogPath = `${ROOT}/messages/ko.json`;
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const hashesPath = `${ROOT}/messages/_meta/hashes.json`;
const hashes = existsSync(hashesPath)
    ? JSON.parse(readFileSync(hashesPath, 'utf8'))
    : {};

function getPath(root, path) {
    return path
        .split('.')
        .reduce((node, key) => (node ? node[key] : undefined), root);
}
function setPath(root, path, value) {
    const segments = path.split('.');
    let node = root;
    for (const segment of segments.slice(0, -1)) {
        node[segment] ??= {};
        node = node[segment];
    }
    node[segments[segments.length - 1]] = value;
}
/**
 * `{' '}` 같은 공백 전용 문자열 표현식인가.
 *
 * JSX에서 줄바꿈이 공백으로 접히는 것을 막으려고 이 코드베이스가 널리 쓰는
 * 패턴이다. 구간을 끊는 게 아니라 **공백 한 칸**으로 취급해야 한다 — 끊으면
 * `{t(a)}{' '}{value}{' '}{t(b)}` 형태가 전부 조각으로 남는다(실측에서 이 한
 * 가지 때문에 병합이 절반만 됐다).
 */
function isWhitespaceExpression(node) {
    return (
        node?.type === 'JSXExpressionContainer' &&
        node.expression?.type === 'StringLiteral' &&
        !node.expression.value.trim()
    );
}

/** `t('key')` 형태의 JSX 표현식인가. */
function isTranslationCall(node) {
    return (
        node?.type === 'JSXExpressionContainer' &&
        node.expression?.type === 'CallExpression' &&
        /^t\w*$/.test(node.expression.callee?.name ?? '') &&
        node.expression.arguments.length === 1 &&
        node.expression.arguments[0]?.type === 'StringLiteral'
    );
}

/**
 * 값 표현식(번역 호출이 아닌 일반 `{expr}`)인가. 공백 문자열 리터럴은 제외.
 *
 * **JSX를 만들어 내는 표현식은 값이 아니다.** 조건부 렌더(`{cond && <>…</>}`)를
 * ICU 인자로 넣으면 메시지 안에 엘리먼트가 들어가고, 실제로 그렇게 병합했더니
 * 닫는 태그까지 먹어 파일이 파싱 불가가 됐다. 서식이 섞인 문장은 `t.rich`가
 * 필요하고, 그건 사람이 문장을 보고 정할 일이다.
 */
function isValueExpression(node) {
    if (node?.type !== 'JSXExpressionContainer') return false;
    if (isTranslationCall(node)) return false;
    const { expression } = node;
    if (expression.type === 'JSXEmptyExpression') return false;
    if (expression.type === 'StringLiteral' && !expression.value.trim()) {
        return false;
    }
    /**
     * `cond && …` 형태(조건부 렌더)는 값이 아니다. 거짓일 때 `false`가 되는데
     * ICU 인자는 `string | number | Date`만 받는다 — 실측에서 타입 에러로 잡혔다.
     * 조건에 따라 문장이 달라지는 자리는 ICU `select`가 맞고, 그건 사람이 정한다.
     */
    if (expression.type === 'LogicalExpression') return false;
    // 번역 호출을 품은 표현식도 값이 아니다 — 문장 안에 문장을 넣는 꼴이다.
    if (containsTranslationCall(expression)) return false;
    return !containsJsx(expression);
}

/** 표현식 안에 `t(...)` 호출이 있는가. */
function containsTranslationCall(node) {
    if (!node || typeof node.type !== 'string') return false;
    if (
        node.type === 'CallExpression' &&
        /^t\w*$/.test(node.callee?.name ?? '')
    ) {
        return true;
    }
    for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
            if (value.some(containsTranslationCall)) return true;
        } else if (value && typeof value === 'object' && value.type) {
            if (containsTranslationCall(value)) return true;
        }
    }
    return false;
}

/** 표현식 안에 JSX 엘리먼트/프래그먼트가 있는가. */
function containsJsx(node) {
    if (!node || typeof node.type !== 'string') return false;
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') return true;
    for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
            if (value.some(containsJsx)) return true;
        } else if (value && typeof value === 'object' && value.type) {
            if (containsJsx(value)) return true;
        }
    }
    return false;
}

const files = execSync(
    `grep -rl "t('" ${JSON.stringify(ROOT + '/src')} --include='*.tsx' | grep -v test`,
    { encoding: 'utf8' }
)
    .trim()
    .split('\n')
    .filter(Boolean);

/**
 * 키별 참조 횟수.
 *
 * 키는 원문의 **내용 해시**라 같은 한국어 문자열은 키를 공유한다(`'평단'`이
 * 한 파일 안에서 라벨과 값 앞뒤로 두 번 쓰이는 식). 그중 한 자리만 병합하면서
 * 공유 키를 ICU 문장으로 덮어쓰면 **다른 자리가 `평단 {v0}`을 그대로 출력한다**
 * — 실측으로 확인했다. 여러 곳이 쓰는 키는 덮어쓰지 않고 새 키를 만든다.
 */
const referenceCounts = new Map();
for (const absPath of execSync(
    `grep -rl "t('" ${JSON.stringify(ROOT + '/src')} --include='*.tsx' | grep -v test`,
    { encoding: 'utf8' }
)
    .trim()
    .split('\n')
    .filter(Boolean)) {
    const code = readFileSync(absPath, 'utf8');
    for (const match of code.matchAll(/\bt\w*\(\s*'([A-Za-z0-9_.$-]+)'/g)) {
        referenceCounts.set(match[1], (referenceCounts.get(match[1]) ?? 0) + 1);
    }
}

const brokenFiles = [];
let mergedRuns = 0;
let mergedKeys = 0;
let skippedRuns = 0;
let filesChanged = 0;

for (const absPath of files) {
    const relPath = absPath.replace(`${ROOT}/`, '');
    const code = readFileSync(absPath, 'utf8');
    let ast;
    try {
        ast = parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });
    } catch {
        continue;
    }
    const ns = namespaceFor(relPath);
    const edits = [];

    const visit = node => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
            collectRuns(node, ns, code, edits);
        }
        for (const key in node) {
            if (key === 'loc' || key === 'range') continue;
            const value = node[key];
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object' && value.type) {
                visit(value);
            }
        }
    };
    visit(ast.program);

    if (edits.length === 0) continue;
    mergedRuns += edits.length;
    if (!APPLY) continue;

    edits.sort((a, b) => b.start - a.start);
    let next = code;
    for (const edit of edits) {
        next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
    }
    /**
     * **적용 결과를 다시 파싱해 본다.** 구간 경계를 잘못 잡으면 닫는 태그를
     * 먹어 파일이 통째로 깨지는데, 타입체크까지 가서야 드러난다. 여기서 걸러
     * 그 파일은 손대지 않고 넘어간다 — 부분만 망가진 코드를 남기는 것보다 낫다.
     */
    try {
        parse(next, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    } catch (error) {
        brokenFiles.push(`${relPath}: ${error.message}`);
        continue;
    }
    writeFileSync(absPath, next);
    filesChanged += 1;
}

function collectRuns(parent, ns, code, edits) {
    const children = parent.children ?? [];
    let index = 0;
    while (index < children.length) {
        if (
            !isValueExpression(children[index]) &&
            !isTranslationCall(children[index])
        ) {
            index += 1;
            continue;
        }
        // 구간 확장: 표현식 · 번역호출 · 공백 텍스트가 이어지는 만큼.
        let end = index;
        let hasValue = false;
        let hasTranslation = false;
        let hasElement = false;
        while (end < children.length) {
            const child = children[end];
            if (child.type === 'JSXText') {
                if (!child.value.trim()) {
                    end += 1;
                    continue;
                }
                break; // 번역되지 않은 생 텍스트 — 사람이 볼 일이다.
            }
            if (isTranslationCall(child)) {
                hasTranslation = true;
                end += 1;
                continue;
            }
            if (isWhitespaceExpression(child)) {
                end += 1;
                continue;
            }
            if (isValueExpression(child)) {
                hasValue = true;
                end += 1;
                continue;
            }
            if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
                hasElement = true;
            }
            break;
        }
        const run = children
            .slice(index, end)
            .filter(c => c.type !== 'JSXText');
        if (!hasValue || !hasTranslation || run.length < 2) {
            index = Math.max(end, index + 1);
            continue;
        }
        if (hasElement) {
            skippedRuns += 1;
            index = Math.max(end, index + 1);
            continue;
        }

        const built = buildMessage(run, ns, code);
        if (built) {
            edits.push({
                start: run[0].start,
                end: run[run.length - 1].end,
                text: built,
            });
        }
        index = Math.max(end, index + 1);
    }
}

/**
 * ICU 리터럴 이스케이프.
 *
 * **작은따옴표는 ICU MessageFormat의 이스케이프 문자다.** 한국어 카피가
 * `'상세 분석'`처럼 따옴표로 강조하는 자리에 인자를 넣으면 `'{v0}'`이 되고,
 * ICU는 이걸 "리터럴 `{v0}`"으로 읽어 **치환을 건너뛴다** — 화면에 `{v0}`이
 * 그대로 나온다(실측으로 확인). 리터럴 따옴표는 `''`로 써야 한다.
 */
function escapeIcu(text) {
    return text.replace(/'/g, "''");
}

/** 구간을 하나의 ICU 메시지 + `t(key, args)` 호출로 만든다. */
function buildMessage(run, ns, code) {
    const parts = [];
    const args = [];
    let anchorKey = null;

    let previous = null;
    for (const child of run) {
        /**
         * 조각 사이의 **원본 공백을 JSX 규칙 그대로 살린다.**
         *
         * 추출 단계는 JSXText의 앞뒤 공백을 카탈로그 밖(JSX 쪽)에 남겼다.
         * 카탈로그 값만 이어 붙이면 `{v0}페이지로 전환되었습니다`처럼 단어가
         * 붙고(실측 테스트 35건 실패), 반대로 공백을 무조건 넣으면
         * `오늘 {v0} 회 남음`처럼 없던 공백이 생긴다.
         *
         * JSX 규칙: **줄바꿈이 섞인 공백은 제거**되고(그래서 이 코드베이스가
         * `{' '}`를 쓴다), 줄바꿈 없는 공백만 그대로 남는다.
         */
        if (previous) {
            const between = code.slice(previous.end, child.start);
            if (
                between.trim() === '' &&
                between !== '' &&
                !between.includes('\n')
            ) {
                parts.push({ kind: 'text', value: ' ' });
            }
        }
        previous = child;
        if (isWhitespaceExpression(child)) {
            parts.push({ kind: 'text', value: ' ' });
            continue;
        }
        if (isTranslationCall(child)) {
            const key = child.expression.arguments[0].value;
            const full =
                key.includes('.') && getPath(catalog, key)
                    ? key
                    : `${ns}.${key}`;
            const value = getPath(catalog, full);
            if (typeof value !== 'string') return null;
            parts.push({
                kind: 'text',
                value: escapeIcu(value),
                key: full,
                raw: key,
            });
            anchorKey ??= { full, raw: key };
        } else {
            const source = code.slice(
                child.expression.start,
                child.expression.end
            );
            const name = `v${args.length}`;
            args.push({ name, source });
            parts.push({ kind: 'arg', name });
        }
    }
    if (!anchorKey) return null;

    const message = parts
        .map(part => (part.kind === 'arg' ? `{${part.name}}` : part.value))
        .join('')
        // JSX가 접어 주던 줄바꿈·연속 공백을 메시지 안에서는 한 칸으로 정규화한다.
        .replace(/\s+/g, ' ')
        .trim();

    /**
     * 병합 결과는 **항상 새 키**로 만든다.
     *
     * 키는 원문의 내용 해시라 같은 한국어는 키를 공유한다(`'평단'`이 라벨과
     * 값 앞에 각각 쓰이는 식). 조각 키를 덮어쓰면 그 키를 쓰는 **다른 자리가
     * `평단 {v0}`을 그대로 출력한다** — 실측으로 확인했다. "여러 곳이 쓰면
     * 새 키" 같은 조건 분기는 경계 케이스를 계속 만들어, 무조건 새로 만든다.
     *
     * 아무도 안 쓰게 된 옛 키는 `i18n:extract`의 참조 스캔이 다음 실행에
     * 정리한다 — 여기서 지우려 들면 아직 쓰는 자리를 건드릴 위험만 는다.
     */
    const targetRaw = `${anchorKey.raw.split('.')[0]}.${createHash('sha1')
        .update(message)
        .digest('hex')
        .slice(0, 6)}`;
    const targetFull = `${ns}.${targetRaw}`;

    if (APPLY) {
        setPath(catalog, targetFull, message);
        delete hashes[targetFull];
        mergedKeys += 1;
    }

    const argList = args.map(arg => `${arg.name}: ${arg.source}`).join(', ');
    return `{t('${targetRaw}', { ${argList} })}`;
}

if (APPLY) {
    writeFileSync(catalogPath, JSON.stringify(catalog, null, 4) + '\n');
    writeFileSync(hashesPath, JSON.stringify(hashes, null, 4) + '\n');
}

console.log(`병합 가능한 구간:   ${mergedRuns}`);
console.log(`서식 태그로 건너뜀: ${skippedRuns}`);
if (APPLY) {
    console.log(`새로 만든 병합 키:  ${mergedKeys}`);
    console.log(`수정된 파일:       ${filesChanged}`);
}
if (brokenFiles.length > 0) {
    console.warn(`\n⚠ 파싱이 깨져 건너뛴 파일 ${brokenFiles.length}개:`);
    for (const entry of brokenFiles.slice(0, 10)) console.warn(`   ${entry}`);
}
