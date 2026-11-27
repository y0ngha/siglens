import { TREND_EMA_PERIOD } from '@y0ngha/siglens-core';
import { reportSymbolLabel } from '@/entities/email-report/lib/reportSymbolLabel';
import { COLORS, FONT } from '@/entities/email-report/templates/emailTheme';
import {
    formatDate,
    formatSignedPercent,
} from '@/entities/email-report/templates/emailFormat';
import type { EmailMessage } from '@/shared/email/types';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { formatCurrencyForSymbol } from '@/shared/lib/priceFormat';
import {
    buildMailAlertFearGreedUrl,
    buildMailAlertHubUrl,
    buildMailAlertSymbolUrl,
} from '../lib/mailAlertLinks';
import type {
    MailAlertChangeItem,
    MailAlertFearGreedItem,
    MailAlertFearGreedMarket,
    MailAlertMineItem,
    MailAlertPriceAlertItem,
    MailAlertSignalItem,
    MailAlertVoidedPriceAlertItem,
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

/** 한 줄의 링크 달린 제목과 설명 줄들 — HTML과 평문이 같은 조각에서 나온다. */
interface Row {
    readonly title: string;
    readonly url: string | null;
    /** 설명 줄. 번역 조각을 코드에서 이어 붙이지 않으려고 줄마다 한 문장(키)이다(I18-14). */
    readonly details: readonly string[];
}

interface Block {
    readonly heading: string;
    readonly headingUrl: string | null;
    readonly rows: readonly Row[];
    /** 줄 수 상한으로 싣지 못한 종목이 있을 때의 한 줄. */
    readonly footnote: string | null;
    /** 각주 뒤에 이어지는 줄. 가격대 알림 섹션에서 "한 번 알리면 끝나요" 바로 뒤에 끝낸 알림 안내를 싣는다. */
    readonly closingRows?: readonly Row[];
}

/**
 * 종목 줄의 제목. 메일 리포트와 같은 `reportSymbolLabel`로 고른다: ko는 한글명, 다른 로케일은 영문 법인명,
 * 보이는 코드는 거래소 접미사를 뗀 표기(`005930`)다. 링크는 원문 심볼로 만든다(`signalRow`).
 *
 * 이름 조회가 없을 때만 신호 기록이 남긴 한글명(`item.name`)을 ko에서 쓴다 — 다른 로케일에 한글을 섞지 않는다.
 */
function signalTitle(
    item: Pick<MailAlertMineItem, 'name' | 'symbol'>,
    input: BuildMailAlertEmailInput
): string {
    const { locale } = input;
    const looked = input.symbolNames.get(item.symbol) ?? null;
    const names =
        looked ??
        (item.name === null || locale !== DEFAULT_LOCALE
            ? null
            : { name: '', koreanName: item.name });
    return reportSymbolLabel(item.symbol, names, locale).text;
}

/**
 * 문장 속에 들어가는 종목 표기(가격대 알림 줄). 종목 줄 제목과 같은 이름 원천·규칙이다. 이름 조회가 없으면
 * 접미사를 뗀 코드 하나다.
 */
function symbolText(symbol: string, input: BuildMailAlertEmailInput): string {
    return reportSymbolLabel(
        symbol,
        input.symbolNames.get(symbol) ?? null,
        input.locale
    ).text;
}

function signalRow(
    item: MailAlertSignalItem,
    input: BuildMailAlertEmailInput
): Row {
    return {
        title: signalTitle(item, input),
        url: buildMailAlertSymbolUrl(input.siteUrl, input.locale, item.symbol),
        details: [signalDetail(item, input)],
    };
}

function trendLabel(
    trend: 'bullish' | 'bearish' | 'neutral',
    t: MailAlertEmailTranslator
): string {
    switch (trend) {
        case 'bullish':
            return t('trendBullish');
        case 'bearish':
            return t('trendBearish');
        case 'neutral':
            return t('trendNeutral');
    }
}

/**
 * 달라진 점 한 줄의 문장과 근거 줄. 문장이 그 종가의 날짜와 종가를 직접 말하고(CS-18), 근거 줄은 무엇으로 읽었는지를
 * 적는다: 추세는 계산 기준, 가격대·진입 구간은 그 가격을 낸 AI 분석의 날짜다. 가격은 시장 표기 그대로 쓴다.
 * 말은 사실의 서술만 한다 — 이 변화로 무엇을 하라는 말도, 앞으로의 예상도 없다.
 */
function changeLines(
    item: MailAlertChangeItem,
    input: BuildMailAlertEmailInput
): string[] {
    const { t, locale } = input;
    const { change } = item;
    const date = formatDate(item.sessionDate, locale);
    const price = (value: number) =>
        formatCurrencyForSymbol(value, item.symbol, locale);
    const analysisDate = (analyzedAt: string) =>
        formatDate(kstDateKey(new Date(analyzedAt)), locale);
    switch (change.kind) {
        case 'trend': {
            const key = {
                bullish: 'changeTrendToBullish',
                bearish: 'changeTrendToBearish',
                neutral: 'changeTrendToNeutral',
            }[change.to];
            return [
                t(key, {
                    v0: date,
                    v1: trendLabel(change.from, t),
                    v2: trendLabel(change.to, t),
                }),
                // 일봉 두 종가를 읽은 판정이라 코어의 봉 수가 곧 일수다.
                t('changeTrendBasis', { v0: String(TREND_EMA_PERIOD) }),
            ];
        }
        case 'level': {
            const key = {
                support: {
                    down: 'changeSupportDown',
                    up: 'changeSupportUp',
                },
                resistance: {
                    up: 'changeResistanceUp',
                    down: 'changeResistanceDown',
                },
            }[change.side][change.direction];
            return [
                t(key, {
                    v0: date,
                    v1: price(change.price),
                    v2: price(change.close),
                }),
                t(
                    change.side === 'support'
                        ? 'changeBasisSupport'
                        : 'changeBasisResistance',
                    { v0: analysisDate(change.analyzedAt) }
                ),
            ];
        }
        case 'plan_zone': {
            const key = {
                in_zone: 'changePlanInZone',
                above_zone: 'changePlanAbove',
                below_zone: 'changePlanBelow',
            }[change.position];
            return [
                t(key, {
                    v0: date,
                    v1: price(change.low),
                    v2: price(change.high),
                    v3: price(change.close),
                }),
                t('priceAlertBasisEntry', {
                    v0: analysisDate(change.analyzedAt),
                }),
            ];
        }
        case 'plan_stopped':
            return [
                t('changePlanStopped', {
                    v0: date,
                    v1: price(change.stop),
                    v2: price(change.close),
                }),
                t('priceAlertBasisInvalidation', {
                    v0: analysisDate(change.analyzedAt),
                }),
            ];
    }
}

function signalDetail(
    item: MailAlertSignalItem,
    input: BuildMailAlertEmailInput
): string {
    const { t, locale, signalLabel } = input;
    const session = t(item.market === 'us' ? 'sessionUs' : 'sessionKr', {
        v0: formatDate(item.sessionDate, locale),
    });
    const change =
        item.changePercent === null
            ? []
            : [t('change', { v0: formatSignedPercent(item.changePercent) })];
    // 라벨 사전에 없는 유형은 알림 대상(허브 유형)에서는 일어나지 않는다 — 카탈로그 테스트가 고정한다.
    return [
        signalLabel(item.signalType) ?? item.signalType,
        session,
        ...change,
    ].join(' | ');
}

/** "담은 종목" 섹션: 종목마다 한 줄 제목 아래에 그 종목의 줄들을 싣는다(플래너가 정한 순서 그대로). */
function mineRows(
    items: readonly MailAlertMineItem[],
    input: BuildMailAlertEmailInput
): Row[] {
    const groups = Map.groupBy(items, item => `${item.market}:${item.symbol}`);
    return [...groups.values()].map(group => {
        const first = group[0];
        const named = group.find(item => item.name !== null) ?? first;
        return {
            title: signalTitle(named, input),
            url: buildMailAlertSymbolUrl(
                input.siteUrl,
                input.locale,
                first.symbol
            ),
            details: group.flatMap(item =>
                item.kind === 'signal'
                    ? [signalDetail(item, input)]
                    : changeLines(item, input)
            ),
        };
    });
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
        details: [t('viewFearGreed')],
    };
}

/**
 * 가격대 알림 한 줄의 문장. 조건 종류와(구간이면) 코어가 판정한 종가의 위치(`zonePosition`)로 사실인 문장을
 * 고른다: 구간 안에서 마감했으면 "안에 들어왔어요", 구간을 건너뛰어 아래·위에서 마감했으면 "아래로 내려왔어요"·
 * "위로 올라왔어요". 종가와 그 세션 날짜를 문장이 직접 말한다(CS-18).
 */
function priceAlertSentence(
    item: MailAlertPriceAlertItem,
    input: BuildMailAlertEmailInput
): string {
    const { t, locale } = input;
    const price = (value: number) =>
        formatCurrencyForSymbol(value, item.symbol, locale);
    const common = {
        v0: symbolText(item.symbol, input),
        v1: formatDate(item.firedSession, locale),
        v2: price(item.firedClose),
    };
    const { condition } = item;
    if (condition.kind === 'enter_zone') {
        const zone = {
            ...common,
            v3: price(condition.low),
            v4: price(condition.high),
        };
        switch (item.zonePosition) {
            case 'below':
                return t('priceAlertZonePassedDown', zone);
            case 'above':
                return t('priceAlertZonePassedUp', zone);
            default:
                return t('priceAlertZoneInside', zone);
        }
    }
    const level = { ...common, v3: price(condition.level) };
    return condition.kind === 'close_below'
        ? t('priceAlertCloseBelow', level)
        : t('priceAlertCloseAbove', level);
}

/** "기준" 줄: 무엇을 보고 만든 알림인지. 분석 기준 알림은 그 분석 날짜를, 직접 말한 가격은 그 사실을 적는다. */
function priceAlertBasis(
    item: MailAlertPriceAlertItem,
    input: BuildMailAlertEmailInput
): string[] {
    const { t, locale } = input;
    if (item.basis === 'price_level') return [t('priceAlertBasisPrice')];
    // 분석 기준 알림은 분석 시각을 함께 저장한다. 없으면 날짜를 지어내지 않고 줄을 뺀다.
    if (item.analysisAt === null) return [];
    const analysisDate = formatDate(kstDateKey(item.analysisAt), locale);
    return [
        item.basis === 'analysis_entry_zone'
            ? t('priceAlertBasisEntry', { v0: analysisDate })
            : t('priceAlertBasisInvalidation', { v0: analysisDate }),
    ];
}

/** 가격 기준이 달라져 끝낸 알림을 알리는 줄. 설명 줄은 없다. */
function voidedPriceAlertRow(
    item: MailAlertVoidedPriceAlertItem,
    input: BuildMailAlertEmailInput
): Row {
    const { t, locale, siteUrl } = input;
    return {
        title: t('priceAlertVoided', { v0: symbolText(item.symbol, input) }),
        url: buildMailAlertSymbolUrl(siteUrl, locale, item.symbol),
        details: [],
    };
}

function priceAlertRow(
    item: MailAlertPriceAlertItem,
    input: BuildMailAlertEmailInput
): Row {
    const { t, locale, siteUrl } = input;
    return {
        title: priceAlertSentence(item, input),
        url: buildMailAlertSymbolUrl(siteUrl, locale, item.symbol),
        details: [
            ...priceAlertBasis(item, input),
            t('priceAlertCreated', {
                v0: formatDate(kstDateKey(item.createdAt), locale),
                v1: formatCurrencyForSymbol(
                    item.referenceClose,
                    item.symbol,
                    locale
                ),
            }),
        ],
    };
}

function blocksOf(input: BuildMailAlertEmailInput): Block[] {
    const { t, locale, siteUrl, signalLabel } = input;
    const { priceAlerts, voidedPriceAlerts, fearGreed, mine, hubs } =
        input.plan.sections;
    return [
        ...(priceAlerts.length === 0 && voidedPriceAlerts.length === 0
            ? []
            : [
                  {
                      heading: t('sectionPriceAlert'),
                      headingUrl: null,
                      rows: priceAlerts.map(item => priceAlertRow(item, input)),
                      // 섹션 전체에 해당하는 문장이라 충족한 줄들 바로 뒤에 한 번만 싣는다.
                      footnote:
                          priceAlerts.length === 0
                              ? null
                              : t('priceAlertOneShot'),
                      closingRows: voidedPriceAlerts.map(item =>
                          voidedPriceAlertRow(item, input)
                      ),
                  },
              ]),
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
                      rows: mineRows(mine, input),
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
    return `<p style="font-size:14px;line-height:1.6;margin:0 0 12px;color:${COLORS.body};">${linked(row.title, row.url, `color:${COLORS.link};font-weight:600;text-decoration:none;`)}${row.details.length === 0 ? '' : `<br /><span style="font-size:13px;color:${COLORS.muted};">${row.details.map(escapeHtml).join('<br />')}</span>`}</p>`;
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
  ${block.footnote === null ? '' : `<p style="font-size:13px;color:${COLORS.muted};margin:${(block.closingRows ?? []).length > 0 ? '0 0 12px' : '0'};">${escapeHtml(block.footnote)}</p>`}
  ${(block.closingRows ?? []).map(rowHtml).join('\n  ')}
</div>`;
}

function blockText(block: Block): string[] {
    return [
        `[${block.heading}]`,
        ...block.rows.flatMap(row => [
            `- ${row.title}`,
            ...row.details.map(detail => `  ${detail}`),
            ...(row.url === null ? [] : [`  ${row.url}`]),
        ]),
        ...(block.footnote === null ? [] : [block.footnote]),
        ...(block.closingRows ?? []).flatMap(row => [
            `- ${row.title}`,
            ...row.details.map(detail => `  ${detail}`),
            ...(row.url === null ? [] : [`  ${row.url}`]),
        ]),
        '',
    ];
}

/**
 * 알림 메일 한 통. 본문의 문자열은 전부 이스케이프한다(종목명은 외부에서 온 값이다).
 *
 * 순서는 가격대 알림(사용자가 직접 요청한 것) → 공포·탐욕 → 담은 종목에서 달라진 점 → 신호별 새 종목. 홍보 문구는 싣지 않는다 — 신청한 사람이 요청한
 * 사실만 담는 메일이라야 광고성 정보로 보지 않는다(가입 권유는 신청 직후 화면에만 둔다). 투자 면책 고지와
 * 설정·수신거부 링크를 끝에 두고, `List-Unsubscribe`(+ `-Post`, RFC 8058)로 메일 앱의 원클릭 수신거부를 연다.
 */
export function buildMailAlertEmail(
    input: BuildMailAlertEmailInput
): EmailMessage & { idempotencyKey: string } {
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
            // 숫자 그대로 넘긴다 — en은 ICU 복수형(`one`/`other`)으로 고른다.
            v2: plan.itemKeys.length,
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
