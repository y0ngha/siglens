import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * 로그인·비밀번호 재설정 요청의 횟수 제한 기록(이메일 주소 해시와 IP 해시 카운터)이 개인정보처리방침
 * (§2 수집, §4 보유, §6 위탁 Upstash, §9 안전성 확보 조치)에 고지돼 있는지 본다. 보관 시간(가장 긴 창)은
 * `privacyRetention.test.ts` 레지스트리가 코드 상수와 묶는다. **가장 높은 버전**의 원문을 읽는다.
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
        sec4Opening: '- 로그인과 비밀번호 재설정 횟수 제한 기록',
        upstashPurpose: '로그인과 비밀번호 재설정 요청 횟수 제한',
        sec9Opening: '- 로그인 시도와 인증 메일, 재설정 메일 요청의 횟수 제한',
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
        sec4Opening: '- ログインとパスワード再設定の回数制限の記録',
        upstashPurpose: 'ログインとパスワード再設定リクエストの回数制限',
        sec9Opening:
            '- ログイン試行と認証メール、再設定メールのリクエストの回数制限',
    },
    zh: {
        sec2Opening: '- 为限制登录和密码重设请求的次数',
        sec4Opening: '- 登录及密码重设次数限制记录',
        upstashPurpose: '登录及密码重设请求次数限制',
        sec9Opening: '- 登录尝试及验证、重设邮件请求的次数限制',
    },
};

describe.each(LOCALES)(
    '개인정보처리방침 로그인·재설정 횟수 제한 문구 (%s)',
    locale => {
        const policy = readPolicy(locale);
        const phrases = PHRASES[locale];

        it('§2 수집: 횟수 제한 기록 항목이 있다', () => {
            const bullet = lineStartingWith(
                sectionBetween(policy, 2, 3),
                phrases.sec2Opening
            );

            expect(bullet).not.toBe('');
        });

        it('§4 보유: 보유 기간 항목이 있다', () => {
            const bullet = lineStartingWith(
                sectionBetween(policy, 4, 5),
                phrases.sec4Opening
            );

            expect(bullet).not.toBe('');
        });

        it('§6 위탁: Upstash 항목이 이 흐름의 목적을 적는다', () => {
            const upstash = lineStartingWith(
                sectionBetween(policy, 6, 7),
                '- **Upstash'
            );

            expect(upstash).toContain(phrases.upstashPurpose);
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

    it('항목을 지운 사본에서는 줄을 찾지 못한다', () => {
        const tampered = sectionBetween(ko, 2, 3).replace(
            PHRASES.ko.sec2Opening,
            '- x'
        );

        expect(lineStartingWith(tampered, PHRASES.ko.sec2Opening)).toBe('');
    });
});
