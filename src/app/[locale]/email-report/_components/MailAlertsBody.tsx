import { getTranslations } from 'next-intl/server';
import type { SignalType } from '@y0ngha/siglens-core';
import type {
    MailAlertLinkAuth,
    MailAlertTopic,
} from '@/entities/mail-alert/model';
import type { MailAlertManageLoad } from '@/entities/mail-alert/server/mailAlertFlows';
import {
    MailAlertManage,
    type MailAlertManageTopic,
} from '@/features/mail-alert/ui/MailAlertManage';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface MailAlertsBodyProps {
    readonly load: MailAlertManageLoad;
    readonly link: MailAlertLinkAuth | undefined;
}

const LINK =
    'font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 설정 화면 본문. 서버가 읽은 상태(`load`)에 맞춰 목록·빈 상태·"메일 속 링크로 열어 주세요"·불러오기 실패
 * 중 하나를 그린다. 항목 이름(종목 코드, 신호 이름, 시장 이름이 든 문장)은 여기서 번역해 클라이언트 목록에
 * 넘긴다 — 신호·시장 이름 카탈로그를 클라이언트 번들에 싣지 않는다.
 */
export async function MailAlertsBody({ load, link }: MailAlertsBodyProps) {
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
    const topics = await labelTopics(load.view.topics);
    return (
        <MailAlertManage
            maskedEmail={load.view.maskedEmail}
            topics={topics}
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
                return t('topicSymbol', { symbol: topic.symbol });
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
