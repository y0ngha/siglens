import { parse } from '@babel/parser';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * E2E 스펙의 `getByRole('alert')`는 범위를 좁혀야 한다 (TESTING.md#TE-65).
 *
 * 모든 페이지에는 Next의 빈 route announcer(`role="alert"`)가 항상 있다.
 * `page.getByRole('alert')`는 그것과 앱 배너를 함께 잡아 strict mode에서 실패하고,
 * 로컬에선 배너가 안 떠 있어 통과하다가 CI에서만 깨진다.
 *
 * 허용되는 형태 두 가지:
 *  - `page.getByRole('alert').filter({ hasText })` — 텍스트로 좁힌다.
 *  - `page` 이외의 로케이터(컨테이너)에서 호출 — `region.getByRole('alert')`.
 *
 * "page에서 부른 호출"은 이름 `page`뿐 아니라 (a) 타입이 `Page`인 매개변수와
 * (b) `page`/`this.page`/이미 page로 판정된 이름으로 초기화한 `const` 별칭도 포함한다.
 * 한계: 파일 단위 이름 매칭이라 스코프를 구분하지 않는다(다른 함수의 같은 이름 컨테이너가
 * page 별칭과 겹치면 오탐 쪽으로 틀린다 — 이름을 바꿔 해소). 함수 반환값·구조분해·재할당
 * (`let`)으로 흘러든 Page는 추적하지 않는다.
 *
 * 좁히기로 인정하지 않는 형태: `hasText`가 `''`, `undefined`, `null`, 빈 문자열을 매칭하는
 * 정규식(`/^/`, `/.*` + `/`)인 경우. 빈 announcer도 그대로 통과시켜 좁히지 못한다.
 *
 * 주석·문자열 판별은 정규식이 아니라 babel AST로 한다. 키는 파일 + 호출 위치
 * (`file:line`)로 보고만 하고, 허용 목록은 두지 않는다 — 위반은 0건이어야 한다.
 */

const ROOT = path.resolve(__dirname, '../../..');
const E2E_DIR = path.join(ROOT, 'e2e');

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

function propertyName(member: AstNode): string | null {
    const property = member.property as AstNode;
    if (member.computed) {
        return property.type === 'StringLiteral'
            ? (property.value as string)
            : null;
    }
    return property.type === 'Identifier' ? (property.name as string) : null;
}

function isAlertRoleCall(node: AstNode): boolean {
    if (node.type !== 'CallExpression') return false;
    const callee = node.callee as AstNode;
    if (
        callee.type !== 'MemberExpression' &&
        callee.type !== 'OptionalMemberExpression'
    ) {
        return false;
    }
    if (propertyName(callee) !== 'getByRole') return false;
    const first = (node.arguments as AstNode[])[0];
    if (!first) return false;
    if (first.type === 'StringLiteral') return first.value === 'alert';
    if (first.type === 'TemplateLiteral') {
        const quasis = first.quasis as { value: { cooked: string } }[];
        return (
            (first.expressions as unknown[]).length === 0 &&
            quasis[0].value.cooked === 'alert'
        );
    }
    return false;
}

function isPageExpression(node: AstNode, pageNames: ReadonlySet<string>) {
    if (node.type === 'Identifier') return pageNames.has(node.name as string);
    if (node.type === 'MemberExpression') return propertyName(node) === 'page';
    return false;
}

function isPageTyped(node: AstNode): boolean {
    const annotation = node.typeAnnotation as AstNode | undefined;
    const inner = annotation?.typeAnnotation as AstNode | undefined;
    const name =
        inner?.type === 'TSTypeReference' ? (inner.typeName as AstNode) : null;
    return name?.type === 'Identifier' && name.name === 'Page';
}

function forEachNode(node: AstNode, fn: (node: AstNode) => void): void {
    fn(node);
    for (const [key, value] of Object.entries(node)) {
        if (
            key === 'loc' ||
            key === 'leadingComments' ||
            key === 'trailingComments'
        ) {
            continue;
        }
        for (const child of Array.isArray(value) ? value : [value]) {
            if (isNode(child)) forEachNode(child, fn);
        }
    }
}

/** 파일 안에서 page를 가리키는 이름: `page`, `Page` 타입 매개변수, page로 초기화한 `const` 별칭. */
function collectPageNames(program: AstNode): Set<string> {
    const names = new Set<string>(['page']);
    forEachNode(program, node => {
        if (node.type === 'Identifier' && isPageTyped(node)) {
            names.add(node.name as string);
        }
    });
    // 별칭의 별칭(`const a = page; const b = a;`)까지 고정점으로 푼다.
    let grew = true;
    while (grew) {
        grew = false;
        forEachNode(program, node => {
            if (node.type !== 'VariableDeclarator') return;
            const id = node.id as AstNode;
            const init = node.init as AstNode | null;
            if (id.type !== 'Identifier' || init === null) return;
            if (names.has(id.name as string)) return;
            if (isPageExpression(init, names)) {
                names.add(id.name as string);
                grew = true;
            }
        });
    }
    return names;
}

/** page(또는 별칭)에서 곧바로 부른 호출인가 — 컨테이너 범위가 아니다. */
function isCalledOnPage(
    call: AstNode,
    pageNames: ReadonlySet<string>
): boolean {
    return isPageExpression(
        (call.callee as AstNode).object as AstNode,
        pageNames
    );
}

/** 빈 문자열을 매칭하는 값은 아무것도 거르지 못한다. */
function isNoOpHasText(value: AstNode): boolean {
    switch (value.type) {
        case 'StringLiteral':
            return value.value === '';
        case 'TemplateLiteral':
            return (
                (value.expressions as unknown[]).length === 0 &&
                (value.quasis as { value: { cooked: string } }[])[0].value
                    .cooked === ''
            );
        case 'RegExpLiteral':
            try {
                return new RegExp(
                    value.pattern as string,
                    value.flags as string
                ).test('');
            } catch {
                return false;
            }
        case 'Identifier':
            return value.name === 'undefined';
        case 'NullLiteral':
            return true;
        default:
            return false;
    }
}

function hasTextProperty(arg: AstNode | undefined): boolean {
    if (!arg || arg.type !== 'ObjectExpression') return false;
    return (arg.properties as AstNode[]).some(prop => {
        const key = prop.key as AstNode | undefined;
        const isHasText =
            key !== undefined &&
            ((key.type === 'Identifier' && key.name === 'hasText') ||
                (key.type === 'StringLiteral' && key.value === 'hasText'));
        return isHasText && !isNoOpHasText(prop.value as AstNode);
    });
}

/** `call`이 `.filter({ hasText })`의 수신자인가. */
function isNarrowedByHasText(
    call: AstNode,
    parent: AstNode | null,
    grand: AstNode | null
) {
    if (
        parent?.type !== 'MemberExpression' ||
        parent.object !== call ||
        propertyName(parent) !== 'filter'
    ) {
        return false;
    }
    if (grand?.type !== 'CallExpression' || grand.callee !== parent)
        return false;
    return hasTextProperty((grand.arguments as AstNode[])[0]);
}

function findUnscopedAlertLocators(source: string): number[] {
    const ast = parse(source, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: ['typescript'],
    });
    const pageNames = collectPageNames(ast.program as unknown as AstNode);
    const lines: number[] = [];
    const visit = (
        node: AstNode,
        parent: AstNode | null,
        grand: AstNode | null
    ): void => {
        if (
            isAlertRoleCall(node) &&
            isCalledOnPage(node, pageNames) &&
            !isNarrowedByHasText(node, parent, grand)
        ) {
            lines.push(node.loc?.start.line ?? 0);
        }
        for (const [key, value] of Object.entries(node)) {
            if (
                key === 'loc' ||
                key === 'leadingComments' ||
                key === 'trailingComments'
            ) {
                continue;
            }
            const children = Array.isArray(value) ? value : [value];
            for (const child of children) {
                if (isNode(child)) visit(child, node, parent);
            }
        }
    };
    visit(ast.program as unknown as AstNode, null, null);
    return lines;
}

function e2eSources(): string[] {
    return readdirSync(E2E_DIR, { recursive: true, encoding: 'utf8' })
        .filter(rel => rel.endsWith('.ts'))
        .map(rel => rel.split(path.sep).join('/'))
        .sort();
}

describe('e2e/ 스펙의 getByRole("alert")는 범위가 좁혀져 있다', () => {
    it('스캔 대상이 비어 있지 않다', () => {
        expect(e2eSources().length).toBeGreaterThan(0);
    });

    it('page에서 바로 부른 getByRole("alert")는 .filter({ hasText })가 붙어 있다', () => {
        const offenders = e2eSources().flatMap(rel =>
            findUnscopedAlertLocators(
                readFileSync(path.join(E2E_DIR, rel), 'utf8')
            ).map(line => `e2e/${rel}:${line}`)
        );

        expect(offenders).toEqual([]);
    });

    it('판별 규칙: 범위 없는 호출만 잡고, 좁힌 호출·주석·컨테이너 호출은 통과시킨다', () => {
        const source = [
            "// page.getByRole('alert') in a comment",
            "const a = page.getByRole('alert');",
            'const b = page.getByRole("alert").first();',
            "const c = page.getByRole('alert').filter({ hasText: /x/ });",
            "const d = page.getByRole('alert').filter({ has: other });",
            "const e = region.getByRole('alert');",
            "const f = page.locator('main').getByRole('alert');",
            "const g = page.getByRole('button');",
        ].join('\n');

        expect(findUnscopedAlertLocators(source)).toEqual([2, 3, 5]);
    });

    it('판별 규칙: Page 타입 매개변수와 page 별칭도 page로 본다', () => {
        const source = [
            "function a(p: Page) { return p.getByRole('alert'); }",
            "const b = async (view: Page) => view.getByRole('alert').first();",
            'const alias = page;',
            "const c = alias.getByRole('alert');",
            'const d = this.page;',
            "const e = d.getByRole('alert');",
            "const f = alias.getByRole('alert').filter({ hasText: /x/ });",
            "const g = page.locator('main');",
            "const h = g.getByRole('alert');",
        ].join('\n');

        expect(findUnscopedAlertLocators(source)).toEqual([1, 2, 4, 6]);
    });

    it('판별 규칙: 빈 값 hasText는 좁히기로 인정하지 않는다', () => {
        const source = [
            "const a = page.getByRole('alert').filter({ hasText: '' });",
            "const b = page.getByRole('alert').filter({ hasText: undefined });",
            "const c = page.getByRole('alert').filter({ hasText: /^/ });",
            "const d = page.getByRole('alert').filter({ hasText: /.*/ });",
            "const e = page.getByRole('alert').filter({ hasText: `` });",
            "const f = page.getByRole('alert').filter({ hasText: /\\S/ });",
            "const g = page.getByRole('alert').filter({ hasText: 'x' });",
        ].join('\n');

        expect(findUnscopedAlertLocators(source)).toEqual([1, 2, 3, 4, 5]);
    });
});
