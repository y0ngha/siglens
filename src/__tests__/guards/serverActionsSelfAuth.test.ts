import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';
import { blankComments } from './support/sourceScan';

/**
 * **회원 데이터를 만지는 서버 액션은 스스로 인증한다** 가드.
 *
 * `src/proxy.ts`의 `isServerActionRequest`는 서버 액션 POST(`Next-Action`)를 인증
 * 리다이렉트 가드에서 뺀다. 그게 안전한 전제는 "회원 데이터를 읽거나 쓰는 액션은
 * 전부 `getCurrentUser()`로 직접 세션을 확인한다"이다 — 프록시 가드는 쿠키 존재만
 * 보고, 액션 ID는 경로와 무관하게 실행되므로 애초에 보안 경계가 아니다(자세한 근거는
 * 그 JSDoc). 이 테스트가 그 전제를 강제한다.
 *
 * 판정: `'use server'` 모듈이 아래 `USER_SCOPED_SOURCES` 중 하나를 import하면, 그
 * 모듈의 **export된 함수마다** 본문에 `getCurrentUser(` 호출이 있어야 한다. 사용자
 * id를 클라이언트 인자로 받아 저장소에 넘기는 식의 액션이 여기서 걸린다.
 *
 * 한계(의도된 근사):
 *  - 함수 본문은 "이 `export async function`부터 다음 top-level `export`까지"로
 *    자른다. 그 사이에 놓인 비공개 헬퍼의 `getCurrentUser(`도 본문으로 센다.
 *  - 인증을 다른 헬퍼(`requireUser()` 등)로 감싸면 걸린다. 그때는 헬퍼 이름을
 *    `SESSION_CALL`에 더하거나 `PRE_AUTH_ALLOWLIST`에 이유와 함께 올린다.
 *
 * `logoutAction`·`currentUserAction`은 허용 목록에 없다 — 둘 다 `getCurrentUser()`를
 * 직접 불러 스스로 통과한다(세션이 없으면 각각 홈 리다이렉트·`null`).
 */
const SRC_DIR = path.resolve(__dirname, '../..');

/**
 * 회원 범위 데이터 소스(정규화한 `@/` import 경로). 2026-10-06 서버 액션 감사에서
 * `'use server'` 모듈 49개의 import를 전수로 뽑아 정했다.
 *  - portfolio·api-key·chat-conversation: 사용자별 행(`user_id`)을 읽고 쓰는 저장소.
 *  - auth/api: users·sessions 저장소. auth/lib/deleteAccount: 계정 삭제.
 *  - oauth-account/api: 사용자에 연결된 OAuth 계정. agreement/api: 사용자 약관 동의.
 *  - shared/lib/byokGate: `userId`로 등록 키(BYOK)와 tier를 조회한다 — `userId`를
 *    클라이언트 인자에서 받으면 남의 키로 분석을 돌릴 수 있다.
 * 새 사용자별 저장소를 만들면 여기에 더한다.
 */
const USER_SCOPED_SOURCES: readonly string[] = [
    '@/entities/portfolio/api',
    '@/entities/api-key/api',
    '@/entities/chat-conversation/api',
    '@/entities/auth/api',
    '@/entities/auth/lib/deleteAccount',
    '@/entities/oauth-account/api',
    '@/entities/agreement/api',
    '@/shared/lib/byokGate',
];

/** 세션 조회로 인정하는 호출. */
const SESSION_CALL = /\bgetCurrentUser\s*\(/;

/**
 * 세션 없이 도는 게 설계인 액션(`파일#export` → 이유). 가입·로그인 이전 흐름이라
 * 세션이 아니라 자격 증명·일회용 토큰으로 대상 사용자를 정한다.
 */
const PRE_AUTH_ALLOWLIST: ReadonlyMap<string, string> = new Map([
    [
        'features/auth-login/actions/loginAction.ts#loginAction',
        '로그인: 이메일·비밀번호를 검증해 세션을 만든다',
    ],
    [
        'features/auth-signup/actions/registerAction.ts#registerAction',
        '가입: 인증 메일 코드로 새 사용자를 만든다',
    ],
    [
        'features/auth-password-reset/actions/requestPasswordResetAction.ts#requestPasswordResetAction',
        '비밀번호 재설정 요청: 이메일로 토큰을 보낸다(열거 방지로 항상 같은 응답)',
    ],
    [
        'features/auth-password-reset/actions/confirmPasswordResetAction.ts#confirmPasswordResetAction',
        '비밀번호 재설정 확정: 메일로 받은 일회용 토큰이 대상 사용자를 정한다',
    ],
    [
        'features/auth-email-verification/actions/verifyEmailAction.ts#verifyEmailAction',
        '가입 전 이메일 코드 확인: 사용자 행은 중복 여부만 조회한다',
    ],
    [
        'features/auth-oauth-consent/actions/finalizeOAuthSignupAction.ts#finalizeOAuthSignupAction',
        'OAuth 가입 확정: 대기 중 가입 토큰(Redis)이 대상 프로필을 정한다',
    ],
]);

interface ExportedFunction {
    name: string;
    body: string;
}

const EXPORTED_FN = /^export\s+async\s+function\s+(\w+)/gm;
const TOP_LEVEL_EXPORT = /^export\s/gm;
const IMPORT_FROM = /\bfrom\s+'([^']+)'/g;

function isUseServerModule(source: string): boolean {
    return /^\s*['"]use server['"]/.test(blankComments(source));
}

/** import 경로를 `@/` 형태로 정규화한다(상대 경로 `../api` 포함). */
function normalisedImports(relPath: string, source: string): string[] {
    return [...source.matchAll(IMPORT_FROM)].map(([, spec]) => {
        if (!spec.startsWith('.')) return spec;
        const abs = path.resolve(
            path.dirname(path.join(SRC_DIR, relPath)),
            spec
        );
        return `@/${path.relative(SRC_DIR, abs).split(path.sep).join('/')}`;
    });
}

function exportedFunctions(source: string): ExportedFunction[] {
    const exportStarts = [...source.matchAll(TOP_LEVEL_EXPORT)].map(
        m => m.index
    );
    return [...source.matchAll(EXPORTED_FN)].map(match => {
        const end =
            exportStarts.find(start => start > match.index) ?? source.length;
        return { name: match[1]!, body: source.slice(match.index, end) };
    });
}

/** 위반을 `파일#export` 목록으로 돌려준다(허용 목록 적용 전). */
function selfAuthViolations(relPath: string, rawSource: string): string[] {
    const source = blankComments(rawSource);
    const touchesUserData = normalisedImports(relPath, source).some(spec =>
        USER_SCOPED_SOURCES.includes(spec)
    );
    if (!touchesUserData) return [];
    return exportedFunctions(source)
        .filter(fn => !SESSION_CALL.test(fn.body))
        .map(fn => `${relPath}#${fn.name}`);
}

function serverActionModules(): { relPath: string; source: string }[] {
    return sourceFiles(SRC_DIR)
        .map(file => path.relative(SRC_DIR, file).split(path.sep).join('/'))
        .filter(
            rel => !/(^|\/)__tests__\//.test(rel) && !/\.test\.tsx?$/.test(rel)
        )
        .map(rel => ({
            relPath: rel,
            source: readFileSync(path.join(SRC_DIR, rel), 'utf8'),
        }))
        .filter(({ source }) => isUseServerModule(source));
}

describe(
    '회원 데이터를 만지는 서버 액션은 getCurrentUser()로 스스로 인증한다',
    { timeout: SCAN_TIMEOUT_MS },
    () => {
        it('허용 목록 밖에 세션 확인 없는 회원 액션이 없다', () => {
            const offenders = serverActionModules()
                .flatMap(({ relPath, source }) =>
                    selfAuthViolations(relPath, source)
                )
                .filter(key => !PRE_AUTH_ALLOWLIST.has(key))
                .sort();
            expect(offenders).toEqual([]);
        });

        it('허용 목록 항목은 모두 실제로 존재하고 아직 필요하다(낡은 예외 금지)', () => {
            const flagged = new Set(
                serverActionModules().flatMap(({ relPath, source }) =>
                    selfAuthViolations(relPath, source)
                )
            );
            const stale = [...PRE_AUTH_ALLOWLIST.keys()]
                .filter(key => !flagged.has(key))
                .sort();
            expect(stale).toEqual([]);
        });

        it('스캔이 회원 액션을 실제로 회원 범위로 본다(판정이 공회전하지 않는다)', () => {
            const modules = serverActionModules();
            const byPath = new Map(modules.map(m => [m.relPath, m.source]));
            for (const rel of [
                'entities/portfolio/actions/savePortfolioHoldingAction.ts',
                'entities/api-key/actions/saveApiKeyAction.ts',
                'entities/chat-conversation/actions/renameConversationAction.ts',
                'features/account-delete/actions/deleteAccountAction.ts',
            ]) {
                expect(existsSync(path.join(SRC_DIR, rel))).toBe(true);
                const source = byPath.get(rel);
                expect(source, rel).toBeDefined();
                // 세션 호출만 지우면 위반으로 잡혀야 한다(뮤테이션 확인).
                const mutated = source!.replace(
                    /\bgetCurrentUser\s*\(/g,
                    'notASessionCall('
                );
                expect(selfAuthViolations(rel, mutated).length).toBeGreaterThan(
                    0
                );
            }
        });

        it('상대 경로 import와 주석 속 getCurrentUser도 올바르게 판정한다', () => {
            const rel = 'entities/chat-conversation/actions/fakeAction.ts';
            const source = [
                "'use server';",
                "import { DrizzleChatConversationRepository } from '../api';",
                '// getCurrentUser() 를 주석으로만 언급',
                'export async function fakeAction(userId: string) {',
                '    return userId;',
                '}',
            ].join('\n');
            expect(selfAuthViolations(rel, source)).toEqual([
                `${rel}#fakeAction`,
            ]);
        });
    }
);
