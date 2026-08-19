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
import { execSync } from 'node:child_process';
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
/**
 * `'use client'` 파일이 사용하는 네임스페이스 — 루트 프로바이더가 실어야 한다.
 *
 * **치환 시점이 아니라 참조 시점으로 센다.** 치환은 한 번만 일어나므로 그때
 * 모으면 재실행 시 목록이 0이 되고, 그러면 클라이언트에서 전 메시지가
 * `MISSING_MESSAGE`가 된다(실측 5,184건). 빌드는 성공하고 화면에서만 깨진다.
 */
function collectClientNamespaces(root) {
    const namespaces = new Set();
    for (const relPath of candidateSourceFiles(root)) {
        const code = readFileSync(`${root}/${relPath}`, 'utf8');
        if (!/^\s*(['"])use client\1/m.test(code.slice(0, 400))) continue;
        if (!/\bt\w*\(/.test(code)) continue;
        namespaces.add(namespaceFor(relPath));
        // 루트 번역자(`useTranslations()`)가 쓰는 완전 수식 키는 그 키의
        // 네임스페이스도 필요하다.
        for (const match of code.matchAll(/\bt\w*\(\s*'([A-Za-z0-9_.$-]+)'/g)) {
            const parts = match[1].split('.');
            if (parts.length >= 3) namespaces.add(parts.slice(0, 2).join('.'));
        }
    }
    /**
     * 수동 키의 네임스페이스도 넣는다.
     *
     * `manualKeys.json`에 등록되는 키는 **소스에 한국어가 없어 추출로 만들어지지
     * 않는 것**들이고(내비 라벨·카테고리 라벨), 소비자는 그 키를 변수로 넘긴다
     * (`t(vertical.labelKey)`). 정규식 스캔으로는 절대 보이지 않으므로 여기서
     * 명시적으로 더한다 — 빠뜨리면 클라이언트에서 그 라벨만 한국어로 남는데,
     * `MISSING_MESSAGE`도 안 뜨고(폴백이 ko다) route 표에도 안 나온다.
     */
    const manualPath = `${root}/messages/_meta/manualKeys.json`;
    if (existsSync(manualPath)) {
        for (const prefix of JSON.parse(readFileSync(manualPath, 'utf8'))) {
            const parts = prefix.split('.');
            if (parts.length >= 2) namespaces.add(parts.slice(0, 2).join('.'));
        }
    }
    return namespaces;
}
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

/**
 * 소스가 **이미 참조하고 있는** 메시지 키.
 *
 * 이 스크립트는 한국어 리터럴을 찾아 카탈로그를 만든다. 한 번 치환하고 나면
 * 그 자리에는 `t('key')`만 남아 리터럴이 사라지므로, 재실행하면 카탈로그가
 * 통째로 비워진다 — 실측으로 2,751키가 41키로 날아갔다.
 *
 * 그래서 재생성은 "리터럴에서 새로 만든 것 + **소스가 아직 참조하는 것** +
 * 손으로 쓴 것"의 합집합이다. 어느 코드도 부르지 않는 키만 사라진다.
 */
function collectReferencedKeys(root) {
    const referenced = new Set();
    const pattern = /\bt\w*\(\s*'([A-Za-z0-9_.$-]+)'/g;
    for (const relPath of candidateSourceFiles(root)) {
        const code = readFileSync(`${root}/${relPath}`, 'utf8');
        const ns = namespaceFor(relPath);
        for (const match of code.matchAll(pattern)) {
            // 네임스페이스 번역자(`useTranslations('widgets.legal')`)는 키를
            // 접두사 없이 부르고, 루트 번역자(`useTranslations()`)는 완전 수식
            // 키를 부른다. 어느 쪽인지 정규식으로는 알 수 없으므로 둘 다 넣는다 —
            // 존재하지 않는 조합은 카탈로그에 없어서 무해하다.
            referenced.add(match[1]);
            referenced.add(`${ns}.${match[1]}`);
        }
    }
    return referenced;
}

/** `t()` 스캔 대상 — 한국어 유무와 무관하게 전 소스를 본다. */
function candidateSourceFiles(root) {
    return execSync(
        // ⚠️ 괄호가 없으면 `-o` 우선순위 때문에 암시적 `-print`가 뒤쪽 조건에만
        // 붙어 **`.ts` 파일이 통째로 빠진다** — 그러면 `.ts`에서만 쓰는 키가
        // "참조 없음"으로 판정돼 카탈로그에서 조용히 지워진다.
        `find ${JSON.stringify(root + '/src')} \\( -name '*.ts' -o -name '*.tsx' \\) -print`,
        { encoding: 'utf8', maxBuffer: 1 << 28 }
    )
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(f => f.replace(root + '/', ''))
        .filter(f => !/__tests__|\.test\.|\.spec\./.test(f));
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
            /**
             * 스킵한 문자열은 **카탈로그에 넣지 않는다.**
             *
             * 치환되지 않았으므로 코드가 `t()`로 꺼내 쓸 일이 없다. 넣으면
             * (1) 번역 비용만 나가고 (2) 검증 게이트가 쓰이지도 않는 문자열에
             * 대해 실패한다. 실제로 템플릿 원문(`` `${x} 삭제` ``)이 카탈로그에
             * 들어가 "번역"됐는데, 그 `${}`는 카탈로그 안에서 전개되지 않아
             * 아무 의미가 없었다.
             *
             * 남은 대상은 `messages/_meta/skips.json`이 사유와 함께 추적한다 —
             * 잃어버리는 정보는 없다.
             */
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
        /**
         * 번역자 바인딩은 **`setRequestLocale(...)` 뒤**에 넣어야 한다.
         *
         * 앞에 넣으면 next-intl의 서버 API가 아직 요청 로케일을 못 찾아
         * `headers()`로 폴백하고, 그 순간 **이 라우트의 ISR이 꺼진다**
         * (빌드 route 표에서 `●` → `ƒ`). 실측으로 10개 라우트가 이렇게 날아갔다.
         * 타입체크·테스트는 전부 통과하므로 빌드 표를 봐야만 드러난다.
         */
        const setLocaleCall = code
            .slice(body.start, body.end)
            .indexOf('setRequestLocale(');
        let insertAt = body.start + 1;
        if (setLocaleCall !== -1) {
            const absolute = body.start + setLocaleCall;
            const semicolon = code.indexOf(';', absolute);
            if (semicolon !== -1) insertAt = semicolon + 1;
        }
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
    /**
     * import가 하나도 없는 파일은 offset 0이 아니라 **directive 뒤**에 넣어야 한다.
     * `'use client'` 앞에 import를 꽂으면 지시어가 파일 첫 문이 아니게 되어
     * 조용히 무효가 된다(서버 컴포넌트로 바뀌어 훅이 죽는다).
     */
    const lastDirective = ast.program.directives?.at(-1);
    const importOffset = firstImportNode
        ? firstImportNode.start
        : lastDirective
          ? lastDirective.end + 1
          : 0;
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

    /**
     * 기존 카탈로그에서 **손으로 쓴 키만** 살린다.
     *
     * `messages/_meta/manualKeys.json`에 적힌 접두사에 해당하는 키가 그 대상이다
     * (내비 라벨처럼 소스에 한국어가 없어 추출로는 만들어지지 않는 것들).
     * 나머지는 버린다 — 소스에서 사라진 문자열의 키가 남으면 번역 게이트가
     * "고아 키"로 계속 실패하고 진짜 누락이 그 안에 묻힌다.
     */
    const manualPrefixes = existsSync(`${ROOT}/messages/_meta/manualKeys.json`)
        ? JSON.parse(
              readFileSync(`${ROOT}/messages/_meta/manualKeys.json`, 'utf8')
          )
        : [];
    const existing = existsSync(target)
        ? flatten(JSON.parse(readFileSync(target, 'utf8')))
        : {};
    const referenced = collectReferencedKeys(ROOT);
    const merged = Object.fromEntries(
        Object.entries(existing).filter(
            ([key]) =>
                referenced.has(key) ||
                manualPrefixes.some(prefix => key.startsWith(`${prefix}.`))
        )
    );
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
    /**
     * 루트 클라이언트 프로바이더에 실어야 할 네임스페이스.
     *
     * `'use client'` 파일이 쓰는 것만 모은다 — 서버 컴포넌트는 프로바이더가
     * 아니라 요청 설정에서 메시지를 읽으므로 클라이언트로 보낼 필요가 없다.
     * 손으로 관리하면 새 클라이언트 컴포넌트가 추가될 때마다 빠뜨리고,
     * 그 누락은 런타임에 `MISSING_MESSAGE`로만 드러난다(빌드는 통과한다).
     */
    writeFileSync(
        `${ROOT}/messages/_meta/clientNamespaces.json`,
        JSON.stringify([...collectClientNamespaces(ROOT)].sort(), null, 4) +
            '\n'
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
