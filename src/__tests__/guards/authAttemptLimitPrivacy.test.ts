import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    LOGIN_RATE_LIMITS,
    PASSWORD_RESET_RATE_LIMITS,
} from '@/entities/auth/lib/authUseCaseConstants';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * 로그인·비밀번호 재설정 요청의 횟수 제한 기록(이메일 주소 해시와 IP 해시 카운터)이 개인정보처리방침
 * (§2 수집, §4 보유, §6 위탁 Upstash, §9 안전성 확보 조치)이 적은 보관 시간과 같은지 본다. 두 한도 표의 가장
 * 긴 창이 바뀌면 이 테스트가 깨져 방침을 함께 고치게 된다. **가장 높은 버전**의 원문을 읽는다.
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

/**
 * §6 Upstash 줄에서 이 흐름의 보관 문장(마지막으로 목적 문구가 나오는 곳부터 끝까지). 목적 목록에도 같은 문구가
 * 있으므로 앞쪽 다른 흐름의 시간으로 통과하지 않게 뒤를 자른다.
 */
function storageSentence(upstash: string, purpose: string): string {
    const at = upstash.lastIndexOf(purpose);
    return at === -1 ? '' : upstash.slice(at);
}

const LONGEST_WINDOW_HOURS =
    Math.max(
        ...[
            ...Object.values(LOGIN_RATE_LIMITS),
            ...Object.values(PASSWORD_RESET_RATE_LIMITS),
        ].map(rule => rule.windowSeconds)
    ) / SECONDS_PER_HOUR;

const HOURS: Record<Locale, (n: number) => string> = {
    ko: n => `${n}시간`,
    en: n => `${n} hours`,
    ja: n => `${n}時間`,
    zh: n => `${n}小时`,
};

interface LocalePhrases {
    readonly sec2Opening: string;
    readonly sec4Opening: string;
    /** §6 Upstash 줄에 들어가는 이 흐름의 문구. */
    readonly upstashPurpose: string;
    readonly sec9Opening: string;
}

const PHRASES: Record<Locale, LocalePhrases> = {
    ko: {
        sec2Opening: '- 로그인과 비밀번호 재설정 요청 횟수를 제한하려고',
        sec4Opening: '- 로그인·비밀번호 재설정 횟수 제한 기록',
        upstashPurpose: '로그인과 비밀번호 재설정 요청 횟수 제한',
        sec9Opening: '- 로그인 시도와 인증·재설정 메일 요청의 횟수 제한',
    },
    en: {
        sec2Opening: '- To limit login attempts and password reset requests',
        sec4Opening: '- Login and password reset rate limit records',
        upstashPurpose: 'login and password reset request rate limiting',
        sec9Opening:
            '- Rate limiting of login attempts and of verification and reset email requests',
    },
    ja: {
        sec2Opening:
            '- ログインとパスワード再設定リクエストの回数を制限するため',
        sec4Opening: '- ログイン・パスワード再設定の回数制限の記録',
        upstashPurpose: 'ログインとパスワード再設定リクエストの回数制限',
        sec9Opening: '- ログイン試行と認証・再設定メールのリクエストの回数制限',
    },
    zh: {
        sec2Opening: '- 为限制登录和密码重设请求的次数',
        sec4Opening: '- 登录及密码重设次数限制记录',
        upstashPurpose: '登录及密码重设请求次数限制',
        sec9Opening: '- 登录尝试及验证、重设邮件请求的次数限制',
    },
};

describe('로그인·재설정 횟수 제한: 코드의 숫자가 방침의 고지와 같다', () => {
    it('두 한도 표의 가장 긴 창은 24시간', () => {
        expect(LONGEST_WINDOW_HOURS).toBe(24);
    });
});

describe.each(LOCALES)(
    '개인정보처리방침 로그인·재설정 횟수 제한 문구 (%s)',
    locale => {
        const policy = readPolicy(locale);
        const phrases = PHRASES[locale];
        const hours = HOURS[locale];

        it('§2 수집: 가장 긴 창 시간을 적는다', () => {
            const bullet = lineStartingWith(
                sectionBetween(policy, 2, 3),
                phrases.sec2Opening
            );

            expect(bullet).not.toBe('');
            expect(bullet).toContain(hours(LONGEST_WINDOW_HOURS));
        });

        it('§4 보유: 같은 시간이 보유 기간 항목에도 있다', () => {
            const bullet = lineStartingWith(
                sectionBetween(policy, 4, 5),
                phrases.sec4Opening
            );

            expect(bullet).not.toBe('');
            expect(bullet).toContain(hours(LONGEST_WINDOW_HOURS));
        });

        it('§6 위탁: Upstash 항목이 이 흐름의 목적과 같은 시간을 적는다', () => {
            const upstash = lineStartingWith(
                sectionBetween(policy, 6, 7),
                '- **Upstash'
            );

            expect(upstash).toContain(phrases.upstashPurpose);
            expect(storageSentence(upstash, phrases.upstashPurpose)).toContain(
                hours(LONGEST_WINDOW_HOURS)
            );
        });

        it('§9 안전성 확보 조치: 횟수 제한 항목이 있다', () => {
            expect(
                lineStartingWith(
                    sectionBetween(policy, 9, 10),
                    phrases.sec9Opening
                )
            ).not.toBe('');
        });
    }
);

describe('탐지기 반증(공회전 방지)', () => {
    const ko = readPolicy('ko');

    it('가장 긴 창 숫자를 바꾼 사본은 §2 시간 검사를 통과하지 못한다', () => {
        const tampered = lineStartingWith(
            sectionBetween(ko, 2, 3),
            PHRASES.ko.sec2Opening
        ).replace(
            HOURS.ko(LONGEST_WINDOW_HOURS),
            HOURS.ko(LONGEST_WINDOW_HOURS + 1)
        );

        expect(tampered).not.toBe('');
        expect(tampered).not.toContain(HOURS.ko(LONGEST_WINDOW_HOURS));
    });

    it('§4 항목의 시간을 바꾼 사본은 §4 검사를 통과하지 못한다', () => {
        const tampered = lineStartingWith(
            sectionBetween(ko, 4, 5),
            PHRASES.ko.sec4Opening
        ).replace(
            HOURS.ko(LONGEST_WINDOW_HOURS),
            HOURS.ko(LONGEST_WINDOW_HOURS + 1)
        );

        expect(tampered).not.toBe('');
        expect(tampered).not.toContain(HOURS.ko(LONGEST_WINDOW_HOURS));
    });

    it('항목을 지운 사본에서는 줄을 찾지 못한다', () => {
        const tampered = sectionBetween(ko, 2, 3).replace(
            PHRASES.ko.sec2Opening,
            '- x'
        );

        expect(lineStartingWith(tampered, PHRASES.ko.sec2Opening)).toBe('');
    });

    it('Upstash 보관 문장의 시간을 바꾼 사본은 §6 검사를 통과하지 못한다', () => {
        const upstash = lineStartingWith(
            sectionBetween(ko, 6, 7),
            '- **Upstash'
        );
        const tampered = upstash.replace(
            storageSentence(upstash, PHRASES.ko.upstashPurpose),
            storageSentence(upstash, PHRASES.ko.upstashPurpose).replace(
                HOURS.ko(LONGEST_WINDOW_HOURS),
                HOURS.ko(LONGEST_WINDOW_HOURS + 1)
            )
        );

        expect(storageSentence(upstash, PHRASES.ko.upstashPurpose)).toContain(
            HOURS.ko(LONGEST_WINDOW_HOURS)
        );
        expect(
            storageSentence(tampered, PHRASES.ko.upstashPurpose)
        ).not.toContain(HOURS.ko(LONGEST_WINDOW_HOURS));
    });
});
