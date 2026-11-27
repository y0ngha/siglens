'use client';

/**
 * 다시 연 대화 맨 아래의 "분석 이후 달라진 점" 카드. 대화에 일봉 기술적 분석이 남아 있을 때만 나타나고,
 * 숫자는 모두 서버가 일봉으로 계산해 온 값을 문장 틀에 채운 것이다(모델 호출 없음, 저장 없음).
 */
import { useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useId, useState } from 'react';
import type {
    ChatChangeItem,
    ChatChangeSignalType,
    ChatChangeTrend,
    ChatSymbolChanges,
    ChatSymbolChangesResult,
} from '@/entities/chat-conversation/types';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { ArrowUpRightIcon } from '@/shared/ui/StrokeIcons';
import { AI_RAISED_CONTROL } from '../aiSurfaceStyles';
import { useConversationChanges } from '../hooks/useConversationChanges';
import {
    formatChangeSinceThen,
    formatMarketPrice,
    formatTradingDate,
} from '../utils/sinceEarlierFormat';

interface SinceEarlierCardProps {
    readonly conversationId: string;
    /** 미리 채운 질문을 다음 턴으로 보낸다(입력창과 같은 경로 — 한 턴으로 센다). */
    readonly onAsk: (text: string) => void;
    /** 대화 전체에서 받아 둔 표시 이름(`MessageList`의 `useRelatedPages`) — 첫 렌더부터 이름이 있어 제목이 다시 줄바꿈되지 않는다. */
    readonly labels: Readonly<Record<string, string>>;
    /** 카드가 처음 나타난 직후 — 맨 아래에 있던 사람의 자리를 카드 쪽으로 유지한다. */
    readonly onReveal: () => void;
    /** 스트리밍 중에는 질문을 보내지 않는다. */
    readonly asking: boolean;
}

const ASK_BUTTON =
    'mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm text-secondary-200 hover:text-secondary-100 aria-disabled:text-secondary-500 aria-disabled:hover:text-secondary-500';

function itemKey(item: ChatChangeItem): string {
    switch (item.kind) {
        case 'level':
            return `level-${item.side}-${item.price}`;
        case 'signal':
            return `signal-${item.type}-${item.date}`;
        case 'plan':
            return `plan-${item.position}`;
        default:
            return item.kind;
    }
}

/**
 * 비교한 결과가 "달라진 점 없음"이라고 말해도 되는가 — 추세 판정을 두 시점 모두 읽었고, 신호·종가를 못 읽은
 * 거래일이 없을 때만 그렇다. 하나라도 못 읽었으면 "없다"가 아니라 "확인하지 못했다"를 말한다.
 */
function isFullyRead(result: ChatSymbolChanges): boolean {
    return result.trendMeasured && result.unreadDays === 0;
}

export function SinceEarlierCard({
    conversationId,
    labels,
    onAsk,
    onReveal,
    asking,
}: SinceEarlierCardProps) {
    const t = useTranslations('widgets.agent-chat');
    const { results } = useConversationChanges(conversationId);
    const visible = results.length > 0;
    const reveal = useEffectEvent(onReveal);
    useEffect(() => {
        if (visible) reveal();
    }, [visible]);
    return (
        <>
            {/* 낭독 영역은 처음부터 트리에 있고 내용만 바뀐다 — 낭독 영역이 새로 생기면서 같이 나타난 글은 읽히지
                않는다. `sr-only`는 자리를 차지하지 않고(`display:none`이 아니다) 목록의 gap에도 끼지 않는다. */}
            <p role="status" className="sr-only">
                {visible ? t('sinceEarlier.announce') : ''}
            </p>
            {visible ? (
                // 카드는 대화 맨 끝에 붙으므로 위쪽 내용은 밀리지 않는다.
                <div
                    className="flex flex-col gap-4"
                    data-testid="since-earlier"
                >
                    {results.map(result => (
                        <SymbolCard
                            key={result.symbol}
                            result={result}
                            name={labels[result.symbol] ?? result.symbol}
                            onAsk={onAsk}
                            asking={asking}
                        />
                    ))}
                </div>
            ) : null}
        </>
    );
}

interface SymbolCardProps {
    readonly result: ChatSymbolChangesResult;
    readonly name: string;
    readonly onAsk: (text: string) => void;
    readonly asking: boolean;
}

function SymbolCard({ result, name, onAsk, asking }: SymbolCardProps) {
    // 비교할 게 없는 종목(`same_session`)은 서버가 보내지 않는다 — 와도 카드를 그리지 않는다.
    if (result.status === 'same_session') return null;
    return (
        <SymbolCardView
            result={result}
            name={name}
            onAsk={onAsk}
            asking={asking}
        />
    );
}

function SymbolCardView({
    result,
    name,
    onAsk,
    asking,
}: SymbolCardProps & {
    readonly result: Exclude<
        ChatSymbolChangesResult,
        { status: 'same_session' }
    >;
}) {
    const t = useTranslations('widgets.agent-chat');
    const locale = useResolvedLocale();
    const titleId = useId();
    const [now] = useState(() => new Date());
    const [asked, setAsked] = useState(false);
    const analysisDate = formatTradingDate(result.analyzedDate, locale, now);
    const askLabel = t('sinceEarlier.askLabel', { name });
    const handleAsk = (): void => {
        if (asked || asking) return;
        setAsked(true);
        onAsk(
            t('sinceEarlier.askPrompt', {
                name,
                symbol: result.symbol,
                date: analysisDate,
            })
        );
    };
    return (
        <section
            aria-labelledby={titleId}
            className={cn(SURFACE_CARD, 'p-4 text-secondary-200')}
        >
            <p id={titleId} className="text-sm font-medium text-secondary-100">
                {t('sinceEarlier.title', { name, date: analysisDate })}
            </p>
            {result.status === 'too_old' ? (
                <p className="mt-2 text-sm leading-6 text-secondary-300">
                    {t('sinceEarlier.tooOld')}
                </p>
            ) : (
                <>
                    <ChangesBody result={result} now={now} />
                    <button
                        type="button"
                        aria-disabled={asked || asking}
                        aria-label={askLabel}
                        onClick={handleAsk}
                        className={cn(AI_RAISED_CONTROL, ASK_BUTTON)}
                    >
                        {t('sinceEarlier.ask')}
                        <ArrowUpRightIcon className="size-4 shrink-0" />
                    </button>
                </>
            )}
        </section>
    );
}

function ChangesBody({
    result,
    now,
}: {
    readonly result: ChatSymbolChanges;
    readonly now: Date;
}) {
    const t = useTranslations('widgets.agent-chat');
    // 추세·신호 이름은 사이트 어디서나 같은 공용 이름을 쓴다.
    const tTrend = useTranslations('shared.enumLabel.trend');
    const tSignal = useTranslations('shared.enumLabel.signalType');
    const locale = useResolvedLocale();
    const date = (value: string): string =>
        formatTradingDate(value, locale, now);
    const money = (value: number): string =>
        formatMarketPrice(value, result.marketProfile);

    const trendLabel = (trend: ChatChangeTrend): string => {
        switch (trend) {
            case 'bullish':
                return tTrend('bullish');
            case 'bearish':
                return tTrend('bearish');
            case 'neutral':
                return tTrend('neutral');
        }
    };
    const signalName = (type: ChatChangeSignalType): string => {
        switch (type) {
            case 'golden_cross':
                return tSignal('golden_cross');
            case 'death_cross':
                return tSignal('death_cross');
            case 'new_52w_high':
                return tSignal('new_52w_high');
            case 'new_52w_low':
                return tSignal('new_52w_low');
            case 'rsi_oversold':
                return tSignal('rsi_oversold');
            case 'rsi_overbought':
                return tSignal('rsi_overbought');
            case 'macd_bullish_cross':
                return tSignal('macd_bullish_cross');
            case 'macd_bearish_cross':
                return tSignal('macd_bearish_cross');
        }
    };
    const lineFor = (item: ChatChangeItem): string => {
        switch (item.kind) {
            case 'trend':
                return t('sinceEarlier.trend', {
                    from: trendLabel(item.from),
                    to: trendLabel(item.to),
                    date: date(item.date),
                });
            case 'signal':
                return t('sinceEarlier.signal.line', {
                    signal: signalName(item.type),
                    date: date(item.date),
                });
            case 'level': {
                const args = {
                    price: money(item.price),
                    close: money(item.close),
                    date: date(item.date),
                };
                if (item.side === 'support')
                    return item.direction === 'down'
                        ? t('sinceEarlier.supportBroken', args)
                        : t('sinceEarlier.supportRegained', args);
                return item.direction === 'up'
                    ? t('sinceEarlier.resistanceBroken', args)
                    : t('sinceEarlier.resistanceLost', args);
            }
            case 'plan': {
                const args = {
                    low: money(item.zoneLow),
                    high: money(item.zoneHigh),
                    date: date(item.date),
                };
                if (item.position === 'in_zone')
                    return t('sinceEarlier.planInZone', args);
                return item.position === 'above_zone'
                    ? t('sinceEarlier.planAbove', args)
                    : t('sinceEarlier.planBelow', args);
            }
            case 'plan_stopped':
                return t('sinceEarlier.planStopped', {
                    stop: money(item.stop),
                    date: date(item.date),
                });
            case 'plan_no_setup':
                return t('sinceEarlier.planNoSetup', { date: date(item.date) });
        }
    };

    const change = formatChangeSinceThen(result.closeNow, result.closeThen);
    const priceArgs = {
        date: date(result.latestDate),
        now: money(result.closeNow),
        base: money(result.closeThen),
        pct: change ?? '',
    };
    const fullyRead = isFullyRead(result);
    return (
        <>
            {change === null ? null : (
                <p className="mt-1 text-xs leading-5 text-secondary-400">
                    {t('sinceEarlier.price', priceArgs)}
                </p>
            )}
            {result.items.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 text-sm leading-6">
                    {result.items.map(item => (
                        <li key={itemKey(item)}>
                            {lineFor(item)}
                            {item.kind === 'trend' ? (
                                <span className="block text-xs leading-5 text-secondary-400">
                                    {t('sinceEarlier.trendBasis', {
                                        period: result.trendEmaPeriod,
                                    })}
                                </span>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : null}
            {result.trendMeasured ? null : (
                <p className="mt-3 text-sm leading-6 text-secondary-300">
                    {t('sinceEarlier.partialTrend')}
                </p>
            )}
            {result.unreadDays > 0 ? (
                <p className="mt-2 text-sm leading-6 text-secondary-300">
                    {t('sinceEarlier.partialDays', {
                        count: result.unreadDays,
                    })}
                </p>
            ) : null}
            {result.items.length === 0 && fullyRead ? (
                <p className="mt-3 text-sm leading-6 text-secondary-300">
                    {result.hasLevels
                        ? t('sinceEarlier.noneWithLevels', {
                              date: date(result.latestDate),
                          })
                        : t('sinceEarlier.noneWithoutLevels', {
                              date: date(result.latestDate),
                          })}
                </p>
            ) : null}
        </>
    );
}
