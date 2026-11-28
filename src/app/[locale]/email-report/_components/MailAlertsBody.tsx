import type { SignalType } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import { reportSymbolLabel } from '@/entities/email-report/lib/reportSymbolLabel';
import type { ReportSymbolNames } from '@/entities/email-report/reportModel';
import { formatDate } from '@/entities/email-report/templates/emailFormat';
import { formatAlertPrice } from '@/entities/mail-alert/lib/formatAlertPrice';
import type {
    MailAlertLinkAuth,
    MailAlertManageView,
    MailAlertTopic,
    PriceAlertView,
} from '@/entities/mail-alert/model';
import type { MailAlertManageLoad } from '@/entities/mail-alert/server/mailAlertFlows';
import { getAssetInfoStatic } from '@/entities/ticker/server/getAssetInfoStatic';
import {
    MailAlertManage,
    type MailAlertManageTopic,
} from '@/features/mail-alert/ui/MailAlertManage';
import type {
    MailAlertManageFiredAlert,
    MailAlertManagePriceAlert,
    MailAlertManagePriceAlertLine,
} from '@/features/mail-alert/ui/MailAlertPriceAlerts';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import type { Locale } from '@/shared/i18n/locales';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { mapChunked } from '@/shared/lib/mapChunked';
import { withTimeout } from '@/shared/lib/withTimeout';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface MailAlertsBodyProps {
    readonly load: MailAlertManageLoad;
    readonly link: MailAlertLinkAuth | undefined;
    /** 날짜·가격을 쓰는 로케일(페이지가 경로에서 정한다). */
    readonly locale: Locale;
}

/** 이름 조회를 한 번에 띄우는 최대 개수(종목 페이지와 같은 데이터 캐시를 읽는다). */
const NAME_LOOKUP_CHUNK = 8;

/**
 * 이름 조회 전체에 거는 시간 상한. 이름은 보조 정보라 느린 캐시·DB 때문에 설정 화면이 같이 느려지면 안 된다.
 * 상한을 넘기면 아직 못 받은 종목은 코드로 그린다(조회는 취소되지 않고 뒤에서 끝나며, 실패는 `fetchNames`가 삼킨다).
 */
const NAME_LOOKUP_TIMEOUT_MS = 1500;

/** 종목 코드를 화면 표기(`이름 (코드)`)로 바꾼다. 이름이 없으면 코드 하나. */
type SymbolLabeler = (symbol: string) => string;

const LINK =
    'font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 설정 화면 본문. 서버가 읽은 상태(`load`)에 맞춰 목록·빈 상태·"메일 속 링크로 열어 주세요"·불러오기 실패
 * 중 하나를 그린다. 항목 이름(종목 코드, 신호 이름, 시장 이름이 든 문장)은 여기서 번역해 클라이언트 목록에
 * 넘긴다 — 신호·시장 이름 카탈로그를 클라이언트 번들에 싣지 않는다.
 */
export async function MailAlertsBody({
    load,
    link,
    locale,
}: MailAlertsBodyProps) {
    const t = await getTranslations('app.email-report.alerts');
    if (load.status === 'unavailable') {
        return <p className="text-sm text-secondary-400">{t('unavailable')}</p>;
    }
    if (load.status === 'unidentified') {
        return (
            <div className="space-y-3 text-sm">
                <p className="font-medium text-secondary-100">
                    {t('unidentifiedTitle')}
                </p>
                <p className="text-secondary-400">{t('unidentifiedBody')}</p>
                <Link href="/login" className={LINK}>
                    {t('login')}
                </Link>
            </div>
        );
    }
    if (load.status === 'empty') {
        return <p className="text-sm text-secondary-400">{t('empty')}</p>;
    }
    const labelSymbol = await createSymbolLabeler(load.view, locale);
    const [topics, priceAlerts, firedPriceAlerts] = await Promise.all([
        labelTopics(load.view.topics, labelSymbol),
        labelPriceAlerts(load.view.priceAlerts, locale, labelSymbol),
        labelFiredPriceAlerts(load.view.firedPriceAlerts, locale, labelSymbol),
    ]);
    return (
        <MailAlertManage
            maskedEmail={load.view.maskedEmail}
            topics={topics}
            priceAlerts={priceAlerts}
            firedPriceAlerts={firedPriceAlerts}
            includePortfolio={load.view.includePortfolio}
            link={link}
        />
    );
}

/** 이름 조회 실패는 이름만 비운다 — 코드로 떨어질 뿐 화면은 그려진다(메일 크론과 같은 규칙). */
async function fetchNames(symbol: string): Promise<ReportSymbolNames | null> {
    try {
        const info = await getAssetInfoStatic(symbol);
        return info === null
            ? null
            : { name: info.name, koreanName: info.koreanName };
    } catch (error) {
        console.warn(
            `[mail-alerts] asset name unavailable for ${symbol}`,
            redactDbErrorForLog(error)
        );
        return null;
    }
}

/**
 * 화면에 나올 종목마다 이름을 한 번씩만 조회해(병렬, 상한 있음) 메일과 같은 표기를 돌려주는 함수를 만든다.
 * 이름 카탈로그는 서버에서만 쓰고 클라이언트 목록에는 완성된 문장만 넘긴다.
 */
async function createSymbolLabeler(
    view: MailAlertManageView,
    locale: Locale
): Promise<SymbolLabeler> {
    const symbols = [
        ...new Set([
            ...view.topics.flatMap(topic =>
                topic.kind === 'symbol' ? [topic.symbol] : []
            ),
            ...view.priceAlerts.map(alert => alert.symbol),
            ...view.firedPriceAlerts.map(alert => alert.symbol),
        ]),
    ];
    // CONVENTIONS.md#CP-6 예외: 시간 상한에 걸리면 `mapChunked`의 결과 배열을 받을 수 없어, 끝난 종목만 남기려면 바깥 Map에 모아야 한다.
    const collected = new Map<string, string>();
    await withTimeout(
        mapChunked(symbols, NAME_LOOKUP_CHUNK, async symbol => {
            const names = await fetchNames(symbol);
            collected.set(
                symbol,
                reportSymbolLabel(symbol, names, locale).text
            );
        }),
        NAME_LOOKUP_TIMEOUT_MS,
        undefined
    );
    // 시간 안에 끝난 것만 쓴다. 늦게 끝나는 조회가 렌더 도중 표기를 바꾸지 않게 그 시점의 복사본을 쥔다.
    const labels = new Map(collected);
    return symbol =>
        labels.get(symbol) ?? reportSymbolLabel(symbol, null, locale).text;
}

/** 신호 이름은 `shared.enumLabel`의 신호 유형 라벨(신호별 종목 화면과 같은 이름)이다. */
async function labelTopics(
    topics: readonly MailAlertTopic[],
    labelSymbol: SymbolLabeler
): Promise<MailAlertManageTopic[]> {
    const [t, tAlert, tLabel] = await Promise.all([
        getTranslations('app.email-report.alerts'),
        getTranslations('features.mail-alert'),
        getTranslations('shared.enumLabel'),
    ]);
    const market = {
        us: tAlert('marketUs'),
        kr: tAlert('marketKr'),
        crypto: tAlert('marketCrypto'),
    };
    const signalLabel = (type: SignalType): string =>
        tLabel(`signalType.${type}`);
    const labelOf = (topic: MailAlertTopic): string => {
        switch (topic.kind) {
            case 'symbol':
                return t('topicSymbol', {
                    symbol: labelSymbol(topic.symbol),
                });
            case 'signal':
                return t('topicSignal', {
                    hubName: signalLabel(topic.signalType),
                });
            case 'fear_greed':
                return t('topicFearGreed', { market: market[topic.market] });
        }
    };
    return topics.map(topic => ({ topic, label: labelOf(topic) }));
}

/**
 * 진행 중인 알림 한 건은 조건 한 문장과 설명 줄(기준, 만든 날과 그때 가격, 유지 기간)이다. 가격은 대화의 알림 카드와
 * 같은 서식(`formatAlertPrice`, 시장 프로필의 통화)으로, 날짜는 로케일로 쓴다. 분석 기준 알림인데 분석 시각이 없으면 기준 줄은 날짜를 지어내지 않고 뺀다.
 */
async function labelPriceAlerts(
    alerts: readonly PriceAlertView[],
    locale: Locale,
    labelSymbol: SymbolLabeler
): Promise<MailAlertManagePriceAlert[]> {
    if (alerts.length === 0) return [];
    const t = await getTranslations('app.email-report.alerts');
    const price = (alert: PriceAlertView, value: number) =>
        formatAlertPrice(value, alert.market);
    const conditionText = (alert: PriceAlertView): string => {
        const { condition } = alert;
        const symbol = labelSymbol(alert.symbol);
        switch (condition.kind) {
            case 'enter_zone':
                return t('priceAlertEnterZone', {
                    symbol,
                    low: price(alert, condition.low),
                    high: price(alert, condition.high),
                });
            case 'close_below':
                return t('priceAlertBelow', {
                    symbol,
                    level: price(alert, condition.level),
                });
            case 'close_above':
                return t('priceAlertAbove', {
                    symbol,
                    level: price(alert, condition.level),
                });
        }
    };
    const basisLines = (
        alert: PriceAlertView
    ): MailAlertManagePriceAlertLine[] => {
        if (alert.basis === 'price_level') {
            return [{ key: 'basis', text: t('priceAlertBasisPrice') }];
        }
        if (alert.analysisAt === null) return [];
        const date = formatDate(kstDateKey(alert.analysisAt), locale);
        return [
            {
                key: 'basis',
                text:
                    alert.basis === 'analysis_entry_zone'
                        ? t('priceAlertBasisEntry', { date })
                        : t('priceAlertBasisInvalidation', { date }),
            },
        ];
    };
    return alerts.map(alert => ({
        id: alert.id,
        label: conditionText(alert),
        lines: [
            ...basisLines(alert),
            {
                key: 'created',
                text: t('priceAlertCreated', {
                    date: formatDate(kstDateKey(alert.createdAt), locale),
                    price: price(alert, alert.referenceClose),
                }),
            },
            {
                key: 'expires',
                text: t('priceAlertExpires', {
                    date: formatDate(alert.expiresOn, locale),
                }),
            },
        ],
    }));
}

/**
 * 알린 알림은 저장된 사실만 말한다: 어느 세션의 종가가 조건을 충족했고 그 종가가 얼마였는지. 메일이 실제로
 * 나갔는지는 저장하지 않는다 — 제공자가 확정적으로 거절하면 알림이 다시 진행 중이 되지만, 보내다 던진 경우는
 * 나갔는지 알 수 없어 알린 채로 남는다 — 그래서 "보냈다"고 쓰지 않는다.
 */
async function labelFiredPriceAlerts(
    alerts: readonly PriceAlertView[],
    locale: Locale,
    labelSymbol: SymbolLabeler
): Promise<MailAlertManageFiredAlert[]> {
    if (alerts.length === 0) return [];
    const t = await getTranslations('app.email-report.alerts');
    return alerts.flatMap(alert =>
        alert.firedSession === null || alert.firedClose === null
            ? []
            : [
                  {
                      id: alert.id,
                      text: t('priceAlertFired', {
                          symbol: labelSymbol(alert.symbol),
                          closeDate: formatDate(alert.firedSession, locale),
                          close: formatAlertPrice(
                              alert.firedClose,
                              alert.market
                          ),
                      }),
                  },
              ]
    );
}
