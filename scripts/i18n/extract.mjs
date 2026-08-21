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
function buildModuleGraph(root) {
    const files = candidateSourceFiles(root);
    const sources = new Map();
    for (const rel of files) {
        sources.set(rel, readFileSync(`${root}/${rel}`, 'utf8'));
    }

    /**
     * import 지정자를 레포 상대 경로로 해석한다.
     * `@/x` → `src/x`, 상대 경로는 importer 기준. 확장자와 배럴을 순서대로 시도.
     */
    const resolveSpecifier = (fromRel, spec) => {
        let base;
        if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
        else if (spec.startsWith('.')) {
            const dir = fromRel.split('/').slice(0, -1);
            for (const part of spec.split('/')) {
                if (part === '.') continue;
                else if (part === '..') dir.pop();
                else dir.push(part);
            }
            base = dir.join('/');
        } else return undefined; // 외부 패키지
        for (const cand of [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}/index.ts`,
            `${base}/index.tsx`,
        ]) {
            if (sources.has(cand)) return cand;
        }
        return undefined;
    };

    const importsOf = rel => {
        const code = sources.get(rel) ?? '';
        const specs = [];
        // 정적 import와 `next/dynamic(() => import('...'))` 둘 다 따라간다.
        for (const m of code.matchAll(/from\s+'([^']+)'/g)) specs.push(m[1]);
        for (const m of code.matchAll(/import\(\s*'([^']+)'\s*\)/g))
            specs.push(m[1]);
        return specs
            .map(spec => resolveSpecifier(rel, spec))
            .filter(target => target !== undefined);
    };

    return { sources, importsOf };
}

/**
 * 진입점들에서 도달 가능한 **클라이언트 번들 파일** 집합.
 *
 * `'use client'` 파일**과 그 파일이 import하는 모든 모듈**이다. 디렉티브만 보면
 * `BacktestCaseCard.tsx`처럼 디렉티브 없이 클라이언트 컴포넌트에 끌려 들어가는
 * 파일을 통째로 놓친다 — 실측 2,590건 `MISSING_MESSAGE`가 그렇게 났다
 * (빌드는 EXIT=0이었다).
 */
function clientClosure(graph, entryPoints) {
    const { sources, importsOf } = graph;
    // 1패스: 진입점에서 도달 가능한 전부를 훑어 `'use client'` 경계를 찾는다.
    const reachable = new Set(entryPoints);
    const queue = [...entryPoints];
    while (queue.length > 0) {
        for (const target of importsOf(queue.pop())) {
            if (!reachable.has(target)) {
                reachable.add(target);
                queue.push(target);
            }
        }
    }
    // 2패스: 그 경계에서 다시 전이 폐포를 구한다.
    const client = new Set();
    const clientQueue = [];
    for (const rel of reachable) {
        const code = sources.get(rel) ?? '';
        if (/^\s*(['"])use client\1/m.test(code.slice(0, 400))) {
            client.add(rel);
            clientQueue.push(rel);
        }
    }
    while (clientQueue.length > 0) {
        for (const target of importsOf(clientQueue.pop())) {
            if (!client.has(target)) {
                client.add(target);
                clientQueue.push(target);
            }
        }
    }
    return client;
}

/**
 * 파일 집합이 참조하는 카탈로그 키.
 *
 * ⚠️ **동적 키를 쓰는 파일은 좁히지 않는다.** `t(item.labelKey)`처럼 키가
 * 변수로 오는 곳은 정적으로 볼 수 없고, 빠뜨리면 빌드·타입체크·테스트를 모두
 * 통과한 채 화면에서만 `MISSING_MESSAGE`가 된다(실측 5,184건 전례). 그런
 * 파일의 네임스페이스는 통째로 유지하고, 리터럴만 쓰는 파일만 키 단위로 좁힌다.
 *
 * 번역자 변수 이름은 **선언에서 뽑는다.** `/\bt\w*\(/` 같은 이름 형태 휴리스틱은
 * `then(`·`toFixed(`·`toLocaleString(`·`trimTrailingZeros(`를 전부 동적 키로
 * 오인해, 38개 네임스페이스 중 37개를 통째로 실었다(실측 5,454바이트 낭비).
 */
function keysForFiles(graph, files) {
    const keys = new Set();
    const wideNamespaces = new Set();
    for (const relPath of files) {
        const code = graph.sources.get(relPath) ?? '';
        if (!/\bt\w*\(/.test(code)) continue;

        /**
         * 번역자 변수 → 그 변수가 묶인 네임스페이스.
         *
         * 이름만 모으면 안 된다. 한 파일이 번역자를 여러 개 선언하면
         * (`useTranslations('widgets.layout')` + `useTranslations('shared.seo')`),
         * 그중 **하나**가 동적 키를 쓸 때 파일이 언급한 네임스페이스가 전부
         * 넓혀졌다 — 실측: `Footer.tsx`의 `tNav(item.fullLabelKey)` 하나 때문에
         * 서버 전용인 `shared.seo`(SEO 제목·설명 전부)가 크롬 페이로드에 실려
         * 카탈로그의 21.8%가 모든 라우트에 딸려갔다.
         */
        const translatorNamespace = new Map();
        for (const m of code.matchAll(
            /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:'([^']+)'|\{[^}]*namespace:\s*'([^']+)')?/g
        )) {
            translatorNamespace.set(m[1], m[2] ?? m[3] ?? null);
        }
        if (translatorNamespace.size === 0) continue;

        const fileNamespaces = new Set([namespaceFor(relPath)]);
        for (const ns of translatorNamespace.values()) {
            if (ns) fileNamespaces.add(ns);
        }

        /**
         * 키가 **변수로 오는** 파일은 어떤 키가 쓰일지 정적으로 알 수 없다.
         * 그런 파일의 네임스페이스는 통째로 싣는다.
         *
         * 조회 테이블(`shared.assetName`·`shared.skillName`)을 **2세그먼트 전용**
         * 네임스페이스로 분리해 둔 이유가 이것이다 — `widgets.dashboard` 아래
         * 두면 그 슬라이스 전체가 크롬 페이로드에 딸려간다.
         */
        // 동적 키를 쓰는 **번역자만** 그 네임스페이스를 넓힌다. 같은 파일의
        // 다른 번역자는 리터럴만 쓰면 아래에서 키 단위로 수집된다.
        const widenedNames = new Set();
        for (const [name, ns] of translatorNamespace) {
            /**
             * 동적 키 = 첫 인자가 **문자열 리터럴이 아닌** 것.
             *
             * 예전에는 `[A-Za-z_$]`로 시작하는 식별자만 봤다. 그래서
             * `` t(`${x}`) ``(템플릿 리터럴)와 `t.rich(x)`가 통째로 빠졌고,
             * 한 토큰짜리 리팩터가 네임스페이스를 조용히 좁혀 그 라우트에서
             * **원시 키가 렌더**됐다 — SSR HTML은 멀쩡한 채로. 라운드 9·12에서
             * 실제로 그렇게 냈다.
             *
             * 이제 리터럴(`'`/`"`)이 아닌 모든 첫 인자를 동적으로 본다. 넓게
             * 잡히는 쪽이 안전하다 — 좁게 잡히면 화면이 깨지고, 넓게 잡히면
             * 페이로드가 조금 커질 뿐이다.
             */
            const usesDynamicKey = new RegExp(
                `\\b${name}(?:\\.(?:rich|markup|raw))?\\(\\s*(?!['"])\\S`
            ).test(code);
            if (!usesDynamicKey) continue;
            widenedNames.add(name);
            /**
             * 네임스페이스를 명시하지 않은 번역자(`useTranslations()`)는 키가
             * **완전 수식**이라 어느 네임스페이스가 필요한지 알 수 없다. 그래도
             * 파일이 언급한 다른 네임스페이스까지 끌고 오면 안 된다 — 실측:
             * `Footer.tsx`의 `tNav(item.fullLabelKey)` 하나가 서버 전용
             * `shared.seo`를 크롬에 실어 페이로드를 21.8%로 부풀렸다. 그런 키는
             * 보통 config 상수라 `manualKeys.preserve`로 따로 관리된다.
             * 그래서 **자기 파일의 네임스페이스만** 넓힌다.
             */
            wideNamespaces.add(ns ?? namespaceFor(relPath));
        }

        /**
         * 넓혀진 번역자는 리터럴 수집 대상에서 뺀다 — 이미 네임스페이스
         * 전체가 실리므로 빼도 무해하다. **파일 전체를 건너뛰면 안 된다**
         * (예전 버그): 한 파일에 동적 키 번역자(`tLabel`)와 리터럴 전용
         * 번역자(`t`)가 공존하면(`MarketNewsDigest.tsx`처럼 enum 라벨 +
         * 일반 UI 문구를 같이 렌더하는 파일), `tLabel` 하나가 넓혀졌다고
         * 파일 전체를 스킵해 `t('...')` 리터럴 키까지 통째로 빠졌었다 —
         * 위 주석이 약속하는 동작과 실제 코드가 어긋나 있었다(실측:
         * `widgets.market-news.MarketNewsDigest.*` 11개가 `news/[category]`
         * 라우트에서 조용히 사라짐 → 클라이언트 MISSING_MESSAGE).
         */
        const literalNames = [...translatorNamespace.keys()].filter(
            name => !widenedNames.has(name)
        );
        if (literalNames.length === 0) continue;
        const names = literalNames.join('|');

        // `t('k')`뿐 아니라 `t.rich('k')`·`t.markup('k')`·`t.raw('k')`도 모은다.
        // 빠져 있으면 rich 텍스트 키가 `--write` 때마다 ko.json에서 **삭제**된다
        // (실측: 태그를 쓰는 키 3개가 그렇게 사라졌다).
        for (const m of code.matchAll(
            new RegExp(
                `\\b(?:${names})(?:\\.(?:rich|markup|raw))?\\(\\s*'([A-Za-z0-9_.$-]+)'`,
                'g'
            )
        )) {
            const literal = m[1];
            if (literal.split('.').length >= 3) keys.add(literal);
            else for (const ns of fileNamespaces) keys.add(`${ns}.${literal}`);
        }
    }
    return { keys, wideNamespaces };
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
/**
 * `messages/_meta/manualKeys.json`을 읽는다.
 *
 * 두 목록이 **서로 다른 일**을 한다 — 예전에는 한 배열이 둘을 겸했고, 그래서
 * 라우트 전용 키(표시명 60개)를 등록하자 그 네임스페이스가 통째로 크롬에 실려
 * 크롬 페이로드가 전체 카탈로그의 36%로 부풀었다(목표 15% 미만).
 *
 * - `preserve`: 동적 조회라 스캔에 안 잡히는 키. ko.json 재생성 때 **삭제 금지**.
 * - `chromeWide`: 그중 소비 라우트를 특정할 수 없어 크롬에 싣는 네임스페이스.
 * - `routeWide`: 소비 라우트를 **아는** 경우 `{네임스페이스: [라우트id]}`로 그
 *   라우트에만 싣는다. 훅이 자기 파일 네임스페이스와 다른 네임스페이스를 읽으면
 *   (`useStreamErrorMessages`가 `app.api.stream`을 읽는 식) 추출기가 그걸 소비
 *   라우트로 넘기지 못한다 — 그렇다고 `chromeWide`에 넣으면 분석을 하지 않는
 *   `/login`·`/terms`까지 따라간다.
 *   전역 내비·카테고리 라벨만 해당한다. 라우트가 특정되는 키는 넣지 않는다 —
 *   소비 파일의 escape 판정이 해당 라우트에만 넓혀 준다.
 */
function readManualKeys(root) {
    const path = `${root}/messages/_meta/manualKeys.json`;
    if (!existsSync(path))
        return { preserve: [], chromeWide: [], routeWide: {} };
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    // 예전 형식(평평한 배열)도 읽는다.
    if (Array.isArray(raw))
        return { preserve: raw, chromeWide: raw, routeWide: {} };
    return {
        preserve: raw.preserve ?? [],
        chromeWide: raw.chromeWide ?? [],
        routeWide: raw.routeWide ?? {},
    };
}

function collectReferencedKeys(root) {
    const referenced = new Set();
    // `t.rich('k')`·`t.markup('k')`·`t.raw('k')`도 참조로 센다. `\w`는 `.`를
    // 포함하지 않아 예전 패턴은 이걸 통째로 놓쳤고, 그래서 태그를 쓰는 키가
    // `--write` 때마다 "참조 없음"으로 판정돼 ko.json에서 **삭제**됐다.
    const pattern =
        /\bt\w*(?:\.(?:rich|markup|raw))?\(\s*'([A-Za-z0-9_.$-]+)'/g;
    for (const relPath of candidateSourceFiles(root)) {
        const code = readFileSync(`${root}/${relPath}`, 'utf8');
        const ns = namespaceFor(relPath);
        const explicitNamespaces = [
            ...code.matchAll(/useTranslations\(\s*'([^']+)'/g),
            ...code.matchAll(/getTranslations\(\s*'([^']+)'/g),
        ].map(m => m[1]);
        for (const match of code.matchAll(pattern)) {
            // 네임스페이스 번역자(`useTranslations('widgets.legal')`)는 키를
            // 접두사 없이 부르고, 루트 번역자(`useTranslations()`)는 완전 수식
            // 키를 부른다. 어느 쪽인지 정규식으로는 알 수 없으므로 둘 다 넣는다 —
            // 존재하지 않는 조합은 카탈로그에 없어서 무해하다.
            referenced.add(match[1]);
            referenced.add(`${ns}.${match[1]}`);
            // `useTranslations('shared.assetName')`처럼 **파일 경로와 다른**
            // 네임스페이스를 명시한 경우. 이걸 안 세면 그 키가 "참조 없음"으로
            // 판정돼 `--write` 한 번에 카탈로그에서 사라진다 — 지금은
            // `manualKeys.preserve` 등록으로만 버티고 있어, 새 조회 테이블을
            // 같은 방식으로 추가하면 첫 실행에 통째로 날아간다(실측).
            for (const ns2 of explicitNamespaces) {
                referenced.add(`${ns2}.${match[1]}`);
            }
        }
    }
    return referenced;
}

/** `t()` 스캔 대상 — 한국어 유무와 무관하게 전 소스를 본다. */
function candidateSourceFiles(root) {
    return (
        execSync(
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
            .filter(f => !/__tests__|\.test\.|\.spec\./.test(f))
            /**
             * **정렬이 없으면 산출물이 파일시스템에 의존한다.**
             *
             * `find`의 출력 순서는 디렉터리 엔트리 순서다 — macOS APFS는 정렬해서
             * 주지만 Linux ext4는 inode 순서로 준다. 이 목록의 순서가
             * `clientKeys.json`의 `routes` **키 삽입 순서**를 정하므로, 정렬하지
             * 않으면 같은 소스에서 macOS와 CI가 다른 JSON을 만든다
             * (`git diff --exit-code -- messages/`가 로컬에서 재현되지 않는 실패를
             * 냈다 — PR #762). 이 파일의 `localeCompare` 건, `scan.mjs`의 grep
             * collation 건과 같은 부류다.
             */
            .sort()
    );
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
        const verdict = classify({ candidate, filePath: relPath, code });
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
    const manualPrefixes = readManualKeys(ROOT).preserve;
    const existing = existsSync(target)
        ? flatten(JSON.parse(readFileSync(target, 'utf8')))
        : {};
    const referenced = collectReferencedKeys(ROOT);
    const merged = Object.fromEntries(
        Object.entries(existing).filter(
            ([key]) =>
                referenced.has(key) ||
                // 접두사(네임스페이스 전체) **또는 정확 키**를 허용한다. 예전에는
                // `${prefix}.`만 봐서 `app.symbol.page.marketLabelUs` 같은 개별
                // 키를 등록할 방법이 없었고, 등록해도 조용히 지워졌다.
                manualPrefixes.some(
                    prefix => key === prefix || key.startsWith(`${prefix}.`)
                )
        )
    );
    for (const [ns, entries] of Object.entries(catalog)) {
        for (const [key, value] of Object.entries(entries)) {
            merged[`${ns}.${key}`] = value;
        }
    }

    const nested = {};
    /**
     * **코드포인트 정렬이다 — `localeCompare`가 아니다.**
     *
     * `localeCompare()`를 로케일 없이 부르면 런타임 기본 로케일과 ICU collation
     * 데이터를 쓴다. 한글 키가 섞인 이 카탈로그에서는 macOS Node와 Linux Node가
     * **서로 다른 순서**를 낸다(예: `MACD 대순환 분석`이 한글 앞/뒤로 갈린다).
     * 그 결과 `yarn i18n:extract --write` 산출물이 환경마다 달라져,
     * CI의 드리프트 검사(`git diff --exit-code -- messages/`)가 로컬에서
     * 재현되지 않는 실패를 냈다(PR #762).
     *
     * 기본 `.sort()`는 UTF-16 코드포인트 비교라 어디서 돌려도 같다.
     */
    for (const path of Object.keys(merged).sort()) {
        setPath(nested, path, merged[path]);
    }
    writeFileSync(target, JSON.stringify(nested, null, 4) + '\n');

    mkdirSync(`${ROOT}/messages/_meta`, { recursive: true });
    /**
     * `--only`는 트리의 일부만 스캔하므로 `skips`가 그 하위집합만 담는다.
     * 그대로 덮어쓰면 전체 목록이 잘린다 — 실측: `--only src/widgets/layout`이
     * 1,787개를 4개로 만들었다. `--only`는 `lint.mjs`가 안내하는 정식 보수
     * 경로라 실제로 자주 쓰인다. `ko.json`·`clientKeys.json`은 항상 전체 트리를
     * 스캔하므로 영향이 없고, 이 파일만 부분 결과에 취약하다.
     */
    if (onlyPrefix === null) {
        writeFileSync(
            `${ROOT}/messages/_meta/skips.json`,
            JSON.stringify(skips, null, 4) + '\n'
        );
    } else {
        console.log(
            'skips.json은 --only 실행에서 갱신하지 않는다(부분 스캔 결과로 전체를 덮으면 잘린다).'
        );
    }
    /**
     * 라우트별 클라이언트 키.
     *
     * 루트 프로바이더 하나에 전 라우트 키의 합집합을 실으면 `/login`·`/terms`
     * 같은 가벼운 페이지가 `widgets.options`·`views.symbol`·`widgets.chat`을
     * 통째로 들고 다닌다. 실측: 전 라우트에 24,299바이트가 동일하게 실려
     * first-load JS +28%, RSC prefetch +45.8%였다.
     */
    const graph = buildModuleGraph(ROOT);
    const ko = JSON.parse(readFileSync(`${ROOT}/messages/ko.json`, 'utf8'));
    const exists = path =>
        path
            .split('.')
            .reduce(
                (node, seg) => (node == null ? undefined : node[seg]),
                ko
            ) !== undefined;
    const manualKeys = readManualKeys(ROOT);
    const manual = manualKeys.chromeWide;
    const serialize = ({ keys, wideNamespaces }, extraWide = []) => ({
        keys: [...keys].filter(exists).sort(),
        wideNamespaces: [...new Set([...wideNamespaces, ...extraWide])].sort(),
    });

    /**
     * 수동 키는 변수로 넘겨져 정적 스캔에 안 잡힌다(`t(vertical.labelKey)`).
     * 어느 라우트가 쓰는지도 알 수 없으므로 **크롬에** 둔다 — 내비게이션·카테고리
     * 라벨이라 실제로 전역이다.
     */
    /**
     * 등록한 경로를 **그대로** 싣는다.
     *
     * 예전에는 앞 2세그먼트로 잘랐다 — `shared.lib.skillStats.count`가
     * `shared.lib` 전체를, `app.api.stream`이 `app.api` 전체를 끌고 왔다.
     * 실측 577바이트(카탈로그의 1.3%)가 크롬과 31개 라우트 페이로드에 중복
     * 적재됐다. `pickMessages`는 임의 깊이의 점 경로를 그대로 따라가므로
     * 자를 이유가 없다.
     */
    const manualWide = manual.filter(prefix => prefix.includes('.'));

    const APP = 'src/app/[locale]';
    const BOUNDARY_FILES = [
        'error.tsx',
        'loading.tsx',
        'not-found.tsx',
        'template.tsx',
    ];

    /**
     * 어떤 라우트 파일이 **어느 프로바이더 아래에서 렌더되는지** 정한다.
     *
     * `error.tsx`/`loading.tsx`/`not-found.tsx`는 자기 세그먼트의 **가장 가까운
     * 조상 `layout.tsx`** 안에서 렌더된다. 같은 디렉터리에 `page.tsx`가 있는지와
     * 무관하다. 이걸 디렉터리 기준으로만 모으면 두 가지가 새어 나간다:
     *  - `[locale]/error.tsx`가 소비자 없는 `routes['.']`에 들어간다
     *    (홈은 자기 세그먼트 레이아웃이 없어 크롬 프로바이더를 쓴다)
     *  - `[locale]/share/error.tsx`는 `share/`에 `page.tsx`가 없어 **아무 데도**
     *    안 들어간다
     * 실측: 두 에러 경계가 `app.home.error.80dac7` 같은 **원시 키를 `<h1>`으로**
     * 렌더했다 — 한국어 사용자 포함 전 로케일에서. 라운드 2 좁히기가 만든 회귀다.
     */
    const nearestLayoutRoute = relPath => {
        let dir = relPath.slice(0, relPath.lastIndexOf('/'));
        while (dir.length > APP.length) {
            if (graph.sources.has(`${dir}/layout.tsx`)) {
                return dir.slice(APP.length + 1);
            }
            dir = dir.slice(0, dir.lastIndexOf('/'));
        }
        return null; // 크롬(`[locale]/layout.tsx`) 아래
    };

    const boundaryFiles = candidateSourceFiles(ROOT).filter(
        rel =>
            rel.startsWith(`${APP}/`) &&
            BOUNDARY_FILES.includes(rel.slice(rel.lastIndexOf('/') + 1))
    );

    /**
     * 크롬 = 루트 레이아웃 서브트리 + 홈 페이지 + **크롬 아래에서 렌더되는 경계 파일**.
     *
     * 홈은 라우트 그룹 `(home)`으로 옮겨 **자기 버킷을 갖는다.** 예전에는
     * `[locale]/page.tsx`라 세그먼트 레이아웃을 둘 수 없어 크롬을 썼는데,
     * 그 탓에 홈 전용 스킬 카탈로그(`shared.skillDescription` 8.4KB +
     * `shared.skillName` 0.9KB)가 `/login`·`/terms`까지 따라다녔다 —
     * 크롬이 카탈로그의 23.8%였다.
     */
    const chromeEntries = [
        `${APP}/layout.tsx`,
        ...boundaryFiles.filter(rel => nearestLayoutRoute(rel) === null),
    ];
    const chrome = serialize(
        keysForFiles(graph, clientClosure(graph, chromeEntries)),
        manualWide
    );

    /**
     * 키 삽입 순서가 곧 JSON 출력 순서다. 위 `candidateSourceFiles`가 정렬된
     * 목록을 주므로 결정론적이지만, 그 계약이 여기 적혀 있지 않으면 나중에
     * 정렬이 빠져도 아무도 모른다 — 아래 `sortedRoutes`가 그 의존을 끊는다.
     */
    const routes = {};
    for (const rel of candidateSourceFiles(ROOT)) {
        if (!/^src\/app\/\[locale\]\/.*page\.tsx$/.test(rel)) continue;
        const routeId =
            rel.replace(`${APP}/`, '').replace(/\/?page\.tsx$/, '') || '.';
        // 홈은 크롬 프로바이더를 쓰므로 별도 엔트리가 필요 없다.
        if (routeId === '.') continue;
        const entries = [
            rel,
            `${rel.slice(0, rel.lastIndexOf('/'))}/layout.tsx`,
            ...boundaryFiles.filter(f => nearestLayoutRoute(f) === routeId),
        ].filter(candidate => graph.sources.has(candidate));
        const entry = serialize(
            keysForFiles(graph, clientClosure(graph, entries))
        );
        /**
         * 크롬 키를 빼지 않는다. 중첩 `NextIntlClientProvider`는 부모 메시지를
         * **상속하지 않고 교체**한다(`use-intl/react.js`의
         * `messages === undefined ? prevContext?.messages : messages`).
         */
        // 이 라우트에만 싣기로 등록된 네임스페이스.
        const routeWide = Object.entries(manualKeys.routeWide)
            .filter(([, routeIds]) => routeIds.includes(routeId))
            .map(([ns]) => ns);
        routes[routeId] = {
            keys: [...new Set([...chrome.keys, ...entry.keys])].sort(),
            wideNamespaces: [
                ...new Set([
                    ...chrome.wideNamespaces,
                    ...entry.wideNamespaces,
                    ...routeWide,
                ]),
            ].sort(),
        };
    }

    // 파일 순회 순서와 무관하게 키 순서를 고정한다 — 위 `routes` 주석 참고.
    const sortedRoutes = Object.fromEntries(
        Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    );

    writeFileSync(
        `${ROOT}/messages/_meta/clientKeys.json`,
        JSON.stringify({ chrome, routes: sortedRoutes }, null, 4) + '\n'
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
