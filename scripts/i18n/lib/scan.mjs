import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');

export const HANGUL = /[가-힣]/;

/** 키 해시 길이. 현재 1,071키 규모에서 충돌 확률은 무시할 수준이고, 충돌 시 `keyFor`가 늘린다. */
const HASH_LENGTH = 6;

/**
 * 번역 대상이 아닌 경로.
 *
 * - 테스트: 픽스처 문자열이 카탈로그를 오염시킨다.
 * - `src/app/api`: 서버 로그·에러 코드. 사용자에게 렌더되지 않는다.
 * - `scripts`, `db`: 운영 스크립트.
 * - `src/app/not-found.tsx`: 루트 레이아웃 바깥에서 자체 문서를 렌더한다.
 *   로케일을 알 수 없는 자리라(어떤 라우트에도 매칭되지 않은 URL) ko·en 병기
 *   정적 문구를 쓴다 — `global-error.tsx`와 같은 이유.
 * - `global-error.tsx`: 루트 레이아웃을 대체하므로 `NextIntlClientProvider`가
 *   트리에 없다. 여기서 `useTranslations`를 부르면 최후의 에러 경계가 그 자체로
 *   던져 `reset()`에 도달할 수 없다. 로케일도 알 수 없어 ko·en 병기 정적 문구를
 *   쓰는데, 추출기가 그 한국어를 다시 키로 뽑으면 같은 사고가 재발한다.
 */
const EXCLUDE_RE =
    /(__tests__|__integration__|\.test\.|\.spec\.|src\/app\/api\/|\/test-utils\/|global-error\.tsx|src\/app\/not-found\.tsx)/;

/** 파일 경로 → 메시지 네임스페이스. */
export function namespaceFor(relPath) {
    const parts = relPath.replace(/^src\//, '').split('/');
    const layer = parts[0];
    if (layer === 'app') {
        // `app/[locale]/[symbol]/news/page.tsx` → `app.symbol`
        // `app/[locale]/(home)/page.tsx`         → `app.home`
        //
        // **라우트 그룹(`(home)`)도 걸러낸다.** URL에 안 나타나는 조직용
        // 세그먼트라 네임스페이스에 들어가면 안 된다 — 안 거르면 홈이
        // `app.(home)`으로 잡히는데, 그 파일은 `getTranslations('app.home')`을
        // 부르므로 키가 서로 어긋나 화면에 원시 키가 렌더된다(실증).
        const rest = parts
            .slice(1)
            .filter(p => p !== '[locale]' && !/^\(.*\)$/.test(p));
        const first = rest[0];
        if (!first || first.endsWith('.tsx') || first.endsWith('.ts')) {
            return 'app.home';
        }
        return `app.${first.replace(/^\[|\]$/g, '')}`;
    }
    if (layer === 'shared' || layer === 'views') {
        return `${layer}.${parts[1] ?? 'root'}`;
    }
    // entities / features / widgets → 슬라이스 단위
    return `${layer}.${parts[1] ?? 'root'}`;
}

/** 파일 경로 → 키 접두사(파일 basename). */
export function keyPrefixFor(relPath) {
    const base = relPath.split('/').pop() ?? '';
    return base.replace(/\.(tsx?|jsx?)$/, '');
}

/**
 * 메시지 키를 만든다: `<Basename>.<hash6>`.
 *
 * **해시인 이유**: 순번(`Footer.1`)은 문자열이 하나 삽입되면 뒤가 전부 밀려
 * 카탈로그 diff가 통째로 뒤집힌다. 해시는 원문이 같으면 항상 같은 키라 재추출이
 * 안정적이다. 가독성은 카탈로그의 값(한국어 원문)이 바로 옆에 있으므로 충분하다.
 */
export function keyFor(prefix, text, taken) {
    const digest = createHash('sha1').update(text).digest('hex');
    for (let len = HASH_LENGTH; len <= 40; len += 2) {
        const key = `${prefix}.${digest.slice(0, len)}`;
        if (!taken.has(key) || taken.get(key) === text) return key;
    }
    throw new Error(`키 충돌을 해소하지 못했다: ${prefix} / ${text}`);
}

/** 재귀 탐색에서 통째로 건너뛸 디렉터리. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'coverage']);

/**
 * 번역 후보 파일 목록.
 *
 * **`grep`을 쓰지 않는다.** 예전에는
 * `execSync("grep -rl '[가-힣]' src --include='*.ts'")`였는데, 대괄호 범위
 * `[가-힣]`의 해석이 **로케일 collation에 의존한다**. macOS의 BSD grep은
 * `LC_ALL=C`에서도 받아 주지만 Ubuntu의 GNU grep은
 * `grep: Invalid collation character`로 죽는다 — 즉 이 게이트는 로컬에서만
 * 통과하고 **CI에서는 한 번도 돌지 않았다**(PR #762에서 드러났다).
 *
 * `HANGUL` 정규식은 JS 코드포인트 비교라 로케일과 무관하다. 파일 순회를
 * Node로 옮기면 그 차이가 원천적으로 사라지고 서브프로세스도 없어진다.
 */
export function candidateFiles(root) {
    const srcRoot = path.join(root, 'src');
    const out = [];

    const walk = dir => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) {
                    walk(path.join(dir, entry.name));
                }
                continue;
            }
            if (!/\.tsx?$/.test(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (HANGUL.test(readFileSync(full, 'utf8'))) {
                out.push(path.relative(root, full));
            }
        }
    };
    walk(srcRoot);

    return out.filter(f => !EXCLUDE_RE.test(f)).sort();
}

export function parseFile(_path, code) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
        errorRecovery: false,
    });
}

/**
 * 한 파일에서 번역 후보 노드를 찾는다.
 *
 * 반환되는 각 항목은 `{ kind, start, end, text, node, parents }`.
 * `parents`는 루트→노드 경로라 컨텍스트 판정(JSX 속성인지, 모듈 스코프인지)에 쓴다.
 */
export function collectCandidates(ast, code) {
    const found = [];
    const walk = (node, parents) => {
        if (!node || typeof node.type !== 'string') return;
        const chain = [...parents, node];

        if (node.type === 'StringLiteral' && HANGUL.test(node.value)) {
            found.push({
                kind: 'string',
                start: node.start,
                end: node.end,
                text: node.value,
                node,
                parents,
            });
        } else if (node.type === 'JSXText' && HANGUL.test(node.value)) {
            found.push({
                kind: 'jsx',
                start: node.start,
                end: node.end,
                text: node.value,
                node,
                parents,
            });
        } else if (
            node.type === 'TemplateLiteral' &&
            node.quasis.some(q => HANGUL.test(q.value.cooked ?? ''))
        ) {
            found.push({
                kind: 'template',
                start: node.start,
                end: node.end,
                text: code.slice(node.start, node.end),
                node,
                parents,
            });
            // 템플릿 내부의 문자열은 표현식 슬롯이라 별도 후보로 잡지 않는다.
            return;
        }

        for (const key in node) {
            if (
                key === 'loc' ||
                key === 'range' ||
                key === 'leadingComments' ||
                key === 'trailingComments' ||
                key === 'innerComments' ||
                key === 'comments'
            ) {
                continue;
            }
            const value = node[key];
            if (Array.isArray(value)) {
                for (const child of value) walk(child, chain);
            } else if (
                value &&
                typeof value === 'object' &&
                typeof value.type === 'string'
            ) {
                walk(value, chain);
            }
        }
    };
    walk(ast.program, []);
    return found;
}

export function readSource(root, relPath) {
    return readFileSync(`${root}/${relPath}`, 'utf8');
}
