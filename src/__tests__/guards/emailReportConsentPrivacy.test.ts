vi.mock('server-only', () => ({}));

import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
    DEFAULT_EMAIL_REPORT_DAYS,
    DEFAULT_EMAIL_REPORT_HOUR,
    DEFAULT_EMAIL_REPORT_TIMEZONE,
} from '@/entities/email-report/lib/emailReportConstants';
import { DELIVERY_RETENTION_MS } from '@/app/api/cron/email-report/runEmailReportBatch';
import { MS_PER_DAY } from '@/shared/config/time';
import { EMAIL_REPORT_CONSENT_SOURCE_VALUES } from '@/shared/db/constants';
import { LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * 가입 화면에서 받는 메일 리포트 수신 동의는 개인정보처리방침(§2 수집 항목, §4 보유, §8 권리)이 고지한
 * 일정·화면·선택 사항 문구와 코드가 일치해야 한다. 기본 일정(월요일 오전 8시, 브라우저 시간대, 없으면 서울)이나
 * 동의를 받는 화면이 바뀌면 방침도 함께 바뀌어야 하고, 방침의 문구가 지워지면 이 테스트가 깨진다.
 * **가장 높은 버전**의 원문을 읽는다(`visitHistoryPrivacy.test.ts`와 같은 방식).
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

/** §2에서 메일 리포트 신청 항목(불릿)만. 첫 문구로 찾는다. */
const MAIL_BULLET_OPENING: Record<Locale, string> = {
    ko: '- 메일 리포트를 신청한 경우',
    en: '- If the member subscribes to the email report',
    ja: '- メールレポートを申し込んだ場合',
    zh: '- 订阅邮件报告的',
};

function mailBullet(locale: Locale, section2: string): string {
    return (
        section2
            .split('\n')
            .find(line => line.startsWith(MAIL_BULLET_OPENING[locale])) ?? ''
    );
}

/** 기본 일정, 선택 사항(기본 미선택), 동의를 받는 세 화면. 로케일마다 한 문구씩. */
const CONSENT_PHRASES: Record<
    Locale,
    {
        schedule: string;
        unselected: string;
        screens: string;
        timezone: string;
        language: string;
    }
> = {
    ko: {
        timezone: '그때 쓰던 브라우저의 시간대(알 수 없으면 서울)',
        language: '가입한 화면의 언어',
        schedule: '매주 월요일 오전 8시',
        unselected: '처음에는 선택되어 있지 않습니다',
        screens:
            '회원가입 화면, 소셜 로그인 가입의 동의 화면, 메일 리포트 설정 화면 중 하나',
    },
    en: {
        timezone:
            'the time zone of the browser used at that time (Seoul if it cannot be determined)',
        language: 'in the language of the signup screen',
        schedule: 'every Monday at 8 AM',
        unselected: 'not selected by default',
        screens:
            'the signup screen, the consent screen of a social login signup, or the email report settings screen',
    },
    ja: {
        timezone:
            'その時に使っていたブラウザのタイムゾーン(判別できない場合はソウル)',
        language: '登録した画面の言語',
        schedule: '毎週月曜日の午前8時',
        unselected: '初期状態では選択されていません',
        screens:
            '会員登録画面、ソーシャルログイン登録の同意画面、メールレポート設定画面のいずれか',
    },
    zh: {
        timezone: '当时所用浏览器的时区(无法确定时为首尔)',
        language: '邮件语言为注册页面的语言',
        schedule: '每周一上午8点',
        unselected: '默认不勾选',
        screens: '注册页面、社交登录注册的同意页面、邮件报告设置页面之一',
    },
};

/** §4 보유 기간의 설정 항목에 "수신에 동의한 화면"이 적힌 문구. */
const RETENTION_SCREEN_PHRASE: Record<Locale, string> = {
    ko: '수신에 동의한 화면',
    en: 'screen on which consent was given',
    ja: '受信に同意した画面',
    zh: '同意接收的页面',
};

/** §8: 가입할 때 수신을 고르지 않아도 제약이 없다는 문장. */
const NO_RESTRICTION_SENTENCE: Record<Locale, string> = {
    ko: '회원가입할 때 메일 리포트 받기를 고르지 않아도 가입과 서비스 이용에는 아무 제약이 없습니다.',
    en: 'Not choosing the email report at signup places no restriction on signing up or using the service.',
    ja: '会員登録時にメールレポートの受信を選ばなくても、登録とサービスの利用には何の制限もありません。',
    zh: '注册时不选择接收邮件报告,也不会对注册和使用服务造成任何限制。',
};

/** 가입 첫 리포트: §2 수집 항목(발송 상태·시도 횟수 저장), §3 목적, §4 보유, §6 Resend 이전 항목의 문구. */
const WELCOME_PHRASES: Record<
    Locale,
    {
        collected: string;
        purpose: string;
        retentionOpening: string;
        retentionDays: RegExp;
        processor: string;
    }
> = {
    ko: {
        collected: '가입한 뒤 첫 리포트를 한 번 보내며',
        purpose: '가입할 때 신청한 경우의 첫 리포트',
        retentionOpening: '- 가입 후 첫 리포트 발송 기록',
        retentionDays: /(\d+)일/,
        processor: '메일 리포트(가입 후 첫 리포트 포함)',
    },
    en: {
        collected: 'the first report is sent once after signup',
        purpose: 'the first report when the member subscribed at signup',
        retentionOpening: '- First-report delivery record after signup',
        retentionDays: /(\d+) days/,
        processor: 'the email report (including the first report after signup)',
    },
    ja: {
        collected: '登録後に最初のレポートを一度送信し',
        purpose: '登録時に申し込んだ場合の最初のレポート',
        retentionOpening: '- 登録後の最初のレポートの送信記録',
        retentionDays: /(\d+)日/,
        processor: 'メールレポート(登録後の最初のレポートを含む)',
    },
    zh: {
        collected: '注册后发送一次首份报告',
        purpose: '注册时订阅的首份报告',
        retentionOpening: '- 注册后首份报告的发送记录',
        retentionDays: /(\d+)天/,
        processor: '邮件报告(含注册后的首份报告)',
    },
};

/** §4에서 첫 리포트 발송 기록 불릿. 못 찾으면 빈 문자열. */
function welcomeRetentionBullet(locale: Locale, section4: string): string {
    return (
        section4
            .split('\n')
            .find(line =>
                line.startsWith(WELCOME_PHRASES[locale].retentionOpening)
            ) ?? ''
    );
}

/** 불릿의 "N일" 숫자. 없으면 `null`. */
function retentionDays(locale: Locale, bullet: string): number | null {
    const match = WELCOME_PHRASES[locale].retentionDays.exec(bullet);
    return match?.[1] === undefined ? null : Number(match[1]);
}

/** 불릿이 세 문구를 모두 담았는가. 하나라도 빠지면 `false`. */
function hasConsentClauses(locale: Locale, bullet: string): boolean {
    const { schedule, unselected, screens, timezone, language } =
        CONSENT_PHRASES[locale];
    return [schedule, unselected, screens, timezone, language].every(phrase =>
        bullet.includes(phrase)
    );
}

describe('메일 리포트 수신 동의: 코드 기본값이 방침의 고지와 같다', () => {
    it('기본 일정과 시간대는 방침 문구(월요일 오전 8시, 서울)와 같다', () => {
        expect(DEFAULT_EMAIL_REPORT_DAYS).toEqual([1]);
        expect(DEFAULT_EMAIL_REPORT_HOUR).toBe(8);
        expect(DEFAULT_EMAIL_REPORT_TIMEZONE).toBe('Asia/Seoul');
    });

    it('동의를 받는 화면은 방침이 적은 세 곳이다', () => {
        expect([...EMAIL_REPORT_CONSENT_SOURCE_VALUES]).toEqual([
            'settings',
            'signup_email',
            'signup_oauth',
        ]);
    });
});

describe.each(LOCALES)(
    '개인정보처리방침 메일 리포트 수신 동의 문구 (%s)',
    locale => {
        const policy = readPolicy(locale);

        it('§2 메일 리포트 항목에 기본 일정, 선택 사항 표시, 세 화면이 모두 적혀 있다', () => {
            const bullet = mailBullet(locale, sectionBetween(policy, 2, 3));

            expect(bullet).not.toBe('');
            expect(hasConsentClauses(locale, bullet)).toBe(true);
        });

        it('§4 보유 항목에 수신에 동의한 화면이 적혀 있다', () => {
            expect(sectionBetween(policy, 4, 5)).toContain(
                RETENTION_SCREEN_PHRASE[locale]
            );
        });

        it('§2 메일 리포트 항목에 가입 첫 리포트의 발송 상태 저장이 적혀 있다', () => {
            expect(mailBullet(locale, sectionBetween(policy, 2, 3))).toContain(
                WELCOME_PHRASES[locale].collected
            );
        });

        it('§3 목적에 가입할 때 신청한 경우의 첫 리포트 발송이 적혀 있다', () => {
            expect(sectionBetween(policy, 3, 4)).toContain(
                WELCOME_PHRASES[locale].purpose
            );
        });

        it('§4에 첫 리포트 발송 기록 항목이 있고 보유 일수가 발송 기록 보관 기간과 같다', () => {
            const bullet = welcomeRetentionBullet(
                locale,
                sectionBetween(policy, 4, 5)
            );

            expect(bullet).not.toBe('');
            expect(retentionDays(locale, bullet)).toBe(
                DELIVERY_RETENTION_MS / MS_PER_DAY
            );
        });

        it('§6 Resend 항목이 첫 리포트도 발송 대상으로 적는다', () => {
            const resendLine =
                sectionBetween(policy, 6, 7)
                    .split('\n')
                    .find(line => line.includes('Resend, Inc.')) ?? '';

            expect(resendLine).toContain(WELCOME_PHRASES[locale].processor);
        });

        it('§8에 가입할 때 수신을 고르지 않아도 제약이 없다는 문장이 있다', () => {
            expect(sectionBetween(policy, 8, 9)).toContain(
                NO_RESTRICTION_SENTENCE[locale]
            );
        });
    }
);

describe('탐지기 반증(공회전 방지)', () => {
    const policy = readPolicy('ko');
    const bullet = mailBullet('ko', sectionBetween(policy, 2, 3));

    it('일정 문구를 지운 사본은 탐지기가 거짓을 돌려준다', () => {
        const tampered = bullet.replace(CONSENT_PHRASES.ko.schedule, '');

        expect(hasConsentClauses('ko', bullet)).toBe(true);
        expect(hasConsentClauses('ko', tampered)).toBe(false);
    });

    it('선택 사항 표시를 지운 사본도 거짓이다', () => {
        const tampered = bullet.replace(CONSENT_PHRASES.ko.unselected, '');

        expect(hasConsentClauses('ko', tampered)).toBe(false);
    });

    it('시간대·메일 언어 문구를 지운 사본도 거짓이다', () => {
        expect(
            hasConsentClauses(
                'ko',
                bullet.replace(CONSENT_PHRASES.ko.timezone, '')
            )
        ).toBe(false);
        expect(
            hasConsentClauses(
                'ko',
                bullet.replace(CONSENT_PHRASES.ko.language, '')
            )
        ).toBe(false);
    });

    it('세 화면 문구를 지운 사본도 거짓이다', () => {
        const tampered = bullet.replace(CONSENT_PHRASES.ko.screens, '');

        expect(hasConsentClauses('ko', tampered)).toBe(false);
    });

    it('항목을 못 찾으면 빈 문자열이라 거짓이다', () => {
        expect(mailBullet('ko', '')).toBe('');
        expect(hasConsentClauses('ko', '')).toBe(false);
    });
});

describe('탐지기 반증: 첫 리포트 항목', () => {
    const section4 = sectionBetween(readPolicy('ko'), 4, 5);

    it('보유 일수를 바꾼 사본은 숫자가 달라진다', () => {
        const bullet = welcomeRetentionBullet('ko', section4);
        const tampered = bullet.replace('90일', '30일');

        expect(retentionDays('ko', bullet)).toBe(
            DELIVERY_RETENTION_MS / MS_PER_DAY
        );
        expect(retentionDays('ko', tampered)).toBe(30);
    });

    it('항목을 지운 사본은 빈 문자열이고 일수도 없다', () => {
        const tampered = section4
            .split('\n')
            .filter(line => !line.startsWith('- 가입 후 첫 리포트'))
            .join('\n');

        expect(welcomeRetentionBullet('ko', tampered)).toBe('');
        expect(retentionDays('ko', '')).toBeNull();
    });
});
