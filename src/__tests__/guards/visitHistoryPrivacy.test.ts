vi.mock('server-only', () => ({}));

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_MAX_BYTES } from '@/entities/feedback/lib/constants';
import { parseAiFeedbackInput } from '@/entities/feedback/lib/validation';
import { GUEST_RETURN_WINDOWS } from '@/entities/visitor/lib/visitHistory';
import { ENTRY_SOURCES, type EntrySource } from '@/entities/visitor/types';
import { LOCALES } from '@/shared/i18n/locales';
import { SHARE_MARKS_MAX_CREATED } from '@/shared/lib/funnel/shareMarks';
import * as storageKeys from '@/shared/lib/storageKeys';
import { STORAGE_KEYS, STORAGE_PREFIX } from '@/widgets/chart/constants';

/**
 * 방문 이력·공유 표식·브라우저 저장소·쿠키는 개인정보처리방침이 고지한 범위 안에서만 쓴다.
 *
 * 방침(§2·§7)은 저장 키, 쿠키 이름, 재방문 창의 일수와 수명을 적는다. 코드를 바꾸고 방침을 안 고치면
 * 방침이 거짓이 되고, 방침만 바꾸면 고지가 코드를 앞서 나간다. **가장 높은 버전**의 원문을 읽으므로 다음
 * 방침 버전이 이 문구를 지우면 이 테스트가 깨진다.
 *
 * 저장 키는 소스를 직접 훑어 찾는다(`setItem(`과 `usePersistentState(`의 첫 인자). 첫 인자를 해석하지
 * 못한 호출은 **실패**다(TE-63) — 새 쓰기를 조용히 놓치지 않는다. 새 저장 키나 쿠키를 만들면 §7에 적는다.
 */
const PRIVACY_DIR = path.resolve(process.cwd(), 'db/seeds/terms/privacy');
const SRC_DIR = path.resolve(process.cwd(), 'src');
const ORIGINAL_FILE = /^v(\d+)\.md$/;

function highestOriginalVersion(): number {
    return Math.max(
        ...readdirSync(PRIVACY_DIR).flatMap(name => {
            const match = ORIGINAL_FILE.exec(name);
            return match?.[1] === undefined ? [] : [Number(match[1])];
        })
    );
}

const VERSION = highestOriginalVersion();
const readPolicy = (suffix: string): string =>
    readFileSync(path.join(PRIVACY_DIR, `v${VERSION}${suffix}.md`), 'utf8');

/** §7(쿠키 및 로컬 스토리지) 본문만. 다른 절에 우연히 적힌 키는 인정하지 않는다. */
function section7(policy: string): string {
    const start = policy.search(/^## 7\./m);
    const end = policy.search(/^## 8\./m);
    return start === -1 || end === -1 ? '' : policy.slice(start, end);
}

const KO = readPolicy('');
const KO_7 = section7(KO);
const NON_KO = LOCALES.filter(locale => locale !== 'ko');
const POLICY_7: Record<string, string> = Object.fromEntries([
    ['ko', KO_7],
    ...NON_KO.map(locale => [locale, section7(readPolicy(`.${locale}`))]),
]);

/** `text`에 이름으로 적히지 않은 항목. */
function missing(text: string, needles: readonly string[]): string[] {
    return needles.filter(needle => !text.includes(needle));
}

// ---------------------------------------------------------------------------
// 소스 스캔
// ---------------------------------------------------------------------------

type SourceFiles = Readonly<Record<string, string>>;

function stripComments(code: string): string {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function loadSources(): SourceFiles {
    return Object.fromEntries(
        readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
            .filter(file => /\.(ts|tsx)$/.test(file))
            .filter(
                file => !/(__tests__|\.test\.|\.spec\.|\.dom-fast\.)/.test(file)
            )
            .map(file => [
                file,
                stripComments(readFileSync(path.join(SRC_DIR, file), 'utf8')),
            ])
    );
}

const CONST_RE =
    /\bconst\s+([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(['"`])((?:(?!\2)[^\\\n$])*)\2/g;

function constsOf(code: string): Map<string, string> {
    return new Map(
        [...code.matchAll(CONST_RE)].flatMap(match =>
            match[1] === undefined || match[3] === undefined
                ? []
                : [[match[1], match[3]] as const]
        )
    );
}

function globalConsts(files: SourceFiles): Map<string, string> {
    return new Map(Object.values(files).flatMap(code => [...constsOf(code)]));
}

/**
 * 저장소에 쓰는 호출의 첫 인자 해석이 필요 없는 **내부 구현**. 호출하는 쪽은 따로 스캔되므로
 * (`usePersistentState(`의 첫 인자) 여기서는 키를 알 수 없는 변수 이름이 그대로 쓰인다.
 */
const WRAPPER_INTERNALS: ReadonlySet<string> = new Set([
    // 범용 영속 훅. 키는 호출부가 넘기고, 호출부 첫 인자를 이 스캔이 따로 본다.
    'shared/hooks/usePersistentState.ts::key',
    // 이동평균 오버레이 훅. 키는 호출부가 `STORAGE_KEYS.maPeriods`·`STORAGE_KEYS.emaPeriods`로 넘기며,
    // 두 값이 `siglens.chart.` 접두를 쓰는지는 아래 테스트가 본다.
    'widgets/chart/hooks/useMovingAverageOverlay.ts::storageKey',
]);

const CALL_RE =
    /\b(setItem|usePersistentState)\b(?:<[\s\S]*?>)?\(\s*([A-Za-z_$][\w$.]*|'[^']*'|"[^"]*"|`[^`]*`)\s*([,)(])/g;
const ANY_CALL_RE = /\b(?:setItem|usePersistentState)\b(?:<[\s\S]*?>)?\(/g;
const DECLARATION_RE =
    /\b(?:function\s+usePersistentState|setItem)\b[^(]*\(\s*\w+\s*:/g;

interface KeyScan {
    /** 해석된 저장 키(쓰기 쪽). */
    readonly keys: Set<string>;
    /** 해석하지 못한 호출 — 하나라도 있으면 가드가 실패한다. */
    readonly unparsed: string[];
}

function scanStorageWrites(files: SourceFiles): KeyScan {
    const consts = globalConsts(files);
    const keys = new Set<string>();
    const unparsed: string[] = [];
    for (const [file, code] of Object.entries(files)) {
        const local = constsOf(code);
        const matched = [...code.matchAll(CALL_RE)];
        const total = [...code.matchAll(ANY_CALL_RE)].length;
        const declarations = [...code.matchAll(DECLARATION_RE)].length;
        if (matched.length + declarations !== total) {
            unparsed.push(`${file}::<호출 형태를 읽지 못함>`);
        }
        for (const match of matched) {
            const expr = match[2] ?? '';
            if (WRAPPER_INTERNALS.has(`${file}::${expr}`)) continue;
            const literal = /^(['"`])([^$]*)\1$/.exec(expr);
            if (literal?.[2] !== undefined) {
                keys.add(literal[2]);
            } else if (expr.startsWith('STORAGE_KEYS.')) {
                // 차트 키 — `STORAGE_PREFIX.`로 시작함은 아래 테스트가 따로 확인한다.
                keys.add(`${STORAGE_PREFIX}.`);
            } else {
                const resolved = local.get(expr) ?? consts.get(expr);
                if (resolved === undefined) unparsed.push(`${file}::${expr}`);
                else keys.add(resolved);
            }
        }
    }
    return { keys, unparsed };
}

/** 쿠키를 심거나 지우는 코드가 있는 파일. 새 파일이 생기면 목록에 올리고 방침 §7과 대조한다. */
const COOKIE_WRITE_RE =
    /\b(?:cookies\.set|cookieStore\.set|store\.set|document\.cookie\s*=)/;

function cookieWriterFiles(files: SourceFiles): string[] {
    return Object.entries(files)
        .filter(([, code]) => COOKIE_WRITE_RE.test(code))
        .map(([file]) => file)
        .toSorted();
}

const COOKIE_NAME_CONST_RE =
    /\bconst\s+([A-Z_]*COOKIE(?:_BASE)?_NAME)\s*=\s*'([^'$]+)'/g;

/** 앱이 직접 심는 쿠키 이름(상수로 정의된 것). 시험 전용 `e2e_` 쿠키는 앱이 심지 않는다. */
function cookieNames(files: SourceFiles): string[] {
    return [
        ...new Set(
            Object.values(files).flatMap(code =>
                [...code.matchAll(COOKIE_NAME_CONST_RE)].flatMap(m =>
                    m[2] === undefined || m[2].startsWith('e2e_') ? [] : [m[2]]
                )
            )
        ),
    ].toSorted();
}

const SOURCES = loadSources();

/**
 * 쿠키를 심는 파일(현재). 새 파일이 `cookies.set` 등을 부르면 여기서 깨진다 — 그 쿠키를 §7에 적고
 * `cookieNames`가 이름을 잡는지 본 뒤 이 목록에 올린다.
 */
const EXPECTED_COOKIE_WRITERS = [
    'app/api/auth/[provider]/start/route.ts',
    'app/api/auth/callback/_lib/loginRedirect.ts',
    'app/api/auth/callback/_lib/redirectSignedIn.ts',
    'app/api/auth/callback/_lib/redirectToConsent.ts',
    'app/api/auth/handoff/consume/route.ts',
    'app/api/auth/handoff/logout/route.ts',
    'app/api/auth/handoff/start/route.ts',
    'entities/auth/actions/currentUserAction.ts',
    'entities/auth/lib/mainSessionHintCookie.ts',
    'entities/mail-alert/server/mailAlertGuestCookie.ts',
    'features/account-delete/actions/deleteAccountAction.ts',
    'features/auth-login/actions/loginAction.ts',
    'features/auth-logout/actions/logoutAction.ts',
    'features/auth-oauth-consent/actions/finalizeOAuthSignupAction.ts',
    'features/auth-signup/actions/registerAction.ts',
    'proxy.ts',
    'shared/api/guestId.ts',
    'shared/lib/funnel/signupCookie.ts',
    'shared/lib/googleAds.ts',
];

/** 구글 태그가 심는 쿠키 접두. 앱 상수가 아니라 방침이 이름으로 적는다. */
const THIRD_PARTY_COOKIES = ['_gcl_'];

const { d7, d30 } = GUEST_RETURN_WINDOWS;

/**
 * `storageKeys.ts` 레지스트리 중 이름 대신 **글로 덮이는** 키와 그 글. 각 문구가 한국어 §7에 글자 그대로
 * 있어야 한다(키 이름이 아니라 내용을 가리키는 문장이라, 문구가 사라지면 키가 고지되지 않은 것이다).
 */
const COVERED_BY_SENTENCE: Partial<Record<keyof typeof storageKeys, string>> = {
    LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY: '오늘 분석한 종목 목록',
    LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY: '오늘 안내 창을 띄웠는지 여부',
    LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY: '마지막으로 보여 준 안내 문구의 종류',
    LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY:
        '메일 리포트 설정 안내를 띄웠는지 여부',
    SESSION_STORAGE_NUDGE_SHOWN_KEY: '이번 탭에서 안내 창을 이미 띄웠는지 여부',
};

const REGISTRY = Object.entries(storageKeys);

/** 이름으로 §7에 적혀야 하는 레지스트리 키(글로 덮이는 것 제외). */
function namedRegistryKeys(): string[] {
    return REGISTRY.filter(([name]) => !(name in COVERED_BY_SENTENCE)).map(
        ([, key]) => key
    );
}

describe(`재방문 이력 ↔ 방침 v${VERSION}`, () => {
    it('§7이 방문 이력·공유 표식·조회 중복 방지·전송 마커 키를 고지한다', () => {
        expect(
            missing(KO_7, [
                'siglens:visit-history:v1',
                storageKeys.LOCAL_STORAGE_SHARE_MARKS_KEY,
                'siglens:symbol-views',
                'siglens:visit:v2',
            ])
        ).toEqual([]);
    });

    /**
     * 앱 설치 안내가 저장된 첫 방문 날짜를 읽는다(`readIsReturnVisitDay`). 저장 목적이 "집계"뿐이던
     * 항목에 두 번째 용도가 생겼으므로, 읽기만 하고 서버로 더 보내지 않는다는 문장이 모든 로케일의 같은
     * 항목에 있어야 한다. 문장이 사라지면 코드가 고지를 앞서 나간 것이다(CS-14).
     */
    const INSTALL_PROMPT_READ_PHRASE: Record<string, string> = {
        ko: '앱 설치 안내',
        en: 'app install prompt',
        ja: 'アプリのインストール案内',
        zh: '应用安装提示',
    };

    /** 약속의 뒷절: 이 읽기 때문에 서버로 더 보내는 정보는 없다. 이 절을 지우는 개정을 잡는다. */
    const NOTHING_MORE_SENT_PHRASE: Record<string, string> = {
        ko: '서버로 더 전송되는 정보는 없습니다',
        en: 'Nothing more is sent to the server',
        ja: 'サーバーへ追加で送信される情報はありません',
        zh: '不会向服务器额外发送任何信息',
    };

    /** 비회원 안내 문구 항목(§7)을 찾는 각 로케일의 시작 문구. */
    const GUEST_NUDGE_LINE_MARKER: Record<string, string> = {
        ko: '- 비회원:',
        en: '- Non-members:',
        ja: '- 非会員:',
        zh: '- 非会员:',
    };

    /**
     * 비회원 가입 안내 창도 같은 첫 방문 날짜를 읽는다(`useAnonAnalysisNudge`의 `readIsReturnVisitDay`).
     * 두 번째 읽기 용도이므로 같은 항목이 가입 안내 창을 이름으로 적어야 한다.
     */
    const SIGNUP_PROMPT_READ_PHRASE: Record<string, string> = {
        ko: '회원가입 안내 창',
        en: 'signup prompt',
        ja: '会員登録の案内',
        zh: '注册提示',
    };

    /** 안내 문구를 한 번씩만 보여 주는 동작(`claimNextAnonNudgeVariant`)의 고지 문구. */
    const NUDGE_NOT_REPEATED_PHRASE: Record<string, string> = {
        ko: '다시 띄우지 않는',
        en: 'is not shown again',
        ja: '再び表示しない',
        zh: '不再显示相同',
    };

    it.each(LOCALES)(
        '%s 방문 이력 항목이 회원가입 안내 창을 위한 첫 방문 날짜 읽기를 고지한다',
        locale => {
            const line =
                (POLICY_7[locale] ?? '')
                    .split('\n')
                    .find(l => l.includes('siglens:visit-history:v1')) ?? '';
            expect(line).toContain(SIGNUP_PROMPT_READ_PHRASE[locale] ?? '');
        }
    );

    it.each(LOCALES)(
        '%s 비회원 안내 문구 항목이 같은 문구를 다시 띄우지 않는 용도를 고지한다',
        locale => {
            const line =
                (POLICY_7[locale] ?? '')
                    .split('\n')
                    .find(l =>
                        l.includes(GUEST_NUDGE_LINE_MARKER[locale] ?? '')
                    ) ?? '';
            expect(line).not.toBe('');
            expect(line).toContain(NUDGE_NOT_REPEATED_PHRASE[locale] ?? '');
        }
    );

    it.each(LOCALES)(
        '%s 방문 이력 항목이 앱 설치 안내를 위한 첫 방문 날짜 읽기를 고지한다',
        locale => {
            const line =
                (POLICY_7[locale] ?? '')
                    .split('\n')
                    .find(l => l.includes('siglens:visit-history:v1')) ?? '';
            expect(line).not.toBe('');
            expect(line).toContain(INSTALL_PROMPT_READ_PHRASE[locale] ?? '');
            expect(line).toContain(NOTHING_MORE_SENT_PHRASE[locale] ?? '');
        }
    );

    it('원문이 재방문 창의 일수(GUEST_RETURN_WINDOWS)를 그대로 적는다', () => {
        expect(KO).toContain(`${d7.startDay}~${d7.endDay}일`);
        expect(KO).toContain(`${d30.startDay}~${d30.endDay}일`);
    });

    it.each(NON_KO)(
        '%s 번역본도 같은 숫자 주장(7~13, 30~36, 20, 6)을 적는다',
        locale => {
            const body = readPolicy(`.${locale}`);
            const claims: Record<string, readonly RegExp[]> = {
                en: [/7 to 13 days/, /30 to 36 days/, /up to 20/, /six ranges/],
                ja: [/7~13日/, /30~36日/, /最大20件/, /6つの区間/],
                zh: [/7~13天/, /30~36天/, /最多20个/, /6个区间/],
            };
            for (const pattern of claims[locale] ?? []) {
                expect(body).toMatch(pattern);
            }
            expect(body).toMatch(
                new RegExp(`${d7.startDay}\\D{1,8}${d7.endDay}`)
            );
        }
    );

    it('한국어 원문의 숫자 주장(6개 구간)도 적혀 있다', () => {
        expect(KO).toContain('6개 구간');
    });

    it.each(LOCALES)(
        '%s 공유 표식 항목의 개수가 코드의 상한(SHARE_MARKS_MAX_CREATED)과 같다',
        locale => {
            const line =
                (POLICY_7[locale] ?? '')
                    .split('\n')
                    .find(l => l.includes('siglens:share-marks:v1')) ?? '';
            expect(line).not.toBe('');
            // 같은 줄의 "(최대 20개)"처럼 상한이 숫자로 적혀야 한다.
            expect(line).toContain(String(SHARE_MARKS_MAX_CREATED));
            expect(
                line.replace(String(SHARE_MARKS_MAX_CREATED), '')
            ).not.toMatch(/\b2[1-9]\b|\b1\d\b/);
        }
    );
});

describe(`브라우저 저장 키 ↔ 방침 v${VERSION} §7`, () => {
    const scan = scanStorageWrites(SOURCES);

    it('저장소에 쓰는 모든 호출의 첫 인자를 해석했다(못 읽은 호출은 실패)', () => {
        expect(scan.unparsed).toEqual([]);
    });

    it('쓰기 스캔이 알려진 키를 실제로 찾는다(스캔이 비어 통과하는 것을 막는다)', () => {
        for (const known of [
            'siglens:visit-history:v1',
            'siglens:visit:v2',
            'siglens:symbol-views',
            'siglens:share-marks:v1',
            'siglens-theme',
            'siglens:analysis-view',
            'siglens:pwa-banner-dismissed',
            'siglens:ai-interacted',
            'siglens:version-skew-reload-at',
            `${STORAGE_PREFIX}.`,
        ]) {
            expect(scan.keys, known).toContain(known);
        }
    });

    it('차트 영속 키는 모두 siglens.chart. 접두를 쓴다', () => {
        const values = Object.values(STORAGE_KEYS).flatMap(entry =>
            typeof entry === 'string' ? [entry] : [entry('bollinger')]
        );
        expect(values.filter(v => !v.startsWith(`${STORAGE_PREFIX}.`))).toEqual(
            []
        );
    });

    /**
     * 쓰기 스캔이 찾은 키는 §7(모든 로케일)에 이름이 있거나, 글로 덮이는 레지스트리 키여야 한다.
     * 글로 덮이는 키의 값은 이름 대신 문구(`COVERED_BY_SENTENCE`)로 §7에 있다.
     */
    const covered = new Set<string>(
        Object.keys(COVERED_BY_SENTENCE).map(
            name => storageKeys[name as keyof typeof storageKeys]
        )
    );
    const mustBeNamed = [...scan.keys].filter(key => !covered.has(key));

    it.each(LOCALES)(
        '%s §7이 스캔으로 찾은 모든 저장 키를 이름으로 적는다',
        locale => {
            expect(missing(POLICY_7[locale] ?? '', mustBeNamed)).toEqual([]);
        }
    );

    it('레지스트리의 모든 키는 §7에 이름이 있거나 글로 덮인다(키가 스캔에 안 잡혀도)', () => {
        expect(missing(KO_7, namedRegistryKeys())).toEqual([]);
    });

    it('글로 덮이는 키마다 그 문구가 한국어 §7에 글자 그대로 있다', () => {
        const phrases = Object.values(COVERED_BY_SENTENCE).filter(
            (phrase): phrase is string => phrase !== undefined
        );
        expect(missing(KO_7, phrases)).toEqual([]);
    });

    it('글로 덮이는 키 목록은 레지스트리에 실제로 있는 이름만 담는다', () => {
        const names = REGISTRY.map(([name]) => name);
        expect(
            Object.keys(COVERED_BY_SENTENCE).filter(n => !names.includes(n))
        ).toEqual([]);
    });

    it('더는 쓰지 않는 옛 전송 마커 키는 방침에 올리지 않는다(다음 전송에서 지운다)', () => {
        expect(KO_7).not.toMatch(/siglens:visit(?![:\-\w])/);
    });
});

describe(`쿠키 ↔ 방침 v${VERSION} §7`, () => {
    it('쿠키를 심는 파일은 알려진 목록과 같다(새 쿠키는 §7과 함께 추가한다)', () => {
        expect(cookieWriterFiles(SOURCES)).toEqual(
            [...EXPECTED_COOKIE_WRITERS].toSorted()
        );
    });

    it('상수로 정의된 쿠키 이름을 실제로 찾는다(스캔이 비어 통과하는 것을 막는다)', () => {
        expect(cookieNames(SOURCES)).toEqual(
            expect.arrayContaining([
                'siglens_session',
                'siglens_auth',
                'siglens_guest',
                'siglens_signup_conversion',
                'siglens_funnel_signup',
                'siglens_ai_sso_probed',
                'siglens_signed_in',
                'siglens_oauth_state',
                'siglens_ai_sso_state',
            ])
        );
    });

    it.each(LOCALES)(
        '%s §7이 앱이 심는 모든 쿠키를 이름으로 적는다',
        locale => {
            expect(
                missing(POLICY_7[locale] ?? '', [
                    ...cookieNames(SOURCES),
                    ...THIRD_PARTY_COOKIES,
                ])
            ).toEqual([]);
        }
    );

    it.each(LOCALES)(
        '%s §7의 siglens_signed_in 항목이 HttpOnly를 적는다',
        locale => {
            const line =
                (POLICY_7[locale] ?? '')
                    .split('\n')
                    .find(l => l.includes('**siglens_signed_in**')) ?? '';
            expect(line).not.toBe('');
            expect(line).toContain('HttpOnly');
        }
    );

    /**
     * `siglens_signed_in`의 약속(HttpOnly, 값 `1`)은 코드의 쿠키 서술자와 같아야 한다. 최대 수명은
     * `privacyRetention.test.ts` 레지스트리가 세션 쿠키 상수와 묶는다.
     */
    it('한국어 §7의 siglens_signed_in 항목이 HttpOnly와 값 `1`을 적는다', () => {
        const line =
            KO_7.split('\n').find(l => l.includes('**siglens_signed_in**')) ??
            '';
        expect(line).not.toBe('');
        expect(line).toContain('HttpOnly');
        expect(line).toContain('`1`');
    });
});

describe('진입 출처 분류 ↔ 방침 §2', () => {
    const CATEGORY: Record<EntrySource, string> = {
        chatgpt: 'AI 답변 서비스',
        perplexity: 'AI 답변 서비스',
        gemini: 'AI 답변 서비스',
        copilot: 'AI 답변 서비스',
        claude: 'AI 답변 서비스',
        deepseek: 'AI 답변 서비스',
        grok: 'AI 답변 서비스',
        google: '검색엔진',
        naver: '검색엔진',
        bing: '검색엔진',
        daum: '검색엔진',
        duckduckgo: '검색엔진',
        x: 'SNS',
        threads: 'SNS',
        facebook: 'SNS',
        instagram: 'SNS',
        youtube: 'SNS',
        'naver-blog': '블로그와 커뮤니티',
        reddit: '블로그와 커뮤니티',
        'naver-finance': '증권 포털',
        paid: '광고',
        email: '메일',
        share: '공유 링크',
        other: '기타 외부 사이트',
    };

    const sentence =
        KO.split('\n').find(line =>
            line.startsWith('- 접속 통계(방문자 수 집계): IP')
        ) ?? '';

    it('분류표의 키는 ENTRY_SOURCES와 정확히 같다', () => {
        expect(Object.keys(CATEGORY).toSorted()).toEqual(
            [...ENTRY_SOURCES].toSorted()
        );
    });

    it('방침 §2가 범주를 모두 적고, 저장되는 값이 서비스 단위 분류값임을 예와 함께 적는다', () => {
        expect(sentence).not.toBe('');
        expect(
            missing(sentence, [...new Set(Object.values(CATEGORY))])
        ).toEqual([]);
        expect(sentence).toContain('서비스 단위의 분류값');
        expect(missing(sentence, ['ChatGPT', 'Google', '네이버 증권'])).toEqual(
            []
        );
        // 사용자에게 내부 코드 이름을 예로 보이지 않는다.
        expect(sentence).not.toMatch(/chatgpt|naver-finance|\bpaid\b/);
    });
});

/**
 * 위 검사가 빈 껍데기가 아님을 메모리 사본에서 하나씩 깨 본다(TE-62). 검사 함수가 입력으로 받는 소스·
 * 방침 사본을 바꿔 실패(해석 불가, 누락)가 실제로 나오는지 본다.
 */
describe('가드의 반증(메모리 사본)', () => {
    const base = scanStorageWrites(SOURCES);

    it('새 저장 키를 쓰는 파일이 생기면 §7 누락으로 잡는다', () => {
        const scan = scanStorageWrites({
            ...SOURCES,
            'fake/newWriter.ts': `localStorage.setItem('siglens:brand-new', '1');`,
        });
        expect(scan.unparsed).toEqual([]);
        expect(missing(KO_7, [...scan.keys])).toContain('siglens:brand-new');
    });

    it('이미 목록에 있는 파일에 새 usePersistentState 키가 생겨도 잡는다', () => {
        const file = 'shared/model/analysisView.ts';
        const scan = scanStorageWrites({
            ...SOURCES,
            [file]: `${SOURCES[file] ?? ''}\nconst [x] = usePersistentState('siglens:another-new', 1);`,
        });
        expect(missing(KO_7, [...scan.keys])).toContain('siglens:another-new');
    });

    it('상수 이름으로 넘긴 새 키도 해석해 잡는다', () => {
        const scan = scanStorageWrites({
            ...SOURCES,
            'fake/a.ts': `const NEW_KEY = 'siglens:via-const';\nsessionStorage.setItem(NEW_KEY, '1');`,
        });
        expect(missing(KO_7, [...scan.keys])).toContain('siglens:via-const');
    });

    it('첫 인자를 해석하지 못하면 unparsed로 실패시킨다', () => {
        const scan = scanStorageWrites({
            ...SOURCES,
            'fake/b.ts': `localStorage.setItem(buildKey(), '1');`,
            'fake/c.ts': `localStorage.setItem(\`k-\${id}\`, '1');`,
            'fake/d.ts': `localStorage.setItem(someVar, '1');`,
        });
        expect(scan.unparsed.length).toBeGreaterThanOrEqual(3);
        expect(base.unparsed).toEqual([]);
    });

    it('§7에서 키 하나를 지우면 잡고, 다른 절에만 적힌 키는 인정하지 않는다', () => {
        const key = 'siglens:pwa-banner-dismissed';
        expect(missing(KO_7.replaceAll(key, '__x__'), [key])).toEqual([key]);
        const elsewhere = KO.replace(KO_7, KO_7.replaceAll(key, '__x__'));
        expect(section7(`${elsewhere}\n${key}`)).not.toContain(key);
    });

    it('글로 덮이는 문구를 지우면 잡는다', () => {
        const phrase = '오늘 분석한 종목 목록';
        expect(missing(KO_7.replace(phrase, '__x__'), [phrase])).toEqual([
            phrase,
        ]);
    });

    it('쿠키 쓰기 파일이 늘면 잡는다', () => {
        const files = cookieWriterFiles({
            ...SOURCES,
            'fake/cookieWriter.ts': `response.cookies.set('x', '1');`,
        });
        expect(files).toContain('fake/cookieWriter.ts');
        expect(files).not.toEqual([...EXPECTED_COOKIE_WRITERS].toSorted());
    });

    it('새 쿠키 이름 상수가 생기면 §7 누락으로 잡는다', () => {
        const names = cookieNames({
            ...SOURCES,
            'fake/e.ts': `export const NEW_COOKIE_NAME = 'siglens_brand_new';`,
        });
        expect(missing(KO_7, names)).toContain('siglens_brand_new');
    });

    it('범주 이름 하나를 지우면 잡는다', () => {
        expect(missing('증권 포털', ['증권 포털'])).toEqual([]);
        expect(missing('__x__', ['증권 포털'])).toEqual(['증권 포털']);
    });
});

/**
 * 피드백에 저장되는 맥락 필드 ↔ 방침 §2. 검증기(`parseAiFeedbackInput`)가 통과시키는 키가 곧 DB에
 * 저장되는 키다(여분 키는 버려진다). 검증기에 키가 늘면 이 목록이 깨져 방침을 함께 고치게 된다.
 */
describe('피드백 맥락 ↔ 방침 §2', () => {
    const FEEDBACK_SENTENCE = KO.split('\n')
        .filter(
            line =>
                line.startsWith('- 피드백 기능(') ||
                line.startsWith('- 피드백 맥락(')
        )
        .join('\n');

    /** 검증기가 저장하는 키 → 방침 문장에 있어야 하는 문구. */
    const ANALYSIS_CONTEXT_PHRASES: Record<string, string> = {
        analysisType: '분석 종류',
        symbol: '종목',
        timeframe: '시간 프레임',
        modelId: '사용한 AI 모델',
        reasoning: '추론 모드 사용 여부',
        analyzedAt: '분석 시각',
        generatedAt: '생성 시각',
        extra: '옵션 만기일, 분석 범위 또는 분류',
        viewMode: '쉽게 보기 또는 원문 보기',
    };
    const AGENT_CONTEXT_PHRASES: Record<string, string> = {
        messageIndex: '대화 안에서의 순서',
        guest: '비회원 여부',
        conversationId: '대화와 답변의 식별자',
        messageId: '대화와 답변의 식별자',
    };

    function storedContextKeys(
        surface: 'siglens' | 'siglens_ai',
        context: Record<string, unknown>
    ): string[] {
        const parsed = parseAiFeedbackInput({
            surface,
            vote: 'up',
            pagePath: '/x',
            context,
            snapshot: surface === 'siglens' ? { a: 1 } : [],
        });
        return Object.keys(parsed?.context ?? {}).toSorted();
    }

    const everyAnalysisKey = {
        analysisType: 'technical',
        symbol: 'AAPL',
        timeframe: '1Day',
        modelId: 'm',
        reasoning: true,
        analyzedAt: '2026-01-01T00:00:00Z',
        generatedAt: '2026-01-01T00:00:00Z',
        extra: { expirationDate: '2026-12-18', scope: 's', category: 'c' },
        viewMode: 'plain',
        injected: 'must-not-be-stored',
    };
    const everyAgentKey = {
        conversationId: '9f1d2c3b-4a5e-4f60-8a7b-0c1d2e3f4a5b',
        messageId: '9f1d2c3b-4a5e-4f60-8a7b-0c1d2e3f4a5c',
        messageIndex: 1,
        guest: false,
        injected: 'must-not-be-stored',
    };

    it('검증기가 저장하는 분석 맥락 키는 방침 문구 표와 같다(여분 키는 버려진다)', () => {
        expect(storedContextKeys('siglens', everyAnalysisKey)).toEqual(
            Object.keys(ANALYSIS_CONTEXT_PHRASES).toSorted()
        );
    });

    it('검증기가 저장하는 시그렌즈 AI 맥락 키는 방침 문구 표와 같다', () => {
        expect(storedContextKeys('siglens_ai', everyAgentKey)).toEqual(
            Object.keys(AGENT_CONTEXT_PHRASES).toSorted()
        );
    });

    it('한국어 §2 피드백 문장이 모든 맥락 필드의 문구를 적는다', () => {
        expect(FEEDBACK_SENTENCE).not.toBe('');
        expect(
            missing(FEEDBACK_SENTENCE, [
                ...Object.values(ANALYSIS_CONTEXT_PHRASES),
                ...Object.values(AGENT_CONTEXT_PHRASES),
            ])
        ).toEqual([]);
    });

    it.each(LOCALES)(
        '%s 피드백 원문 크기 상한이 코드의 SNAPSHOT_MAX_BYTES와 같다',
        locale => {
            const policy = locale === 'ko' ? KO : readPolicy(`.${locale}`);
            const kb = SNAPSHOT_MAX_BYTES / 1024;
            expect(policy).toMatch(new RegExp(`${kb} ?KB`));
        }
    );

    it('반증: 검증기에 키가 늘거나 문장에서 문구가 빠지면 잡는다', () => {
        const withNewKey = Object.keys({
            ...ANALYSIS_CONTEXT_PHRASES,
            brandNew: 'x',
        });
        expect(withNewKey.toSorted()).not.toEqual(
            storedContextKeys('siglens', everyAnalysisKey)
        );
        expect(
            missing(FEEDBACK_SENTENCE.replace('추론 모드 사용 여부', '__x__'), [
                '추론 모드 사용 여부',
            ])
        ).toEqual(['추론 모드 사용 여부']);
    });
});

describe('종목 조회수 집계 ↔ 방침 §2·§4', () => {
    it('§2가 저장 항목(종목 코드·날짜별 횟수)과 저장하지 않는 항목을 적는다', () => {
        const line =
            KO.split('\n').find(l => l.startsWith('- 종목 조회수 집계:')) ?? '';
        expect(line).not.toBe('');
        expect(
            missing(line, [
                '종목 코드',
                'IP 주소',
                'User-Agent',
                '회원 식별자',
                '브라우저 저장소를 쓸 수 있는 경우',
            ])
        ).toEqual([]);
    });

    it('§4에 종목 조회수 집계 항목이 있다(보존 기간은 privacyRetention 레지스트리가 묶는다)', () => {
        const line =
            KO.split('\n').find(l => l.startsWith('- 종목 조회수 집계(')) ?? '';
        expect(line).not.toBe('');
    });
});

/**
 * Cloudflare Web Analytics 스크립트 ↔ 방침. 측정 스크립트 주소가 코드에 있으면 방침이 이름으로 적고,
 * 없으면 적지 않는다. 불러오는 곳은 메인 사이트 로케일 레이아웃 하나뿐이다(ai 호스트·광고 랜딩 제외).
 */
describe(`Cloudflare 측정 스크립트 ↔ 방침 v${VERSION}`, () => {
    const BEACON_HOST = 'static.cloudflareinsights.com';
    const loaders = Object.entries(SOURCES)
        .filter(([, code]) => code.includes(BEACON_HOST))
        .map(([file]) => file);

    it('스크립트를 불러오는 파일은 메인 사이트 로케일 레이아웃 하나다', () => {
        expect(loaders).toEqual(['app/[locale]/layout.tsx']);
    });

    it.each(LOCALES)(
        '%s 방침이 코드와 같이 측정 스크립트를 적는다(코드에 있으면 있고, 없으면 없다)',
        locale => {
            const policy = locale === 'ko' ? KO : readPolicy(`.${locale}`);
            expect(policy.includes('Cloudflare Web Analytics')).toBe(
                loaders.length > 0
            );
        }
    );

    it('한국어 §2가 불러오지 않는 곳(ai.siglens.io, 광고 랜딩 페이지)을 적는다', () => {
        const line =
            KO.split('\n').find(l =>
                l.startsWith('- 트래픽과 페이지 성능 측정')
            ) ?? '';
        expect(
            missing(line, ['siglens.io', 'ai.siglens.io', '광고 랜딩 페이지'])
        ).toEqual([]);
        expect(line).not.toMatch(/쿠키/);
    });

    it('반증: 코드에서 주소가 사라지면 방침의 이름과 어긋나 잡힌다', () => {
        const withoutLoader = Object.values({
            ...SOURCES,
            'app/[locale]/layout.tsx': '',
        }).filter(code => code.includes(BEACON_HOST));
        expect(KO.includes('Cloudflare Web Analytics')).not.toBe(
            withoutLoader.length > 0
        );
    });
});
