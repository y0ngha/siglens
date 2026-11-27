import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAIL_ALERT_COOKIE_NAME } from '@/entities/mail-alert/lib/mailAlertCookie';
import { LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * 알림 메일 신청(`mail_alert_*`)이 개인정보처리방침(§2 수집, §3 목적, §4 보유, §6 위탁, §7 쿠키, §8 권리)이
 * 적은 문구와 코드가 같은지 본다. 코드의 보관 숫자(인증 코드 30분, 발송 기록 90일, 쿠키 180일, 횟수 제한 기록
 * 1시간)는 `privacyRetention.test.ts` 레지스트리가 묶는다. **가장 높은 버전**의 원문을 읽는다.
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

/** `line`이 `opening`으로 시작하는 불릿·문단 한 줄. 없으면 빈 문자열. */
function lineStartingWith(section: string, opening: string): string {
    return section.split('\n').find(line => line.startsWith(opening)) ?? '';
}

interface LocalePhrases {
    readonly sec2Opening: string;
    readonly sec3: string;
    readonly sec4Subscription: string;
    readonly sec4Deliveries: string;
    readonly sec2Screens: string;
    readonly sec2Verified: string;
    readonly resend: string;
    readonly upstash: string;
    /** §2 항목: 한도를 거는 세 가지(요청, 입력, 항목 추가). */
    readonly sec2Limits: string;
    /** §6 Upstash: 코드 기록을 주소 해시로 구분해 보관한다는 문장. */
    readonly upstashKeyed: string;
    readonly cookieIntro: string;
    /** §7: 쿠키에 담기는 것(서명된 구독자 식별자와 발급 시각). */
    readonly cookieContents: string;
    readonly sec8: string;
}

const PHRASES: Record<Locale, LocalePhrases> = {
    ko: {
        sec2Opening: '- 알림 메일을 신청한 경우(회원과 비회원 모두)',
        sec3: '- 신청한 알림 메일 발송, 하루 한 통 상한과 같은 소식의 반복 발송 방지, 인증 메일 남용 방지',
        sec4Subscription: '- 알림 메일 신청 정보',
        sec4Deliveries: '- 알림 메일 발송 기록',
        sec2Screens:
            '종목 화면, 공포 탐욕 화면, 신호별 종목 화면, 알림 메일 설정 화면 중 하나',
        sec2Verified: '인증 코드를 입력해 주소를 확인한 뒤에만 저장됩니다',
        resend: '알림 메일의 경우 실린 종목명과 종목 코드, 신호 이름, 공포 탐욕 점수와 구간, 구독자 식별자가 서명과 함께 담긴 설정 링크와 수신거부 링크',
        upstash:
            '알림 메일 신청의 인증 코드 보관과 요청·입력·항목 추가 횟수 제한',
        sec2Limits: '인증 메일 요청, 코드 입력, 항목 추가 횟수를 제한하려고',
        upstashKeyed: '이메일 주소의 해시를 키로 보관하는 인증 코드',
        cookieIntro: '알림 메일을 신청한 브라우저에는 다음 쿠키도 사용합니다',
        cookieContents: '서명된 구독자 식별자와 발급 시각만 담으며',
        sec8: '알림 메일은 메일 하단의 수신거부 링크, 메일 앱의 수신거부 버튼, 메일 속 설정 링크, 또는 로그인 후 [알림 메일 설정](/email-report/alerts) 화면에서 언제든 끌 수 있으며',
    },
    en: {
        sec2Opening:
            '- If an alert email subscription is made (by members and non-members alike)',
        sec3: '- Sending the alert emails requested, limiting delivery to one email a day and preventing repeated delivery of the same news, and preventing abuse of verification emails',
        sec4Subscription: '- Alert email subscription information',
        sec4Deliveries: '- Alert email delivery records',
        sec2Screens:
            'one of the stock screen, the Fear & Greed screen, the signal stocks screen, or the alert email settings screen',
        sec2Verified:
            'stored only after the address is confirmed by entering a verification code',
        resend: 'For alert emails, the names and symbol codes of the stocks included in the email, the signal names, the Fear & Greed score and zone, and a settings link and an unsubscribe link containing the subscriber identifier with a signature',
        upstash:
            'the storage of the alert email sign-up verification code with request, entry and item addition rate limiting',
        sec2Limits:
            'to limit verification email requests, code entries and item additions',
        upstashKeyed: 'kept under a key made from a hash of the email address',
        cookieIntro:
            'For browsers that subscribed to alert emails, the following cookie is also used',
        cookieContents: 'a signed subscriber identifier and its issue time',
        sec8: 'Alert emails can be turned off at any time using the unsubscribe link at the bottom of the email, the unsubscribe button of the email app, the settings link in the email, or the [alert email settings](/email-report/alerts) screen after logging in',
    },
    ja: {
        sec2Opening: '- アラートメールを申し込んだ場合(会員・非会員とも)',
        sec3: '- 申し込まれたアラートメールの送信、1日1通の上限および同じ情報の重複送信の防止、認証メールの悪用防止',
        sec4Subscription: '- アラートメールの申し込み情報',
        sec4Deliveries: '- アラートメールの送信記録',
        sec2Screens:
            '銘柄画面、恐怖強欲指数の画面、シグナル別銘柄の画面、アラートメール設定画面のいずれか',
        sec2Verified:
            '認証コードを入力してアドレスを確認した後にのみ保存されます',
        resend: 'アラートメールの場合は、メールに載せる銘柄名と銘柄コード、シグナル名、恐怖強欲スコアとゾーン、および購読者識別子が署名とともに含まれる設定リンクと配信停止リンク',
        upstash:
            'アラートメール申し込みの認証コードの保管とリクエスト・入力・項目追加回数の制限',
        sec2Limits:
            '認証メールのリクエスト、コード入力、項目追加の回数を制限するため',
        upstashKeyed: 'メールアドレスのハッシュをキーとして保管する認証コード',
        cookieIntro:
            'アラートメールを申し込んだブラウザでは、次のクッキーも使用します',
        cookieContents: '署名された購読者識別子と発行時刻のみを含み',
        sec8: 'アラートメールは、メール下部の配信停止リンク、メールアプリの配信停止ボタン、メール内の設定リンク、またはログイン後の[アラートメール設定](/email-report/alerts)画面からいつでも停止でき',
    },
    zh: {
        sec2Opening: '- 申请提醒邮件的情况(会员与非会员均适用)',
        sec3: '- 发送所申请的提醒邮件、每日最多一封及防止重复发送相同消息、防止滥用验证邮件',
        sec4Subscription: '- 提醒邮件订阅信息',
        sec4Deliveries: '- 提醒邮件发送记录',
        sec2Screens:
            '股票页面、恐惧与贪婪页面、信号个股页面、提醒邮件设置页面之一',
        sec2Verified: '确认地址之后才会保存订阅',
        resend: '提醒邮件会传输邮件中所含的股票名称和股票代码、信号名称、恐惧与贪婪分数及区间,以及附带签名并含订阅者标识符的设置链接和退订链接',
        upstash: '提醒邮件订阅验证码的保存及请求、输入、项目添加次数限制',
        sec2Limits: '为限制验证邮件请求、验证码输入和项目添加次数',
        upstashKeyed: '以邮箱地址哈希为键保存的验证码',
        cookieIntro: '申请了提醒邮件的浏览器还会使用以下Cookie',
        cookieContents: '经签名的订阅者标识符和签发时间',
        sec8: '提醒邮件可随时通过邮件底部的退订链接、邮件应用的退订按钮、邮件中的设置链接,或登录后的[提醒邮件设置](/email-report/alerts)页面关闭',
    },
};

describe('알림 메일: 코드의 이름이 방침의 고지와 같다', () => {
    it('쿠키 이름은 방침이 적는 이름이다', () => {
        expect(MAIL_ALERT_COOKIE_NAME).toBe('siglens_mail_alert');
    });
});

describe.each(LOCALES)('개인정보처리방침 알림 메일 문구 (%s)', locale => {
    const policy = readPolicy(locale);
    const phrases = PHRASES[locale];
    const sec2 = sectionBetween(policy, 2, 3);
    const sec4 = sectionBetween(policy, 4, 5);
    const sec6 = sectionBetween(policy, 6, 7);
    const sec7 = sectionBetween(policy, 7, 8);
    const sec8 = sectionBetween(policy, 8, 9);

    it('§2 신청 항목: 화면 목록, 코드 확인 후 저장, 한도 대상', () => {
        const bullet = lineStartingWith(sec2, phrases.sec2Opening);

        expect(bullet).not.toBe('');
        expect(bullet).toContain(phrases.sec2Screens);
        expect(bullet).toContain(phrases.sec2Verified);
        expect(bullet).toContain(phrases.sec2Limits);
    });

    it('§3 목적: 발송, 하루 한 통 상한, 반복 발송 방지, 남용 방지', () => {
        expect(sectionBetween(policy, 3, 4)).toContain(phrases.sec3);
    });

    it('§4 보유: 신청 정보와 발송 기록 항목이 있다', () => {
        expect(lineStartingWith(sec4, phrases.sec4Subscription)).not.toBe('');
        expect(lineStartingWith(sec4, phrases.sec4Deliveries)).not.toBe('');
    });

    it('§6 위탁: Resend 전송 항목과 Upstash 보관 항목이 적혀 있다', () => {
        expect(sec6).toContain(phrases.resend);
        expect(sec6).toContain(phrases.upstash);
        const upstash = lineStartingWith(sec6, '- **Upstash');
        expect(upstash).toContain(phrases.upstashKeyed);
    });

    it('§7 쿠키: 이름, 속성이 적혀 있다', () => {
        const cookie = lineStartingWith(
            sec7,
            `- **${MAIL_ALERT_COOKIE_NAME}**`
        );

        expect(sec7).toContain(phrases.cookieIntro);
        expect(cookie).toContain(phrases.cookieContents);
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
    });

    it('§8 권리: 어디서든 끌 수 있고 설정 화면 링크가 있다', () => {
        expect(sec8).toContain(phrases.sec8);
    });
});

describe('탐지기 반증(공회전 방지)', () => {
    const ko = readPolicy('ko');

    it('쿠키 항목을 지운 사본에서는 쿠키 줄을 찾지 못한다', () => {
        const tampered = sectionBetween(ko, 7, 8).replace(
            MAIL_ALERT_COOKIE_NAME,
            'x'
        );

        expect(
            lineStartingWith(tampered, `- **${MAIL_ALERT_COOKIE_NAME}**`)
        ).toBe('');
    });
});
