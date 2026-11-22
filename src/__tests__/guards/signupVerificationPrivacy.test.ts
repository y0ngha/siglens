import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
    EMAIL_VERIFICATION_RATE_LIMITS,
    EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS,
} from '@/entities/auth/lib/authUseCaseConstants';
import { SIGNUP_VERIFICATION_COOKIE_NAME } from '@/shared/config/cookieNames';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/shared/config/time';
import { LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * 회원가입 이메일 인증(`email_verification`)이 개인정보처리방침(§2 수집, §4 보유, §6 위탁 Upstash)이 적은
 * 보관 시간과 코드가 같은지 본다. 인증 코드·인증 완료 표시 30분과 횟수 제한 기록의 가장 긴 창(24시간)이
 * 바뀌면 이 테스트가 깨져 방침을 함께 고치게 된다. **가장 높은 버전**의 원문을 읽는다.
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

/** `## from.`부터 `## to.` 앞까지. 없으면 빈 문자열. */
function sectionBetween(policy: string, from: number, to: number): string {
    const start = policy.search(new RegExp(`^## ${from}\\.`, 'm'));
    const end = policy.search(new RegExp(`^## ${to}\\.`, 'm'));
    return start === -1 || end === -1 ? '' : policy.slice(start, end);
}

/** `line`이 `opening`으로 시작하는 불릿 한 줄. 없으면 빈 문자열. */
function lineStartingWith(section: string, opening: string): string {
    return section.split('\n').find(line => line.startsWith(opening)) ?? '';
}

const PENDING_MINUTES =
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS / SECONDS_PER_MINUTE;
const VERIFIED_MINUTES =
    EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS / SECONDS_PER_MINUTE;
const LONGEST_WINDOW_HOURS =
    Math.max(
        ...Object.values(EMAIL_VERIFICATION_RATE_LIMITS).map(
            rule => rule.windowSeconds
        )
    ) / SECONDS_PER_HOUR;

const MINUTES: Record<Locale, (n: number) => string> = {
    ko: n => `${n}분`,
    en: n => `${n} minutes`,
    ja: n => `${n}分間`,
    zh: n => `${n}分钟`,
};
const HOURS: Record<Locale, (n: number) => string> = {
    ko: n => `${n}시간`,
    en: n => `${n} hours`,
    ja: n => `${n}時間`,
    zh: n => `${n}小时`,
};

interface LocalePhrases {
    readonly sec2Opening: string;
    readonly sec4Opening: string;
    /** §6 Upstash 목적 목록에 들어가는 문구. */
    readonly upstashPurpose: string;
    /** §7 쿠키 목록에서 이 쿠키 줄이 시작하는 문구(쿠키 이름은 상수에서 만든다). */
    readonly sec7Opening: string;
}

const PHRASES: Record<Locale, LocalePhrases> = {
    ko: {
        sec2Opening: '- 회원가입을 위해 이메일 인증을 요청한 경우',
        sec4Opening: '- 회원가입 이메일 인증 정보',
        upstashPurpose: '회원가입 이메일 인증 코드 보관과 요청·입력 횟수 제한',
        sec7Opening: `- **${SIGNUP_VERIFICATION_COOKIE_NAME}**`,
    },
    en: {
        sec2Opening: '- If email verification is requested for sign-up',
        sec4Opening: '- Sign-up email verification data',
        upstashPurpose:
            'the storage of the member sign-up email verification code with request and entry rate limiting',
        sec7Opening: `- **${SIGNUP_VERIFICATION_COOKIE_NAME}**`,
    },
    ja: {
        sec2Opening: '- 会員登録のためにメール認証をリクエストした場合',
        sec4Opening: '- 会員登録のメール認証情報',
        upstashPurpose:
            '会員登録のメール認証コードの保管とリクエスト・入力回数の制限',
        sec7Opening: `- **${SIGNUP_VERIFICATION_COOKIE_NAME}**`,
    },
    zh: {
        sec2Opening: '- 为注册而请求邮箱验证的',
        sec4Opening: '- 注册邮箱验证信息',
        upstashPurpose: '会员注册邮箱验证码的保存及请求、输入次数限制',
        sec7Opening: `- **${SIGNUP_VERIFICATION_COOKIE_NAME}**`,
    },
};

describe('회원가입 이메일 인증: 코드의 숫자가 방침의 고지와 같다', () => {
    it('바인딩 쿠키 이름은 방침이 적은 리터럴과 같다', () => {
        expect(SIGNUP_VERIFICATION_COOKIE_NAME).toBe('siglens_signup_verify');
    });

    it('인증 코드와 완료 표시는 30분, 횟수 제한 기록의 가장 긴 창은 24시간', () => {
        expect(PENDING_MINUTES).toBe(30);
        expect(VERIFIED_MINUTES).toBe(30);
        expect(LONGEST_WINDOW_HOURS).toBe(24);
    });
});

describe.each(LOCALES)(
    '개인정보처리방침 회원가입 이메일 인증 문구 (%s)',
    locale => {
        const policy = readPolicy(locale);
        const phrases = PHRASES[locale];
        const minutes = MINUTES[locale];
        const hours = HOURS[locale];

        it('§2 수집: 코드 보관 시간, 완료 표시 시간, 횟수 제한 기록 시간', () => {
            const bullet = lineStartingWith(
                sectionBetween(policy, 2, 3),
                phrases.sec2Opening
            );

            expect(bullet).not.toBe('');
            expect(bullet).toContain(minutes(PENDING_MINUTES));
            expect(bullet).toContain(minutes(VERIFIED_MINUTES));
            expect(bullet).toContain(hours(LONGEST_WINDOW_HOURS));
        });

        it('§4 보유: 같은 숫자가 보유 기간 항목에도 있다', () => {
            const bullet = lineStartingWith(
                sectionBetween(policy, 4, 5),
                phrases.sec4Opening
            );

            expect(bullet).not.toBe('');
            expect(bullet).toContain(minutes(PENDING_MINUTES));
            expect(bullet).toContain(minutes(VERIFIED_MINUTES));
            expect(bullet).toContain(hours(LONGEST_WINDOW_HOURS));
        });

        it('§7 쿠키: 바인딩 쿠키 줄이 이름과 수명(분)을 적고 HttpOnly다', () => {
            const bullet = lineStartingWith(
                sectionBetween(policy, 7, 8),
                phrases.sec7Opening
            );

            expect(bullet).not.toBe('');
            expect(bullet).toContain(minutes(VERIFIED_MINUTES));
            expect(bullet).toContain('HttpOnly');
        });

        it('§4 보유: 바인딩 쿠키 이름과 수명(분)을 보유 기간 항목에도 적는다', () => {
            const bullet = sectionBetween(policy, 4, 5)
                .split('\n')
                .find(line => line.includes(SIGNUP_VERIFICATION_COOKIE_NAME));

            expect(bullet).toBeDefined();
            expect(bullet).toContain(minutes(VERIFIED_MINUTES));
        });

        it('§6 위탁: Upstash 항목이 목적과 숫자를 적는다', () => {
            const upstash = lineStartingWith(
                sectionBetween(policy, 6, 7),
                '- **Upstash'
            );

            expect(upstash).toContain(phrases.upstashPurpose);
            expect(upstash).toContain(minutes(PENDING_MINUTES));
            expect(upstash).toContain(hours(LONGEST_WINDOW_HOURS));
        });
    }
);

describe('탐지기 반증(공회전 방지)', () => {
    const ko = readPolicy('ko');

    it('가장 긴 창 숫자를 바꾼 사본은 시간 검사를 통과하지 못한다', () => {
        const tampered = lineStartingWith(
            sectionBetween(ko, 2, 3),
            PHRASES.ko.sec2Opening
        ).replace(
            HOURS.ko(LONGEST_WINDOW_HOURS),
            HOURS.ko(LONGEST_WINDOW_HOURS + 1)
        );

        expect(tampered).not.toContain(HOURS.ko(LONGEST_WINDOW_HOURS));
    });

    it('바인딩 쿠키 수명 숫자를 바꾼 사본은 §7 검사를 통과하지 못한다', () => {
        const line = lineStartingWith(
            sectionBetween(ko, 7, 8),
            PHRASES.ko.sec7Opening
        );
        const tampered = line.replace(
            MINUTES.ko(VERIFIED_MINUTES),
            MINUTES.ko(VERIFIED_MINUTES + 1)
        );

        expect(line).toContain(MINUTES.ko(VERIFIED_MINUTES));
        expect(tampered).not.toContain(MINUTES.ko(VERIFIED_MINUTES));
    });

    it('쿠키 항목을 지운 사본에서는 줄을 찾지 못한다', () => {
        const tampered = sectionBetween(ko, 7, 8).replace(
            SIGNUP_VERIFICATION_COOKIE_NAME,
            'x'
        );

        expect(lineStartingWith(tampered, PHRASES.ko.sec7Opening)).toBe('');
    });

    it('항목을 지운 사본에서는 줄을 찾지 못한다', () => {
        const tampered = sectionBetween(ko, 4, 5).replace(
            PHRASES.ko.sec4Opening,
            '- x'
        );

        expect(lineStartingWith(tampered, PHRASES.ko.sec4Opening)).toBe('');
    });
});
