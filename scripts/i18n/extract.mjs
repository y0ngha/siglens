#!/usr/bin/env node
/**
 * 한국어 리터럴 추출 codemod.
 *
 *   node scripts/i18n/extract.mjs            리포트만 (소스 무변경)
 *   node scripts/i18n/extract.mjs --write     ko 카탈로그까지 생성
 *   node scripts/i18n/extract.mjs --apply     소스도 치환 (안전한 컨텍스트만)
 *   node scripts/i18n/extract.mjs --apply --only src/widgets/layout
 *
 * **텍스트 스플라이싱**으로 치환한다(제너레이터 미사용). 파일 전체를 다시 찍으면
 * 포맷이 통째로 바뀌어 리뷰가 불가능해지고, 이 레포는 주석 밀도가 높아 손실 위험도 크다.
 * 오프셋 역순으로 적용해 앞선 치환이 뒤 오프셋을 밀지 않게 한다.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
    candidateFiles,
    collectCandidates,
    keyFor,
    keyPrefixFor,
    namespaceFor,
    parseFile,
    readSource,
} from './lib/scan.mjs';
import { classify } from './lib/context.mjs';

const ROOT = resolve(process.argv[1], '../../..');
const args = process.argv.slice(2);
const WRITE = args.includes('--write') || args.includes('--apply');
const APPLY = args.includes('--apply');
const ONLY = args[args.indexOf('--only') + 1];
const onlyPrefix = args.includes('--only') ? ONLY : null;

const catalog = {}; // ns -> { key: koText }
const takenPerNamespace = new Map(); // ns -> Map(key -> text)
const skips = [];
let replacedCount = 0;
let filesChanged = 0;

/**
 * 점 경로를 중첩 객체로 되쌓는다.
 *
 * next-intl은 네임스페이스와 키를 **항상 `.`로 쪼개** 객체를 타고 내려간다.
 * `{"widgets.layout": {...}}` 같은 평면 키는 절대 매칭되지 않는다.
 */
function setPath(root, path, value) {
    const segments = path.split('.');
    let node = root;
    for (const segment of segments.slice(0, -1)) {
        node[segment] ??= {};
        node = node[segment];
    }
    node[segments[segments.length - 1]] = value;
}

/** 중첩 객체를 `a.b.c -> value` 평면 맵으로 편다(병합·정렬용). */
function flatten(node, prefix = '', out = {}) {
    for (const [key, value] of Object.entries(node)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, path, out);
        } else {
            out[path] = value;
        }
    }
    return out;
}

function recordMessage(ns, prefix, text) {
    if (!takenPerNamespace.has(ns)) takenPerNamespace.set(ns, new Map());
    const taken = takenPerNamespace.get(ns);
    const key = keyFor(prefix, text, taken);
    taken.set(key, text);
    catalog[ns] ??= {};
    catalog[ns][key] = text;
    return key;
}

/** JSXText는 앞뒤 공백이 레이아웃(단어 사이 띄어쓰기)을 만든다. 그 공백을 보존한다. */
function splitJsxWhitespace(raw) {
    const leading = raw.match(/^\s*/)[0];
    const trailing = raw.match(/\s*$/)[0];
    return { leading, core: raw.trim(), trailing };
}

const files = candidateFiles(ROOT).filter(
    f => !onlyPrefix || f.startsWith(onlyPrefix)
);

for (const relPath of files) {
    const code = readSource(ROOT, relPath);
    let ast;
    try {
        ast = parseFile(relPath, code);
    } catch (error) {
        skips.push({
            file: relPath,
            line: 0,
            reason: 'parse-error',
            text: String(error.message),
        });
        continue;
    }

    const ns = namespaceFor(relPath);
    const prefix = keyPrefixFor(relPath);
    const candidates = collectCandidates(ast, code);
    const edits = [];
    /** component 노드 → 'hook' | 'get' */
    const componentsNeedingTranslator = new Map();

    for (const candidate of candidates) {
        const verdict = classify({ candidate, filePath: relPath });
        const line = code.slice(0, candidate.start).split('\n').length;

        if (!verdict.applicable) {
            skips.push({
                file: relPath,
                line,
                reason: verdict.reason,
                text: candidate.text.replace(/\s+/g, ' ').trim().slice(0, 80),
            });
            // 스킵해도 카탈로그에는 넣는다 — 번역·검증 파이프라인은 전량을 봐야 한다.
            if (
                verdict.reason !== 'module-specifier' &&
                verdict.reason !== 'already-translated' &&
                verdict.reason !== 'parse-error'
            ) {
                recordMessage(ns, prefix, candidate.text.trim());
            }
            continue;
        }

        const text =
            candidate.kind === 'jsx'
                ? splitJsxWhitespace(candidate.text).core
                : candidate.text;
        const key = recordMessage(ns, prefix, text);
        const call = `t('${key}')`;

        if (candidate.kind === 'jsx') {
            const { leading, trailing } = splitJsxWhitespace(candidate.text);
            edits.push({
                start: candidate.start,
                end: candidate.end,
                text: `${leading}{${call}}${trailing}`,
            });
        } else if (verdict.replacement === 'jsx-expression') {
            edits.push({
                start: candidate.start,
                end: candidate.end,
                text: `{${call}}`,
            });
        } else {
            edits.push({
                start: candidate.start,
                end: candidate.end,
                text: call,
            });
        }
        componentsNeedingTranslator.set(verdict.component, verdict.binding);
        replacedCount += 1;
    }

    if (!APPLY || edits.length === 0) continue;

    const needsImport = { hook: false, get: false };
    // 번역자 바인딩 주입 — 컴포넌트 본문 첫 줄에 넣는다.
    for (const [component, binding] of componentsNeedingTranslator) {
        const body = component.body;
        if (!body || body.type !== 'BlockStatement') {
            // 표현식 본문(`const X = () => <div/>`)은 문을 넣을 자리가 없다.
            // 블록으로 바꾸는 변형은 반환값 의미를 건드리므로 사람이 한다.
            skips.push({
                file: relPath,
                line: code.slice(0, component.start).split('\n').length,
                reason: 'expression-body-component',
                text: '',
            });
            continue;
        }
        const insertAt = body.start + 1;
        const decl =
            binding === 'get'
                ? `\n    const t = await getTranslations('${ns}');`
                : `\n    const t = useTranslations('${ns}');`;
        edits.push({ start: insertAt, end: insertAt, text: decl });
        needsImport[binding] = true;
    }

    /**
     * import 삽입 위치는 **AST의 첫 `ImportDeclaration`**에서 얻는다.
     *
     * `code.indexOf('\nimport ')` 같은 텍스트 검색을 쓰면, 이 레포가 허용하는
     * 여러 줄 JSDoc 안에 `import { … } from '…'` 예시가 들어 있는 파일에서
     * **주석 한가운데에 import를 꽂아** 조용히 깨진 코드를 만든다.
     * 첫 import가 없으면 파일 맨 앞(offset 0)에 넣는다.
     */
    const firstImportNode = ast.program.body.find(
        node => node.type === 'ImportDeclaration'
    );
    const importOffset = firstImportNode ? firstImportNode.start : 0;
    const importLines = [
        needsImport.hook && "import { useTranslations } from 'next-intl';",
        needsImport.get &&
            "import { getTranslations } from 'next-intl/server';",
    ]
        .filter(Boolean)
        .filter(line => !code.includes(line));
    if (importLines.length > 0) {
        edits.push({
            start: importOffset,
            end: importOffset,
            text: importLines.join('\n') + '\n',
        });
    }

    edits.sort((a, b) => b.start - a.start || b.end - a.end);
    let next = code;
    for (const edit of edits) {
        next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
    }

    writeFileSync(`${ROOT}/${relPath}`, next);
    filesChanged += 1;
}

// ── 산출 ────────────────────────────────────────────────────────────────
const totalKeys = Object.values(catalog).reduce(
    (sum, ns) => sum + Object.keys(ns).length,
    0
);

if (WRITE) {
    const target = `${ROOT}/messages/ko.json`;
    mkdirSync(dirname(target), { recursive: true });

    // 기존 수기 항목(언어 스위처 라벨 등)을 잃지 않도록 병합한다.
    const existing = existsSync(target)
        ? flatten(JSON.parse(readFileSync(target, 'utf8')))
        : {};
    const merged = { ...existing };
    for (const [ns, entries] of Object.entries(catalog)) {
        for (const [key, value] of Object.entries(entries)) {
            merged[`${ns}.${key}`] = value;
        }
    }

    const nested = {};
    for (const path of Object.keys(merged).sort((a, b) => a.localeCompare(b))) {
        setPath(nested, path, merged[path]);
    }
    writeFileSync(target, JSON.stringify(nested, null, 4) + '\n');

    mkdirSync(`${ROOT}/messages/_meta`, { recursive: true });
    writeFileSync(
        `${ROOT}/messages/_meta/skips.json`,
        JSON.stringify(skips, null, 4) + '\n'
    );
}

const byReason = skips.reduce((acc, s) => {
    acc[s.reason] = (acc[s.reason] ?? 0) + 1;
    return acc;
}, {});

console.log(`파일 스캔:        ${files.length}`);
console.log(`카탈로그 네임스페이스: ${Object.keys(catalog).length}`);
console.log(`카탈로그 키:       ${totalKeys}`);
console.log(`자동 치환 가능:    ${replacedCount}`);
console.log(`스킵:            ${skips.length}`);
for (const [reason, count] of Object.entries(byReason).sort(
    (a, b) => b[1] - a[1]
)) {
    console.log(`  ${String(count).padStart(5)}  ${reason}`);
}
if (APPLY) console.log(`수정된 파일:       ${filesChanged}`);
