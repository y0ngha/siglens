import { getTranslations } from 'next-intl/server';
import type { SignalType } from '@y0ngha/siglens-core';
import { formatDate } from '@/entities/email-report/templates/emailFormat';
import type {
    MailAlertLinkAuth,
    MailAlertTopic,
    PriceAlertView,
} from '@/entities/mail-alert/model';
import type { MailAlertManageLoad } from '@/entities/mail-alert/server/mailAlertFlows';
import {
    MailAlertManage,
    type MailAlertManageTopic,
} from '@/features/mail-alert/ui/MailAlertManage';
import type {
    MailAlertManageFiredAlert,
    MailAlertManagePriceAlert,
} from '@/features/mail-alert/ui/MailAlertPriceAlerts';
import type { Locale } from '@/shared/i18n/locales';
import { displayTicker } from '@/shared/lib/displayTicker';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { formatCurrencyForSymbol } from '@/shared/lib/priceFormat';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface MailAlertsBodyProps {
    readonly load: MailAlertManageLoad;
    readonly link: MailAlertLinkAuth | undefined;
    /** 날짜·가격을 쓰는 로케일(페이지가 경로에서 정한다). */
    readonly locale: Locale;
}

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
    const [topics, priceAlerts, firedPriceAlerts] = await Promise.all([
        labelTopics(load.view.topics),
        labelPriceAlerts(load.view.priceAlerts, locale),
        labelFiredPriceAlerts(load.view.firedPriceAlerts, locale),
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

/** 신호 이름은 `shared.enumLabel`의 신호 유형 라벨(신호별 종목 화면과 같은 이름)이다. */
async function labelTopics(
    topics: readonly MailAlertTopic[]
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
                    symbol: displayTicker(topic.symbol),
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
 * 진행 중인 알림 한 건은 조건 한 문장과 설명 줄(기준, 만든 날과 그때 가격, 유지 기간)이다. 가격은 종목의 통화로,
 * 날짜는 로케일로 쓴다. 분석 기준 알림인데 분석 시각이 없으면 기준 줄은 날짜를 지어내지 않고 뺀다.
 */
async function labelPriceAlerts(
    alerts: readonly PriceAlertView[],
    locale: Locale
): Promise<MailAlertManagePriceAlert[]> {
    if (alerts.length === 0) return [];
    const t = await getTranslations('app.email-report.alerts');
    const price = (alert: PriceAlertView, value: number) =>
        formatCurrencyForSymbol(value, alert.symbol, locale);
    const conditionText = (alert: PriceAlertView): string => {
        const { condition } = alert;
        const symbol = displayTicker(alert.symbol);
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
    const basisLines = (alert: PriceAlertView): string[] => {
        if (alert.basis === 'price_level') return [t('priceAlertBasisPrice')];
        if (alert.analysisAt === null) return [];
        const date = formatDate(kstDateKey(alert.analysisAt), locale);
        return [
            alert.basis === 'analysis_entry_zone'
                ? t('priceAlertBasisEntry', { date })
                : t('priceAlertBasisInvalidation', { date }),
        ];
    };
    return alerts.map(alert => ({
        id: alert.id,
        label: conditionText(alert),
        lines: [
            ...basisLines(alert),
            t('priceAlertCreated', {
                date: formatDate(kstDateKey(alert.createdAt), locale),
                price: price(alert, alert.referenceClose),
            }),
            t('priceAlertExpires', {
                date: formatDate(alert.expiresOn, locale),
            }),
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
    locale: Locale
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
                          symbol: displayTicker(alert.symbol),
                          closeDate: formatDate(alert.firedSession, locale),
                          close: formatCurrencyForSymbol(
                              alert.firedClose,
                              alert.symbol,
                              locale
                          ),
                      }),
                  },
              ]
    );
}
