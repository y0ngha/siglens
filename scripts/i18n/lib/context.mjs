/**
 * 후보 문자열의 **치환 가능 여부**와 **치환 형태**를 판정한다.
 *
 * codemod가 자동으로 손대도 안전한 경우만 `applicable: true`를 돌려주고,
 * 나머지는 사유와 함께 스킵 리포트로 넘긴다. "일단 바꾸고 나중에 고친다"는
 * 367파일 규모에서 회귀를 만들 뿐이다.
 */

/** 컴포넌트로 볼 수 있는 함수 노드인지 — 이름이 대문자로 시작하고 JSX를 반환한다. */
function isComponentFunction(node) {
    if (!node) return false;
    const name =
        node.id?.name ??
        (node.type === 'ArrowFunctionExpression' ? null : undefined);
    return typeof name === 'string' && /^[A-Z]/.test(name);
}

/**
 * 후보를 감싸는 가장 가까운 "컴포넌트 함수"를 찾는다.
 *
 * 변수 선언에 붙은 화살표 함수(`const Foo = () => …`)도 컴포넌트로 인정한다 —
 * 이 레포에 두 형태가 섞여 있다.
 */
export function enclosingComponent(parents) {
    for (let i = parents.length - 1; i >= 0; i -= 1) {
        const node = parents[i];
        if (node.type === 'FunctionDeclaration' && isComponentFunction(node)) {
            return node;
        }
        if (
            node.type === 'ArrowFunctionExpression' ||
            node.type === 'FunctionExpression'
        ) {
            const parent = parents[i - 1];
            if (
                parent?.type === 'VariableDeclarator' &&
                parent.id?.type === 'Identifier' &&
                /^[A-Z]/.test(parent.id.name)
            ) {
                return node;
            }
        }
    }
    return null;
}

/** 후보가 JSX 속성 값 위치에 있는가(`title="…"`). */
function isJsxAttributeValue(parents, node) {
    const parent = parents[parents.length - 1];
    return parent?.type === 'JSXAttribute' && parent.value === node;
}

/** 후보가 이미 `t(...)` 호출 안에 있는가 — 재실행 멱등성. */
function isInsideTranslatorCall(parents) {
    return parents.some(
        p =>
            p.type === 'CallExpression' &&
            ((p.callee?.type === 'Identifier' && p.callee.name === 't') ||
                (p.callee?.type === 'MemberExpression' &&
                    p.callee.object?.name === 't'))
    );
}

/**
 * import/export 구문의 **모듈 경로**이거나 타입 레벨 리터럴인가.
 *
 * ⚠️ 조상 전체를 훑으면 안 된다 — `export const LABEL = '한국어'`는 조상에
 * `ExportNamedDeclaration`이 있어서 번역 대상 전부가 통째로 걸러진다(실측 1,785건).
 * 직계 부모와 해당 슬롯만 본다.
 */
function isModuleSpecifier(parents, node) {
    const parent = parents[parents.length - 1];
    if (!parent) return false;
    if (
        (parent.type === 'ImportDeclaration' ||
            parent.type === 'ExportNamedDeclaration' ||
            parent.type === 'ExportAllDeclaration') &&
        parent.source === node
    ) {
        return true;
    }
    // 타입 레벨 리터럴은 값이 아니라 타입이다 — 번역하면 타입이 깨진다.
    return parent.type === 'TSLiteralType' || parent.type === 'TSEnumMember';
}

/**
 * 판정 결과.
 *
 * @returns `{ applicable, replacement, reason }`
 *   - `replacement`: `'jsx-expression'`(`{t('k')}`) 또는 `'call'`(`t('k')`)
 */
export function classify({ candidate, filePath }) {
    const { parents, node, kind } = candidate;

    if (isInsideTranslatorCall(parents)) {
        return { applicable: false, reason: 'already-translated' };
    }
    if (isModuleSpecifier(parents, node)) {
        return { applicable: false, reason: 'module-specifier' };
    }
    // `.ts` 파일에는 컴포넌트가 없다 — 상수/유틸이라 소비자 쪽 리팩터가 필요하다.
    if (!filePath.endsWith('.tsx')) {
        return { applicable: false, reason: 'non-component-module' };
    }

    const component = enclosingComponent(parents);
    if (!component) {
        return { applicable: false, reason: 'module-scope-or-helper' };
    }
    // 파라미터 기본값(`function C({ label = '한국어' })`)은 컴포넌트 **본문 밖**이라
    // `const t = useTranslations(...)`가 아직 선언되지 않았다. 치환하면 `t is not
    // defined`가 되는데, 이건 오프셋만 보면 컴포넌트 안쪽이라 다른 검사로는 안 걸린다.
    if (
        component.body?.start !== undefined &&
        candidate.start < component.body.start
    ) {
        return { applicable: false, reason: 'parameter-default' };
    }
    // 표현식 본문(`const X = () => <div/>`)은 `const t = …`를 넣을 자리가 없다.
    // 여기서 걸러내지 않으면 extract.mjs가 `{t('key')}` 치환은 큐에 넣고 바인딩
    // 주입만 나중에 건너뛰어, **`t`가 정의되지 않은 파일**을 써 버린다.
    if (component.body?.type !== 'BlockStatement') {
        return { applicable: false, reason: 'expression-body-component' };
    }
    if (kind === 'template') {
        // 템플릿은 표현식 슬롯을 ICU 인자로 바꿔야 해서 원문 의미가 달라질 수 있다.
        // 사람이 문장 구조를 확인해야 하므로 자동 치환하지 않는다.
        return { applicable: false, reason: 'template-needs-icu-review' };
    }

    /**
     * `useTranslations`는 **서버 컴포넌트에서도 동작한다**(next-intl의
     * `react-server` 진입점). 따라서 동기 컴포넌트는 클라이언트/서버 구분 없이
     * 같은 훅을 쓴다. `getTranslations`는 훅을 부를 수 없는 async 컴포넌트에서만
     * 필요하다.
     */
    const binding = component.async ? 'get' : 'hook';

    if (kind === 'jsx' || isJsxAttributeValue(parents, node)) {
        return {
            applicable: true,
            replacement: 'jsx-expression',
            component,
            binding,
        };
    }
    return { applicable: true, replacement: 'call', component, binding };
}
