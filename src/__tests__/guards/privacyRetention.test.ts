vi.mock('server-only', () => ({}));

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    UNIT_SECONDS,
    bulletsOf,
    extractTokens,
    findIssues,
    type Entry,
    type Place,
    type Policies,
    type Unbacked,
} from '@/__tests__/guards/support/privacyRetention';
import { DELIVERY_RETENTION_MS } from '@/app/api/cron/email-report/runEmailReportBatch';
import {
    PROMPT_DYNAMIC_RETENTION_DAYS,
    RESULT_RETENTION_DAYS,
} from '@/entities/analysis/analysisHistoryRepository';
import {
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
    EMAIL_VERIFICATION_RATE_LIMITS,
    EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS,
    LOGIN_RATE_LIMITS,
    PASSWORD_RESET_RATE_LIMITS,
} from '@/entities/auth/lib/authUseCaseConstants';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/entities/auth/lib/sessionCookie';
import { HANDOFF_STATE_TTL_SECONDS } from '@/entities/auth/server/handoffStore';
import { FEEDBACK_RETENTION_DAYS } from '@/entities/feedback/lib/constants';
import { FEEDBACK_RATE_WINDOW_SECONDS } from '@/entities/feedback/server/rateLimit';
import {
    MAIL_ALERT_COOKIE_MAX_AGE_SECONDS,
    MAIL_ALERT_DELIVERY_RETENTION_DAYS,
    MAIL_ALERT_RATE_LIMITS,
} from '@/entities/mail-alert/lib/mailAlertConstants';
import {
    PRICE_ALERT_FIRED_RETENTION_DAYS,
    PRICE_ALERT_RATE_LIMIT,
} from '@/entities/mail-alert/lib/priceAlertConstants';
import { windowId } from '@/entities/siglens-api-key/lib/rateLimitWindow';
import { OAUTH_STATE_TTL_SECONDS } from '@/features/auth-oauth/lib/state';
import { WEB_SEARCH_RETENTION_DAYS } from '@/shared/api/web/webSearchResult';
import { AI_SSO_PROBED_MAX_AGE_SECONDS } from '@/shared/config/cookieNames';
import { SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS } from '@/shared/config/googleAds';
import { GUEST_ID_MAX_AGE_SECONDS } from '@/shared/config/guestCookie';
import {
    API_KEY_AUTH_CACHE_TTL_SECONDS,
    API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS,
} from '@/shared/config/publicApi';
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/shared/config/time';
import { LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * 개인정보처리방침이 적은 보관 기간·TTL·창(CONVENTIONS.md#CS-14)을 한 곳에서 코드 상수와 묶는다.
 *
 * - **정방향**: 레지스트리의 항목마다 코드 상수가 만든 값이 **가장 높은 버전**(`db/seeds/terms/privacy/vN*.md`,
 *   4개 로케일)의 지정한 줄에 단위와 함께 적혀 있어야 한다. 줄은 한국어 원문의 표지 문구(`marker`)로 찾고,
 *   번역본은 같은 절의 같은 순서 불릿을 쓴다(절마다 불릿 수가 로케일 간 같아야 한다).
 * - **역방향**: §4(보유 및 이용 기간)의 모든 불릿에서 "숫자+시간 단위"(초·분·시간·일·개월·년)를 뽑아, 레지스트리가
 *   그 줄에서 덮거나 {@link UNBACKED_NUMBERS}에 사유와 함께 올라 있지 않으면 실패한다. §4에 새 기간을 적고
 *   상수를 안 묶으면 잡힌다. 범위는 §4뿐이다(§2·§6·§7의 숫자는 정방향 항목으로만 묶인다). 횟수 상한(5회 등)과
 *   단위가 붙지 않은 시각("다음 날 0시")은 대상이 아니다. 일본어 "1日の…"(하루의)는 기간이 아니라 제외한다.
 *
 * 같은 줄에 같은 숫자가 여러 번 나오면(30분·30분) 어느 상수가 어느 쪽인지는 구분하지 못한다. 다만 한 상수를
 * 바꾸면 그 숫자가 줄에서 사라지는 경우를 잡는다. 기능 고유의 비-기간 문구는 `*Privacy.test.ts`에 둔다.
 */
const PRIVACY_DIR = path.resolve(process.cwd(), 'db/seeds/terms/privacy');
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

const readPolicy = (locale: Locale): string =>
    readFileSync(
        path.join(
            PRIVACY_DIR,
            locale === 'ko' ? `v${VERSION}.md` : `v${VERSION}.${locale}.md`
        ),
        'utf8'
    );

const POLICIES: Policies = {
    ko: readPolicy('ko'),
    en: readPolicy('en'),
    ja: readPolicy('ja'),
    zh: readPolicy('zh'),
};

/** 상수가 모듈 밖으로 나올 수 없는 파일(Next route segment 파일은 정해진 이름만 export한다)에서 `const NAME = <정수>;`를 읽는다. 못 읽으면 즉시 실패. */
function scanConstant(file: string, name: string): number {
    const source = readFileSync(path.resolve(process.cwd(), file), 'utf8');
    const match = new RegExp(`\\bconst ${name}\\s*=\\s*(\\d+)\\s*;`).exec(
        source
    );
    if (match?.[1] === undefined) {
        throw new Error(
            `${file}에서 'const ${name} = <정수>;'를 찾지 못했다. 상수 정의가 바뀌었다면 이 레지스트리의 읽는 방법을 고친다.`
        );
    }
    return Number(match[1]);
}

const longestWindowSeconds = (
    ...tables: readonly Record<string, { readonly windowSeconds: number }>[]
): number =>
    Math.max(
        ...tables.flatMap(table =>
            Object.values(table).map(rule => rule.windowSeconds)
        )
    );

const MINUTE_COUNTER_TTL_SECONDS = windowId('minute', new Date(0)).ttlSeconds;
const DAY_COUNTER_TTL_SECONDS = windowId('day', new Date(0)).ttlSeconds;
const PRESENCE_RETENTION_DAYS = scanConstant(
    'src/app/api/presence/route.ts',
    'RETENTION_DAYS'
);
const FUNNEL_RETENTION_DAYS = scanConstant(
    'src/app/api/presence/funnel/route.ts',
    'RETENTION_DAYS'
);
const SYMBOL_VIEW_RETENTION_DAYS = scanConstant(
    'src/app/api/presence/symbol/route.ts',
    'RETENTION_DAYS'
);

const UPSTASH = '- **Upstash';
const RESET_PURPOSE: Record<Locale, string> = {
    ko: '로그인과 비밀번호 재설정 요청 횟수 제한',
    en: 'login and password reset request rate limiting',
    ja: 'ログインとパスワード再設定リクエストの回数制限',
    zh: '登录及密码重设请求次数限制',
};

/** §6 Upstash 줄에서 각 흐름의 문장이 시작하는 문구(이 흐름의 숫자만 보게 자르는 데 쓴다). */
const API_LEAD: Record<Locale, string> = {
    ko: '시그렌즈 API를 이용하는 경우에는',
    en: 'When the SIGLENS API is used',
    ja: 'SIGLENS APIを利用する場合は',
    zh: '使用SIGLENS API时',
};
const FEEDBACK_LEAD: Record<Locale, string> = {
    ko: '피드백과 문의의 제출 횟수 제한에는',
    en: 'For feedback and inquiry submission rate limiting',
    ja: 'フィードバックおよび問い合わせの送信回数制限には',
    zh: '反馈及咨询的提交次数限制仅使用',
};
const ALERT_LEAD: Record<Locale, string> = {
    ko: '알림 메일 신청에는',
    en: 'For alert email sign-up',
    ja: 'アラートメールの申し込みには',
    zh: '提醒邮件订阅会使用',
};
const PRICE_ALERT_LEAD: Record<Locale, string> = {
    ko: '가격대 알림을 만들 때는',
    en: 'When a price alert is created',
    ja: '価格アラートを作成する際は',
    zh: '创建价格提醒时',
};
const SIGNUP_LEAD: Record<Locale, string> = {
    ko: '회원가입 이메일 인증에는',
    en: 'For member sign-up email verification',
    ja: '会員登録のメール認証には',
    zh: '会员注册邮箱验证会',
};

const API_UPSTASH: Place = {
    section: 6,
    marker: UPSTASH,
    scopeAfter: API_LEAD,
    scopeUntil: FEEDBACK_LEAD,
};
const SIGNUP_UPSTASH: Place = {
    section: 6,
    marker: UPSTASH,
    scopeAfter: SIGNUP_LEAD,
    scopeUntil: RESET_PURPOSE,
};
const API_TEMP_RECORD = '- 시그렌즈 API 요청 처리용 임시 기록';

const SIGNUP_VERIFY_LINE = '- 회원가입을 위해 이메일 인증을 요청한 경우';
const LOGIN_LIMIT_LINE = '- 로그인과 비밀번호 재설정 요청 횟수를 제한하려고';
const MAIL_ALERT_LINE = '- 알림 메일을 신청한 경우(회원과 비회원 모두)';

const SESSION_PLACES: readonly Place[] = [
    { section: 4, marker: '- 인증 세션' },
    { section: 7, marker: '- **siglens_session**' },
    { section: 7, marker: '- **siglens_auth**' },
    { section: 7, marker: '- **siglens_signed_in**' },
];

const LONGEST_VERIFICATION_WINDOW = longestWindowSeconds(
    EMAIL_VERIFICATION_RATE_LIMITS
);
const LONGEST_AUTH_ATTEMPT_WINDOW = longestWindowSeconds(
    LOGIN_RATE_LIMITS,
    PASSWORD_RESET_RATE_LIMITS
);

const ENTRIES: readonly Entry[] = [
    {
        id: '접속 통계 보관(presence route RETENTION_DAYS)',
        seconds: PRESENCE_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'day',
        places: [{ section: 4, marker: '- 접속 통계(' }],
    },
    {
        id: '서비스 이용 행태 보관(presence/funnel route RETENTION_DAYS)',
        seconds: FUNNEL_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'day',
        places: [{ section: 4, marker: '- 서비스 이용 행태' }],
    },
    {
        id: '종목 조회수 집계 보관(presence/symbol route RETENTION_DAYS)',
        seconds: SYMBOL_VIEW_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'day',
        places: [{ section: 4, marker: '- 종목 조회수 집계(' }],
    },
    {
        id: '피드백 보관(FEEDBACK_RETENTION_DAYS)',
        seconds: FEEDBACK_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'year',
        places: [{ section: 4, marker: '- 피드백(별점' }],
    },
    {
        id: '피드백·문의 제출 제한 IP 해시(FEEDBACK_RATE_WINDOW_SECONDS)',
        seconds: FEEDBACK_RATE_WINDOW_SECONDS,
        unit: 'hour',
        places: [
            { section: 4, marker: '- 피드백과 문의의 제출 횟수 제한용' },
            { section: 2, marker: '- 피드백과 문의의 제출 횟수 제한:' },
            {
                section: 6,
                marker: UPSTASH,
                scopeAfter: FEEDBACK_LEAD,
                scopeUntil: ALERT_LEAD,
            },
        ],
    },
    {
        id: '비회원 식별 쿠키 수명(GUEST_ID_MAX_AGE_SECONDS)',
        seconds: GUEST_ID_MAX_AGE_SECONDS,
        unit: 'year',
        places: [
            { section: 4, marker: '- 비회원 식별 쿠키(' },
            { section: 7, marker: '- **siglens_guest**' },
        ],
    },
    {
        id: '가입 전환 쿠키 수명(SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS)',
        seconds: SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS,
        unit: 'minute',
        places: [
            { section: 4, marker: 'siglens_signup_conversion' },
            { section: 7, marker: '- **siglens_signup_conversion**' },
            { section: 4, marker: 'siglens_funnel_signup' },
            { section: 7, marker: '- **siglens_funnel_signup**' },
        ],
    },
    {
        id: '가입 인증 확인 쿠키 수명(EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS)',
        seconds: EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS,
        unit: 'minute',
        places: [
            { section: 4, marker: 'siglens_signup_verify' },
            { section: 7, marker: '- **siglens_signup_verify**' },
            { section: 2, marker: SIGNUP_VERIFY_LINE },
            { section: 4, marker: '- 회원가입 이메일 인증 정보' },
        ],
    },
    {
        id: '가입 이메일 인증 코드 보관(EMAIL_VERIFICATION_PENDING_TTL_SECONDS)',
        seconds: EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
        unit: 'minute',
        places: [
            { section: 2, marker: SIGNUP_VERIFY_LINE },
            { section: 4, marker: '- 회원가입 이메일 인증 정보' },
            SIGNUP_UPSTASH,
            { section: 2, marker: MAIL_ALERT_LINE },
            {
                section: 6,
                marker: UPSTASH,
                scopeAfter: ALERT_LEAD,
                scopeUntil: PRICE_ALERT_LEAD,
            },
        ],
    },
    {
        id: '가입 이메일 인증 횟수 제한 기록의 가장 긴 창(EMAIL_VERIFICATION_RATE_LIMITS)',
        seconds: LONGEST_VERIFICATION_WINDOW,
        unit: 'hour',
        places: [
            { section: 2, marker: SIGNUP_VERIFY_LINE },
            { section: 4, marker: '- 회원가입 이메일 인증 정보' },
            SIGNUP_UPSTASH,
        ],
    },
    {
        id: '로그인·재설정 횟수 제한 기록의 가장 긴 창(LOGIN/PASSWORD_RESET_RATE_LIMITS)',
        seconds: LONGEST_AUTH_ATTEMPT_WINDOW,
        unit: 'hour',
        places: [
            { section: 2, marker: LOGIN_LIMIT_LINE },
            { section: 4, marker: '- 로그인과 비밀번호 재설정 횟수 제한 기록' },
            { section: 6, marker: UPSTASH, scopeAfter: RESET_PURPOSE },
        ],
    },
    {
        id: '알림 메일 횟수 제한 기록의 가장 긴 창(MAIL_ALERT_RATE_LIMITS)',
        seconds: longestWindowSeconds(MAIL_ALERT_RATE_LIMITS),
        unit: 'hour',
        places: [
            { section: 2, marker: MAIL_ALERT_LINE },
            {
                section: 6,
                marker: UPSTASH,
                scopeAfter: ALERT_LEAD,
                scopeUntil: PRICE_ALERT_LEAD,
            },
        ],
    },
    {
        id: '가격대 알림 만들기 횟수 제한 기록(PRICE_ALERT_RATE_LIMIT)',
        seconds: PRICE_ALERT_RATE_LIMIT.createPerIp.windowSeconds,
        unit: 'hour',
        places: [
            { section: 2, marker: MAIL_ALERT_LINE },
            {
                section: 6,
                marker: UPSTASH,
                scopeAfter: PRICE_ALERT_LEAD,
                scopeUntil: SIGNUP_LEAD,
            },
        ],
    },
    {
        id: '알린 가격대 알림 보관(PRICE_ALERT_FIRED_RETENTION_DAYS)',
        seconds: PRICE_ALERT_FIRED_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'day',
        places: [{ section: 4, marker: '- 가격대 알림:' }],
    },
    {
        id: '보유 구간이 반영된 분석 결과 보관(RESULT_RETENTION_DAYS)',
        seconds: RESULT_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'day',
        places: [{ section: 4, marker: '- 보유 구간이 반영된 AI 분석' }],
    },
    {
        id: '보유 구간이 적힌 분석 요청 내용 보관(PROMPT_DYNAMIC_RETENTION_DAYS)',
        seconds: PROMPT_DYNAMIC_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'day',
        places: [{ section: 4, marker: '- 보유 구간이 반영된 AI 분석' }],
    },
    {
        id: '알림 메일 쿠키 수명(MAIL_ALERT_COOKIE_MAX_AGE_SECONDS)',
        seconds: MAIL_ALERT_COOKIE_MAX_AGE_SECONDS,
        unit: 'day',
        places: [{ section: 7, marker: '- **siglens_mail_alert**' }],
    },
    {
        id: '알림 메일 발송 기록 보관(MAIL_ALERT_DELIVERY_RETENTION_DAYS)',
        seconds: MAIL_ALERT_DELIVERY_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'day',
        places: [{ section: 4, marker: '- 알림 메일 발송 기록' }],
    },
    {
        id: '대화에 저장된 웹 검색 결과 본문 보관(WEB_SEARCH_RETENTION_DAYS)',
        seconds: WEB_SEARCH_RETENTION_DAYS * SECONDS_PER_DAY,
        unit: 'day',
        places: [{ section: 4, marker: '- 시그렌즈 AI 대화 내역' }],
    },
    {
        id: '메일 리포트·가입 첫 리포트 발송 기록 보관(DELIVERY_RETENTION_MS)',
        seconds: DELIVERY_RETENTION_MS / MS_PER_SECOND,
        unit: 'day',
        // 첫 리포트 기록도 같은 상수로 지운다(`runEmailReportBatch`의 `welcomes.pruneOlderThan(cutoff)`).
        places: [
            { section: 4, marker: '- 메일 리포트 발송 기록' },
            { section: 4, marker: '- 가입 후 첫 리포트 발송 기록' },
        ],
    },
    {
        id: '인증 세션·로그인 힌트 쿠키 수명(DEFAULT_SESSION_TTL_SECONDS)',
        seconds: DEFAULT_SESSION_TTL_SECONDS,
        unit: 'day',
        places: SESSION_PLACES,
    },
    {
        id: '소셜 로그인 상태 쿠키 수명(OAUTH_STATE_TTL_SECONDS)',
        seconds: OAUTH_STATE_TTL_SECONDS,
        unit: 'minute',
        places: [{ section: 7, marker: '- **siglens_oauth_state**' }],
    },
    {
        id: 'AI SSO 넘기기 쿠키 수명(HANDOFF_STATE_TTL_SECONDS)',
        seconds: HANDOFF_STATE_TTL_SECONDS,
        unit: 'minute',
        places: [{ section: 7, marker: '- **siglens_ai_sso_state**' }],
    },
    {
        id: 'AI SSO 확인 쿠키 수명(AI_SSO_PROBED_MAX_AGE_SECONDS)',
        seconds: AI_SSO_PROBED_MAX_AGE_SECONDS,
        unit: 'minute',
        places: [{ section: 7, marker: '- **siglens_ai_sso_probed**' }],
    },
    {
        id: 'API 인증 결과 임시 기록(API_KEY_AUTH_CACHE_TTL_SECONDS)',
        seconds: API_KEY_AUTH_CACHE_TTL_SECONDS,
        unit: 'second',
        places: [
            { section: 4, marker: '- 시그렌즈 API 인증 결과 임시 기록' },
            API_UPSTASH,
            { section: 2, marker: API_TEMP_RECORD },
        ],
    },
    {
        id: 'API 폐기 표시(API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS)',
        seconds: API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS,
        unit: 'second',
        places: [
            { section: 4, marker: '- 시그렌즈 API 인증 결과 임시 기록' },
            API_UPSTASH,
            { section: 2, marker: API_TEMP_RECORD },
        ],
    },
    {
        id: 'API 분 단위 카운터 TTL(rateLimitWindow minute)',
        seconds: MINUTE_COUNTER_TTL_SECONDS,
        unit: 'minute',
        places: [
            { section: 4, marker: '- 시그렌즈 API 인증 결과 임시 기록' },
            API_UPSTASH,
        ],
    },
    {
        id: 'API 일 단위 카운터 TTL(rateLimitWindow day)',
        seconds: DAY_COUNTER_TTL_SECONDS,
        unit: 'hour',
        places: [
            { section: 4, marker: '- 시그렌즈 API 인증 결과 임시 기록' },
            API_UPSTASH,
        ],
    },
];

/**
 * §4에 숫자가 있지만 이 저장소의 코드 상수가 없는 항목. 방침 글을 고치지 않고 사유와 함께 명시한다. 항목마다
 * 한국어 줄에 그 숫자가 실제로 있어야 하고(낡은 허용 방지), 레지스트리가 같은 숫자를 덮으면 중복으로 실패한다.
 */
const UNBACKED_NUMBERS: readonly Unbacked[] = [
    {
        section: 4,
        marker: '- 접속 로그',
        value: 3,
        unit: 'month',
        reason: '인프라(로드밸런서·CDN 접근 로그)의 보관 설정이라 앱 코드에 상수가 없다. 운영 설정을 바꾸면 방침을 함께 고친다.',
    },
    {
        section: 4,
        marker: '- 오류 제보 관련',
        value: 1,
        unit: 'year',
        reason: '운영자가 처리 완료 후 수동으로 지우는 문의 메일이라 자동 삭제 코드와 상수가 없다.',
    },
    {
        section: 4,
        marker: '- 비회원 식별 쿠키(',
        value: 1,
        unit: 'day',
        reason: "비회원 AI 횟수 카운터(agent:q:turns·guest-ip, analysis:q:guest-*)의 TTL은 @y0ngha/siglens-core의 카운터 저장소가 period로 정한다. 이 저장소가 고르는 값은 period: 'day'이며 아래 소스 스캔 테스트가 묶는다.",
    },
    {
        section: 4,
        marker: '- Google 광고 전환 쿠키',
        value: 90,
        unit: 'day',
        reason: 'Google 태그가 직접 설정하는 쿠키의 만료라 우리 코드의 상수가 아니다.',
    },
];

describe(`개인정보처리방침 v${VERSION} 보관 기간 ↔ 코드 상수`, () => {
    it('정방향·역방향 위반이 없다', () => {
        expect(findIssues(POLICIES, ENTRIES, UNBACKED_NUMBERS)).toEqual([]);
    });

    it('레지스트리의 코드 값은 모두 양수다(상수를 못 읽어 0으로 통과하는 것을 막는다)', () => {
        for (const entry of ENTRIES) {
            expect(entry.seconds, entry.id).toBeGreaterThan(0);
        }
    });

    it('비회원 AI 카운터는 period: day다(방침 "최대 1일"을 허용 목록에서 묶는다)', () => {
        const read = (file: string): string =>
            readFileSync(path.resolve(process.cwd(), file), 'utf8');
        const counters = read('src/app/api/ai/chat/counters.ts');
        const quota = read(
            'src/entities/analysis/server/analysisGenerationQuota.ts'
        );

        expect(counters).toMatch(/prefix: 'agent:q:guest-ip',\s*period: 'day'/);
        expect(counters).toMatch(
            /const day = \(prefix: string\) =>\s*createCounterStore\(\{ prefix, period: 'day'/
        );
        expect(counters).toMatch(/turns: day\('agent:q:turns'\)/);
        expect(quota).toMatch(
            /const closed = \(prefix: string\): CounterStore =>\s*createCounterStore\(\{ prefix, period: 'day'/
        );
        for (const prefix of [
            'analysis:q:guest-h',
            'analysis:q:guest-d',
            'analysis:q:guest-ip-h',
            'analysis:q:guest-ip',
        ]) {
            expect(quota).toContain(`closed('${prefix}')`);
        }
    });

    it('허용 목록은 항목마다 사유가 있고 4건이다(늘리려면 이유를 적는다)', () => {
        expect(UNBACKED_NUMBERS).toHaveLength(4);
        for (const item of UNBACKED_NUMBERS) {
            expect(item.reason.length).toBeGreaterThan(10);
        }
    });
});

/** 변형이 실제로 본문을 바꿨는지 확인하고(공회전 방지) 사본을 돌려준다. */
function tamper(base: string, from: string, to: string): string {
    const tampered = base.replace(from, to);
    expect(tampered).not.toBe(base);
    return tampered;
}

const minutesOf = (seconds: number): number => seconds / UNIT_SECONDS.minute;
const hoursOf = (seconds: number): number => seconds / UNIT_SECONDS.hour;
const ko4Line = (marker: string): string => {
    const line = bulletsOf(POLICIES.ko, 4).find(l => l.includes(marker));
    if (line === undefined) throw new Error(`§4에 "${marker}" 줄이 없다`);
    return line;
};

/** 코드 값을 다른 숫자와 겹치지 않을 만큼 크게 어긋나게 해, 정방향이 그 숫자를 못 찾아야 한다. */
const DRIFT_UNITS = 997;

describe('탐지기 반증(공회전 방지)', () => {
    it.each(ENTRIES.map(entry => [entry.id, entry] as const))(
        '%s: 상수가 바뀌면 그 항목의 모든 로케일 줄이 실패한다',
        (_id, target) => {
            const mutated = ENTRIES.map(entry =>
                entry === target
                    ? {
                          ...entry,
                          seconds:
                              entry.seconds +
                              DRIFT_UNITS * UNIT_SECONDS[entry.unit],
                      }
                    : entry
            );
            const issues = findIssues(POLICIES, mutated, UNBACKED_NUMBERS);

            const missedLocales = LOCALES.filter(
                locale =>
                    !issues.some(i => i.startsWith(`${target.id}: ${locale} `))
            );

            expect(missedLocales).toEqual([]);
        }
    );

    it('레지스트리의 모든 항목이 반증 대상이다(항목 id가 겹치면 한쪽이 가려진다)', () => {
        expect(new Set(ENTRIES.map(entry => entry.id)).size).toBe(
            ENTRIES.length
        );
    });

    it('상수 하나가 바뀌면 역방향도 같은 줄의 옛 숫자를 미등록으로 알린다', () => {
        const mutated = ENTRIES.map(entry =>
            entry.id.startsWith('알림 메일 발송 기록 보관')
                ? { ...entry, seconds: entry.seconds + SECONDS_PER_DAY }
                : entry
        );
        const issues = findIssues(POLICIES, mutated, UNBACKED_NUMBERS);

        expect(issues.some(i => i.includes('미등록 보관 숫자'))).toBe(true);
    });

    it('방침의 숫자를 바꾼 사본은 정방향에서 잡힌다', () => {
        const tampered = {
            ...POLICIES,
            ko: tamper(
                POLICIES.ko,
                `최대 ${PRESENCE_RETENTION_DAYS}일`,
                `최대 ${PRESENCE_RETENTION_DAYS + 1}일`
            ),
        };

        expect(
            findIssues(tampered, ENTRIES, UNBACKED_NUMBERS).length
        ).toBeGreaterThan(0);
    });

    it('§4에 새 기간을 적고 상수를 묶지 않으면 역방향에서 잡힌다', () => {
        const line = ko4Line('- 종목 조회수 집계(');
        const tampered = {
            ...POLICIES,
            ko: tamper(POLICIES.ko, line, `${line}, 백업 7일`),
        };
        const issues = findIssues(tampered, ENTRIES, UNBACKED_NUMBERS);

        expect(issues.some(i => i.includes('미등록 보관 숫자'))).toBe(true);
        expect(issues.some(i => i.includes('7 day'))).toBe(true);
    });

    it('허용 목록을 비우면 방침의 코드 없는 숫자가 모두 드러난다', () => {
        const issues = findIssues(POLICIES, ENTRIES, []);

        for (const item of UNBACKED_NUMBERS) {
            expect(
                issues.some(i => i.includes(`"${item.value} ${item.unit}"`)),
                `${item.marker} ${item.value} ${item.unit}`
            ).toBe(true);
        }
    });

    it('레지스트리가 덮는 숫자를 허용 목록에 또 올리면 중복으로 실패한다', () => {
        const issues = findIssues(POLICIES, ENTRIES, [
            ...UNBACKED_NUMBERS,
            {
                section: 4,
                marker: '- 종목 조회수 집계(',
                value: SYMBOL_VIEW_RETENTION_DAYS,
                unit: 'day',
                reason: '중복으로 올린 항목(반증용)이다.',
            },
        ]);

        expect(issues.some(i => i.includes('이미 덮는다'))).toBe(true);
    });

    it('한국어에 없는 표지 문구는 실패한다', () => {
        const issues = findIssues(
            POLICIES,
            [
                {
                    id: 'ghost',
                    seconds: 60,
                    unit: 'minute',
                    places: [{ section: 4, marker: '- 없는 항목' }],
                },
            ],
            UNBACKED_NUMBERS
        );

        expect(issues.some(i => i.startsWith('ghost'))).toBe(true);
    });

    it('§6 가입 인증 문장의 숫자만 바꾸면 알림 메일·로그인 문장의 같은 숫자로 통과하지 못한다', () => {
        const pendingMinutes = minutesOf(
            EMAIL_VERIFICATION_PENDING_TTL_SECONDS
        );
        const windowHours = hoursOf(LONGEST_VERIFICATION_WINDOW);
        const code = tamper(
            POLICIES.ko,
            `포함)가 ${pendingMinutes}분 동안, 인증 메일 요청`,
            `포함)가 ${pendingMinutes + 1}분 동안, 인증 메일 요청`
        );
        const window = tamper(
            POLICIES.ko,
            `해시가 최대 ${windowHours}시간 동안 보관된 뒤 자동 삭제됩니다. 로그인과`,
            `해시가 최대 ${windowHours + 1}시간 동안 보관된 뒤 자동 삭제됩니다. 로그인과`
        );

        for (const ko of [code, window]) {
            expect(
                findIssues(
                    { ...POLICIES, ko },
                    ENTRIES,
                    UNBACKED_NUMBERS
                ).filter(i => i.includes('ko §6')).length
            ).toBeGreaterThan(0);
        }
    });

    it('scopeUntil 문구가 방침에서 사라지면(문장을 고치면) 실패한다', () => {
        const tampered = {
            ...POLICIES,
            en: tamper(
                POLICIES.en,
                'For login and password reset request rate limiting',
                'For login and reset rate limiting'
            ),
        };
        const issues = findIssues(tampered, ENTRIES, UNBACKED_NUMBERS);

        expect(issues.some(i => i.includes('scopeUntil 문구'))).toBe(true);
    });

    it('단위 추출: 4개 로케일과 제외 규칙', () => {
        expect(
            extractTokens('ko', '최대 24시간, 2분, 3개월, 1년, 60초')
        ).toEqual(
            expect.arrayContaining([
                { value: 24, unit: 'hour' },
                { value: 2, unit: 'minute' },
                { value: 3, unit: 'month' },
                { value: 1, unit: 'year' },
                { value: 60, unit: 'second' },
            ])
        );
        expect(
            extractTokens('en', 'up to 24 hours, 1 year, 00:00 KST')
        ).toEqual([
            { value: 24, unit: 'hour' },
            { value: 1, unit: 'year' },
        ]);
        expect(extractTokens('ja', '最大30分間、3か月、1日の無料公開')).toEqual(
            [
                { value: 30, unit: 'minute' },
                { value: 3, unit: 'month' },
            ]
        );
        expect(extractTokens('zh', '最长30分钟、3个月、25小时、90天')).toEqual(
            expect.arrayContaining([
                { value: 30, unit: 'minute' },
                { value: 3, unit: 'month' },
                { value: 25, unit: 'hour' },
                { value: 90, unit: 'day' },
            ])
        );
    });

    it('ja 제외 규칙: §4의 "1日の無料フル公開案内"는 기간이 아니고 같은 줄의 보관 일수만 센다', () => {
        const line = bulletsOf(POLICIES.ja, 4).find(l => l.includes('1日の'));

        expect(line).toBeDefined();
        expect(extractTokens('ja', line ?? '')).toEqual([
            { value: FUNNEL_RETENTION_DAYS, unit: 'day' },
        ]);
    });

    it('ja 제외 규칙: §4의 실제 "最大1日"(서버 카운터)는 기간으로 센다', () => {
        const line = bulletsOf(POLICIES.ja, 4).find(l => l.includes('最大1日'));

        expect(line).toBeDefined();
        expect(extractTokens('ja', line ?? '')).toContainEqual({
            value: 1,
            unit: 'day',
        });
    });

    it('en 단어 경계: §4의 실제 "up to 1 day on the server"는 세고 단위가 이어진 단어(daylong)는 세지 않는다', () => {
        const line = bulletsOf(POLICIES.en, 4).find(l =>
            l.includes('up to 1 day on the server')
        );
        const joined = (line ?? '').replace('1 day on', '1 daylong on');

        expect(line).toBeDefined();
        expect(joined).not.toBe(line);
        expect(extractTokens('en', line ?? '')).toContainEqual({
            value: 1,
            unit: 'day',
        });
        expect(extractTokens('en', joined)).not.toContainEqual({
            value: 1,
            unit: 'day',
        });
    });
});
