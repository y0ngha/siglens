import { COLORS, FONT } from '@/entities/email-report/templates/emailTheme';
import {
    formatDate,
    formatSignedPercent,
} from '@/entities/email-report/templates/emailFormat';
import type { EmailMessage } from '@/shared/email/types';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import {
    buildMailAlertFearGreedUrl,
    buildMailAlertHubUrl,
    buildMailAlertSymbolUrl,
} from '../lib/mailAlertLinks';
import type {
    MailAlertFearGreedItem,
    MailAlertFearGreedMarket,
    MailAlertSignalItem,
} from '../model';
import type {
    BuildMailAlertEmailInput,
    MailAlertEmailTranslator,
} from './mailAlertEmailTypes';

/**
 * HTML 본문 크기 상한(바이트). Gmail은 약 102KB를 넘는 메일을 잘라 "메시지 전체 보기"로 숨긴다. 담은 종목
 * 20줄과 신호별 8개 섹션(줄 10개씩)이 이 안에 드는지 테스트가 고정한다.
 */
export const MAIL_ALERT_EMAIL_MAX_HTML_BYTES = 100_000;

/** 한 줄의 링크 달린 제목과 설명 — HTML과 평문이 같은 조각에서 나온다. */
interface Row {
    readonly title: string;
    readonly url: string | null;
    readonly detail: string;
}

interface Block {
    readonly heading: string;
    readonly headingUrl: string | null;
    readonly rows: readonly Row[];
    /** 줄 수 상한으로 싣지 못한 종목이 있을 때의 한 줄. */
    readonly footnote: string | null;
}

function signalTitle(item: MailAlertSignalItem, locale: Locale): string {
    return item.name === null || locale !== DEFAULT_LOCALE
        ? item.symbol
        : `${item.name} (${item.symbol})`;
}

function signalRow(
    item: MailAlertSignalItem,
    input: BuildMailAlertEmailInput
): Row {
    const { t, locale, siteUrl, signalLabel } = input;
    const session = t(item.market === 'us' ? 'sessionUs' : 'sessionKr', {
        v0: formatDate(item.sessionDate, locale),
    });
    const change =
        item.changePercent === null
            ? []
            : [t('change', { v0: formatSignedPercent(item.changePercent) })];
    return {
        title: signalTitle(item, locale),
        url: buildMailAlertSymbolUrl(siteUrl, locale, item.symbol),
        // 라벨 사전에 없는 유형은 알림 대상(허브 유형)에서는 일어나지 않는다 — 카탈로그 테스트가 고정한다.
        detail: [
            signalLabel(item.signalType) ?? item.signalType,
            session,
            ...change,
        ].join(' | '),
    };
}

function marketName(
    market: MailAlertFearGreedMarket,
    t: MailAlertEmailTranslator
): string {
    switch (market) {
        case 'us':
            return t('marketUs');
        case 'kr':
            return t('marketKr');
        case 'crypto':
            return t('marketCrypto');
    }
}

function fearGreedRow(
    item: MailAlertFearGreedItem,
    input: BuildMailAlertEmailInput
): Row {
    const { t, locale, siteUrl } = input;
    const isFear = item.zone === 'EXTREME_FEAR';
    const zone = isFear ? t('zoneExtremeFear') : t('zoneExtremeGreed');
    return {
        title: t('fearGreedRow', {
            v0: marketName(item.market, t),
            v1: zone,
            v2: formatDate(item.date, locale),
            // 허브가 보여 주는 정수 점수 그대로다. 경계(25점 미만·75점 이상)는 이 줄에 붙이지 않는다 — 반올림된 점수
            // 옆에 놓으면 "25점"이 "25점 미만"과 어긋나 보인다. 구간 규칙은 신청 화면의 안내 문구가 말한다.
            v3: String(Math.round(item.score)),
        }),
        url: buildMailAlertFearGreedUrl(siteUrl, locale, item.market),
        detail: t('viewFearGreed'),
    };
}

function blocksOf(input: BuildMailAlertEmailInput): Block[] {
    const { t, locale, siteUrl, signalLabel } = input;
    const { fearGreed, mine, hubs } = input.plan.sections;
    return [
        ...(fearGreed.length === 0
            ? []
            : [
                  {
                      heading: t('sectionFearGreed'),
                      headingUrl: null,
                      rows: fearGreed.map(item => fearGreedRow(item, input)),
                      footnote: null,
                  },
              ]),
        ...(mine.length === 0
            ? []
            : [
                  {
                      heading: t('sectionMine'),
                      headingUrl: null,
                      rows: mine.map(item => signalRow(item, input)),
                      footnote: null,
                  },
              ]),
        ...hubs.map(section => {
            const label = signalLabel(section.signalType) ?? section.signalType;
            return {
                heading: t('sectionHub', { v0: label }),
                headingUrl: buildMailAlertHubUrl(
                    siteUrl,
                    locale,
                    section.signalType
                ),
                rows: section.items.map(item => signalRow(item, input)),
                footnote:
                    section.moreCount > 0
                        ? t('moreRows', { v0: String(section.moreCount) })
                        : null,
            };
        }),
    ];
}

function linked(text: string, url: string | null, style: string): string {
    return url === null
        ? escapeHtml(text)
        : `<a href="${escapeHtml(url)}" style="${style}">${escapeHtml(text)}</a>`;
}

function rowHtml(row: Row): string {
    return `<p style="font-size:14px;line-height:1.6;margin:0 0 12px;color:${COLORS.body};">${linked(row.title, row.url, `color:${COLORS.link};font-weight:600;text-decoration:none;`)}<br /><span style="font-size:13px;color:${COLORS.muted};">${escapeHtml(row.detail)}</span></p>`;
}

function blockHtml(block: Block): string {
    const heading = linked(
        block.heading,
        block.headingUrl,
        `color:${COLORS.heading};text-decoration:none;`
    );
    return `<div style="background:${COLORS.card};border-radius:12px;padding:20px 24px;margin:0 0 16px;">
  <h2 style="font-size:16px;margin:0 0 12px;color:${COLORS.heading};">${heading}</h2>
  ${block.rows.map(rowHtml).join('\n  ')}
  ${block.footnote === null ? '' : `<p style="font-size:13px;color:${COLORS.muted};margin:0;">${escapeHtml(block.footnote)}</p>`}
</div>`;
}

function blockText(block: Block): string[] {
    return [
        `[${block.heading}]`,
        ...block.rows.flatMap(row => [
            `- ${row.title}`,
            `  ${row.detail}`,
            ...(row.url === null ? [] : [`  ${row.url}`]),
        ]),
        ...(block.footnote === null ? [] : [block.footnote]),
        '',
    ];
}

/**
 * 알림 메일 한 통. 본문의 문자열은 전부 이스케이프한다(종목명은 외부에서 온 값이다).
 *
 * 순서는 공포·탐욕 → 담은 종목의 새 신호 → 신호별 새 종목. 홍보 문구는 싣지 않는다 — 신청한 사람이 요청한
 * 사실만 담는 메일이라야 광고성 정보로 보지 않는다(가입 권유는 신청 직후 화면에만 둔다). 투자 면책 고지와
 * 설정·수신거부 링크를 끝에 두고, `List-Unsubscribe`(+ `-Post`, RFC 8058)로 메일 앱의 원클릭 수신거부를 연다.
 */
export function buildMailAlertEmail(
    input: BuildMailAlertEmailInput
): EmailMessage {
    const { t, locale, plan } = input;
    const brand = brandName(locale);
    const blocks = blocksOf(input);
    const heading = t('heading');
    const intro = t('intro');
    const reason = t('reason', { v0: brand });

    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="font-family:${FONT};background:${COLORS.page};color:${COLORS.body};padding:24px 12px;margin:0;">
<div style="max-width:600px;margin:0 auto;">
  <div style="padding:8px 8px 20px;">
    <p style="font-size:13px;color:${COLORS.muted};margin:0 0 4px;">${escapeHtml(brand)}</p>
    <h1 style="font-size:22px;margin:0 0 8px;color:${COLORS.heading};">${escapeHtml(heading)}</h1>
    <p style="font-size:14px;color:${COLORS.body};margin:0;">${escapeHtml(intro)}</p>
  </div>
  ${blocks.map(blockHtml).join('\n  ')}
  <div style="padding:16px 8px;border-top:1px solid ${COLORS.rule};">
    <p style="font-size:12px;line-height:1.6;color:${COLORS.muted};margin:0 0 8px;">${escapeHtml(input.disclaimer)}</p>
    <p style="font-size:12px;line-height:1.6;color:${COLORS.faint};margin:0;">${escapeHtml(reason)} <a href="${escapeHtml(input.manageUrl)}" style="color:${COLORS.link};">${escapeHtml(t('manage'))}</a> | <a href="${escapeHtml(input.unsubscribePageUrl)}" style="color:${COLORS.link};">${escapeHtml(t('unsubscribe'))}</a></p>
  </div>
</div></body></html>`;

    const text = [
        heading,
        intro,
        '',
        ...blocks.flatMap(blockText),
        '---',
        input.disclaimer,
        reason,
        `${t('manage')}: ${input.manageUrl}`,
        `${t('unsubscribe')}: ${input.unsubscribePageUrl}`,
    ].join('\n');

    return {
        to: input.to,
        subject: t('subject', {
            v0: brand,
            v1: formatDate(input.alertDate, locale),
            v2: String(plan.itemKeys.length),
        }),
        html,
        text,
        headers: {
            'List-Unsubscribe': `<${input.unsubscribeApiUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        idempotencyKey: input.idempotencyKey,
    };
}
