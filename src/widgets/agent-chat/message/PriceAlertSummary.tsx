'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { ChatPriceAlertProposalBlock } from '@/entities/chat-conversation/types';
import { PRICE_ALERT_TTL_DAYS } from '@/entities/mail-alert/lib/priceAlertConstants';
import type { PriceAlertStoredTerms } from '@/entities/mail-alert/model';
import { MAIL_ALERT_SEND_HOURS_KST } from '@/entities/mail-alert/lib/mailAlertConstants';
import { alertSymbolLabel, formatAlertPrice } from '../utils/priceAlertCard';

/** 첫 발송 시각부터 마지막 재시도 슬롯의 한 시간 뒤까지가 "아침 N시에서 M시 사이"다(알림 메일 대화상자와 같다). */
const SEND_FROM_HOUR = MAIL_ALERT_SEND_HOURS_KST[0];
const SEND_TO_HOUR = MAIL_ALERT_SEND_HOURS_KST[1] + 1;

interface PriceAlertSummaryProps {
    readonly block: ChatPriceAlertProposalBlock;
    /**
     * 알림을 만든 뒤 저장된 값. 있으면 이 값만 보인다: 조건과 마지막 확인 날짜는 만드는 시각에 다시 계산되어 제안과 다를 수
     * 있으므로, 제안의 기준·종가·날짜를 그대로 두면 저장된 알림과 어긋난 안내가 된다.
     */
    readonly stored?: PriceAlertStoredTerms;
}

/**
 * 가격대 알림 제안이 무엇을 알리는지: 조건 한 문장(정확한 가격대, 닿거나 지나는 쪽), 가격대의 출처(분석 날짜 또는 대화), 만들 때의
 * 가격, 확인 규칙과 끝나는 날. 서버 상태와 무관한 순수 표시라 카드의 상태 흐름과 따로 둔다.
 */
export function PriceAlertSummary({ block, stored }: PriceAlertSummaryProps) {
    const t = useTranslations('widgets.agent-chat');
    const format = useFormatter();
    const { proposal } = block;
    const condition = stored?.condition ?? proposal.condition;
    const { market } = proposal;
    const label = alertSymbolLabel(proposal.symbol, block.name);
    const price = (value: number) => formatAlertPrice(value, market);
    const sessionDate = (value: string) =>
        format.dateTime(new Date(`${value}T00:00:00Z`), {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

    const conditionSentence = (): string => {
        if (condition.kind === 'enter_zone') {
            const zone = {
                name: label,
                low: price(condition.low),
                high: price(condition.high),
            };
            if (condition.approach === 'from_above') {
                return t('PriceAlertCard.zoneFromAbove', zone);
            }
            return t('PriceAlertCard.zoneFromBelow', zone);
        }
        const level = { name: label, level: price(condition.level) };
        if (condition.kind === 'close_below') {
            return t('PriceAlertCard.below', level);
        }
        return t('PriceAlertCard.above', level);
    };
    // 분석 시각은 순간이라 시장의 시간대로 날짜를 읽는다(미국 장 마감 뒤 23:30Z는 한국에서는 다음 날이다).
    const analysisDate = (value: string) =>
        format.dateTime(new Date(value), {
            timeZone: market === 'kr' ? 'Asia/Seoul' : 'America/New_York',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    const basisSentence = (): string => {
        if (proposal.basis === 'price_level' || proposal.analysisAt === null) {
            return t('PriceAlertCard.basisPrice');
        }
        const date = analysisDate(proposal.analysisAt);
        if (proposal.basis === 'analysis_entry_zone') {
            return t('PriceAlertCard.basisEntry', { date });
        }
        return t('PriceAlertCard.basisInvalidation', { date });
    };
    const lastClose = t('PriceAlertCard.lastClose', {
        date: sessionDate(proposal.startsAfterSession),
        price: price(proposal.referenceClose),
    });
    // 만들기 전에는 마지막 확인 날짜가 만드는 시각에 정해지므로 날짜 대신 기간으로 말한다.
    const rule =
        stored === undefined
            ? t('PriceAlertCard.ruleDays', {
                  from: SEND_FROM_HOUR,
                  to: SEND_TO_HOUR,
                  days: PRICE_ALERT_TTL_DAYS,
              })
            : t('PriceAlertCard.rule', {
                  from: SEND_FROM_HOUR,
                  to: SEND_TO_HOUR,
                  expiresOn: sessionDate(stored.expiresOn),
              });

    return (
        <>
            <p className="text-secondary-100">{conditionSentence()}</p>
            {stored === undefined ? (
                <p className="text-secondary-400">
                    {basisSentence()} {lastClose}
                </p>
            ) : null}
            <p className="text-secondary-400">{rule}</p>
        </>
    );
}
