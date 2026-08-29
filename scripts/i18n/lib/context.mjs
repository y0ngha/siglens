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

/**
 * SEO 키워드 배열 안의 문자열인가.
 *
 * 검색 키워드는 번역문이 아니라 그 언어권에서 실제로 치는 질의다. 기계번역하면
 * 아무도 검색하지 않는 문자열이 들어간다. `<meta name="keywords">`는 Google이
 * 무시하고 네이버만 보는데 네이버는 한국어 질의를 다루므로, 이 값들은 ko 전용
 * 데이터로 남긴다(`localeKeywords`가 비-ko에서 태그 자체를 뺀다).
 */
function isSeoKeyword(parents) {
    return parents.some(
        p =>
            (p.type === 'ObjectProperty' && p.key?.name === 'keywords') ||
            (p.type === 'VariableDeclarator' &&
                p.id?.type === 'Identifier' &&
                /**
                 * `ROOT_KEYWORDS` 같은 모듈 상수뿐 아니라 `const keywords = [...]`
                 * 지역 변수도 포함한다 — 라우트가 메타데이터를 만들면서 배열을
                 * 지역 변수에 담았다가 `keywords:`에 넘기면 위 `ObjectProperty`
                 * 검사는 닿지 않는다.
                 */
                /^(?:keywords|.*Keywords|.*KEYWORDS)$/.test(p.id.name)) ||
            /**
             * `build*Keywords(...)` 함수가 **반환하는** 배열도 keywords다.
             *
             * 상수·객체 속성만 보면 `buildSymbolKeywords`처럼 심볼을 받아
             * 배열을 만드는 함수 안의 문자열 156개가 "미추출"로 남는다 —
             * 설계 §5.1에서 ko 전용으로 확정한 그 값들이다.
             */
            /**
             * `keywords: [...]` 안의 배열 원소도 keywords다 — 위 `ObjectProperty`
             * 검사는 값이 배열이면 원소까지 못 따라간다.
             */
            (p.type === 'ArrayExpression' &&
                parents.some(
                    q =>
                        q.type === 'ObjectProperty' &&
                        q.key?.name === 'keywords'
                )) ||
            ((p.type === 'FunctionDeclaration' ||
                p.type === 'FunctionExpression' ||
                p.type === 'ArrowFunctionExpression') &&
                (p.id?.name ?? '').endsWith('Keywords'))
    );
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
/**
 * 표시 번역이 카탈로그로 옮겨진 데이터 config — 여기 남은 한국어는 원본이다.
 * 새 파일을 넣기 전에 **화면이 정말 카탈로그를 조회하는지** 확인할 것.
 */
/**
 * 자산군 별칭 표 — 표시 문자열이 아니라 **커버리지 검사 데이터**다.
 * `supportedAssets.test.ts`가 "모든 SEO 표면이 모든 자산군을 언급하는지"를
 * ko 카피 기준으로 검사할 때 쓴다(§SUPPORTED_ASSET_TERMS JSDoc).
 */
const ASSET_TERM_DATA_RE = /src\/shared\/config\/supportedAssets\.ts$/;

/**
 * **E2E 전용 스텁·픽스처.**
 *
 * `E2E_*` 환경 플래그가 켜졌을 때만 실행되는 결정적 응답이다. 프로덕션 렌더
 * 경로에 닿지 않으므로 번역 대상이 아니고, 번역하면 오히려 로케일마다 다른
 * 문자열을 단언해야 해서 E2E가 깨진다.
 */
/**
 * **한국어 문법 모듈.**
 *
 * 조사(`과`/`와`) 같은 값은 로케일 문구가 아니라 한국어 문법 그 자체다. ICU에
 * 받침 규칙이 없어 판정을 소스가 해야 하고, 다른 로케일은 이 모듈을 쓰지 않는다.
 */
/**
 * **자국어 표기 테이블.**
 *
 * 언어 스위처는 각 언어를 그 언어의 문자로 보여준다 — 영어권 사용자가 `영어`를
 * 못 읽기 때문이다. 번역하면 기능이 망가진다.
 */
const NATIVE_LABEL_DECLARATOR = 'LOCALE_NATIVE_LABEL';

const KO_GRAMMAR_RE =
    /src\/shared\/lib\/(koParticle|formatKoreanDateTime)\.ts$/;

const E2E_STUB_RE =
    /src\/shared\/api\/e2eAnalysisStub\.ts$|src\/entities\/llm-provider\/api\/FakeChatProvider\.ts$|src\/entities\/ticker\/actions\/searchTickerAction\.ts$/;

/**
 * **로그·폴백용 한국어 원문을 담는 use-case 모듈.**
 *
 * 이 파일들의 `*_MESSAGE` 상수는 화면에 나가지 않는다 — 표시는 UI 경계가
 * 에러 `code`를 `AUTH_ERROR_KEY`로 번역해서 한다. 원문은 코드가 표에 없을 때의
 * 마지막 방어선이자 서버 로그용이다.
 *
 * **좁게 유지할 것**: 이름이 `_MESSAGE`로 끝나는 모듈 상수만 면제한다.
 * 그러지 않으면 이 디렉터리의 진짜 화면 문구까지 조용히 묻힌다.
 */
const LOG_FALLBACK_MESSAGE_DIR_RE = /^src\/entities\/auth\/lib\//;

const CATALOG_BACKED_DATA_RE =
    /src\/shared\/config\/(canonical-korean-names|popular-tickers|dashboard-tickers|dashboard-tickers-kr|crypto-categories|economyIndicators|economyIndicatorsKr|economyLabelKey|tickerCategoryLabel)\.ts$|src\/entities\/economy\/lib\/indicatorNameKo\.ts$|src\/entities\/market-news\/lib\/categoryConfig\.ts$/;

/**
 * **개발자에게만 보이는 진단 문자열**인가 — 콘솔 로그와 `[tag]` 접두 throw.
 *
 * 이 문자열들은 화면에 나가지 않는다. 서버 로그(CloudWatch)와 빌드 실패
 * 메시지로만 쓰이고, 읽는 사람은 운영자다. 번역하면 로그 검색어가 로케일마다
 * 갈려 장애 대응이 오히려 느려진다.
 *
 * throw는 **`[모듈]` 접두가 붙은 것만** 인정한다. 접두 없는 `new Error(...)`는
 * 사용자에게 노출될 수 있어(에러 바운더리·서버 액션 반환) 자동으로 면제하면
 * 진짜 누락을 묻는다.
 */
function isDeveloperDiagnostic(parents, code) {
    for (let i = parents.length - 1; i >= 0; i -= 1) {
        const node = parents[i];
        if (node.type !== 'CallExpression' && node.type !== 'NewExpression') {
            continue;
        }
        const callee = node.callee;
        if (
            callee?.type === 'MemberExpression' &&
            callee.object?.type === 'Identifier' &&
            callee.object.name === 'console'
        ) {
            return true;
        }
        if (
            node.type === 'NewExpression' &&
            callee?.type === 'Identifier' &&
            callee.name === 'Error'
        ) {
            // 인자 소스에 `[모듈]` 접두가 있는지 본다. 여러 조각으로 이어 붙인
            // 메시지(`\`[seo] …\` + \`…\``)에서도 첫 조각의 접두가 잡힌다.
            const args = node.arguments ?? [];
            const first = args[0];
            if (first && typeof first.start === 'number') {
                return /^[`'"]\s*\[[a-zA-Z]/.test(
                    code.slice(first.start, first.start + 12)
                );
            }
        }
    }
    return false;
}

export function classify({ candidate, filePath, code }) {
    const { parents, node, kind } = candidate;

    if (isInsideTranslatorCall(parents)) {
        return { applicable: false, reason: 'already-translated' };
    }
    if (isModuleSpecifier(parents, node)) {
        return { applicable: false, reason: 'module-specifier' };
    }
    if (isSeoKeyword(parents)) {
        return { applicable: false, reason: 'seo-keywords-ko-only' };
    }
    if (code !== undefined && isDeveloperDiagnostic(parents, code)) {
        return { applicable: false, reason: 'developer-diagnostic' };
    }
    if (KO_GRAMMAR_RE.test(filePath)) {
        return { applicable: false, reason: 'ko-grammar' };
    }
    if (
        parents.some(
            p =>
                p.type === 'VariableDeclarator' &&
                p.id?.type === 'Identifier' &&
                p.id.name === NATIVE_LABEL_DECLARATOR
        )
    ) {
        return { applicable: false, reason: 'native-language-label' };
    }
    /**
     * **AI 프롬프트 빌더.**
     *
     * `build*Prompt()` 안의 문자열은 화면 문구가 아니라 모델 지시문이다.
     * 로케일로 갈리면 프롬프트만 흔들리고, 응답 언어는 프롬프트의 언어 지시가
     * 따로 정한다. `koreanTranslator`처럼 **한국어 산출물을 요구하는** 프롬프트는
     * 한국어가 지시문의 일부라 번역 자체가 성립하지 않는다.
     */
    if (
        parents.some(
            p =>
                (p.type === 'FunctionDeclaration' ||
                    p.type === 'FunctionExpression' ||
                    p.type === 'ArrowFunctionExpression') &&
                /^build[A-Za-z]*Prompt$/.test(p.id?.name ?? '')
        )
    ) {
        return { applicable: false, reason: 'ai-prompt' };
    }
    if (E2E_STUB_RE.test(filePath)) {
        return { applicable: false, reason: 'e2e-stub' };
    }
    if (
        LOG_FALLBACK_MESSAGE_DIR_RE.test(filePath) &&
        parents.some(
            p =>
                p.type === 'VariableDeclarator' &&
                p.id?.type === 'Identifier' &&
                p.id.name.endsWith('_MESSAGE')
        )
    ) {
        return { applicable: false, reason: 'log-fallback-message' };
    }
    /**
     * **표시 번역이 이미 카탈로그로 옮겨진 데이터 config.**
     *
     * 이 파일들의 한국어는 표시 문자열이 아니라 **원본 데이터**다 — 티커
     * 한국어명(`shared.assetName`), 경제 지표 사전(영문→한국어), 섹터 라벨
     * (`widgets.home.tickerCategory`). 화면은 전부 카탈로그를 심볼·키로 조회하고,
     * 이 값들은 폴백·AI 프롬프트·사이트맵이 읽는다.
     *
     * 그래서 "미추출"로 세면 영원히 줄지 않는 잔고가 되고, 진짜 누락이 그 안에
     * 묻힌다. 별도 사유로 분리해 **의도된 데이터**임을 명시한다.
     */
    if (CATALOG_BACKED_DATA_RE.test(filePath)) {
        return { applicable: false, reason: 'catalog-backed-data' };
    }
    if (ASSET_TERM_DATA_RE.test(filePath)) {
        return { applicable: false, reason: 'catalog-backed-data' };
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
