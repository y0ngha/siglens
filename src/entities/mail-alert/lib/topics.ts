import type { SignalType } from '@y0ngha/siglens-core';
import { validateWatchlistSymbol } from '@/entities/watchlist/lib/validateWatchlistSymbol';
import type {
    MailAlertFearGreedMarket,
    MailAlertItem,
    MailAlertTopic,
} from '../model';
import {
    MAIL_ALERT_FEAR_GREED_MARKETS,
    MAIL_ALERT_SIGNAL_TYPES,
} from './mailAlertConstants';

/** `mail_alert_topics`의 (kind, key) 한 행. */
export interface MailAlertTopicRow {
    readonly kind: MailAlertTopic['kind'];
    readonly key: string;
}

export function topicToRow(topic: MailAlertTopic): MailAlertTopicRow {
    switch (topic.kind) {
        case 'symbol':
            return { kind: 'symbol', key: topic.symbol };
        case 'signal':
            return { kind: 'signal', key: topic.signalType };
        case 'fear_greed':
            return { kind: 'fear_greed', key: topic.market };
    }
}

function isSignalType(value: string): value is SignalType {
    return MAIL_ALERT_SIGNAL_TYPES.some(type => type === value);
}

function isFearGreedMarket(value: string): value is MailAlertFearGreedMarket {
    return MAIL_ALERT_FEAR_GREED_MARKETS.some(market => market === value);
}

/** 저장된 행 → 항목. 모르는 종류·값(허용 목록에서 빠진 옛 행 등)은 `null`이라 호출자가 건너뛴다. */
export function rowToTopic(row: {
    readonly kind: string;
    readonly key: string;
}): MailAlertTopic | null {
    switch (row.kind) {
        case 'symbol': {
            const result = validateWatchlistSymbol(row.key);
            return result.ok && result.symbol === row.key
                ? { kind: 'symbol', symbol: row.key }
                : null;
        }
        case 'signal':
            return isSignalType(row.key)
                ? { kind: 'signal', signalType: row.key }
                : null;
        case 'fear_greed':
            return isFearGreedMarket(row.key)
                ? { kind: 'fear_greed', market: row.key }
                : null;
        default:
            return null;
    }
}

function readField(
    input: FormData | Readonly<Record<string, unknown>>,
    name: string
): string | null {
    const value = input instanceof FormData ? input.get(name) : input[name];
    return typeof value === 'string' ? value : null;
}

/**
 * 화면·액션 입력 → 항목. `kind`에 맞는 필드(`symbol` | `signalType` | `market`)만 읽는다.
 * 심볼은 관심종목과 같은 검증·대문자화를 거치고, 신호 유형·시장은 허용 목록에 있어야 한다.
 * 어느 하나라도 어긋나면 `null`.
 */
export function parseTopicInput(
    input: FormData | Readonly<Record<string, unknown>>
): MailAlertTopic | null {
    const kind = readField(input, 'kind');
    if (kind === 'symbol') {
        const raw = readField(input, 'symbol');
        if (raw === null) return null;
        const result = validateWatchlistSymbol(raw);
        return result.ok ? { kind: 'symbol', symbol: result.symbol } : null;
    }
    if (kind === 'signal') {
        const value = readField(input, 'signalType');
        return value !== null && isSignalType(value)
            ? { kind: 'signal', signalType: value }
            : null;
    }
    if (kind === 'fear_greed') {
        const value = readField(input, 'market');
        return value !== null && isFearGreedMarket(value)
            ? { kind: 'fear_greed', market: value }
            : null;
    }
    return null;
}

/**
 * 최근에 이미 보낸 항목인지 가르는 키. 날짜는 넣지 않는다 — 같은 항목이 며칠 뒤 다시 열려도 같은 키라서 7일 창
 * 안에서는 걸러진다.
 *
 * - 신호: (시장, 종목, 유형). 공포·탐욕: (시장, 구간).
 * - 추세: (시장, 종목) — 종목당 7일에 한 줄이다. 같은 종목의 추세 판정은 사흘 안에 옛 값으로 돌아오는 일이 잦아
 *   (2017~2026 65종목 재생 측정에서 41.8%) 바뀐 방향마다 따로 알리면 같은 종목이 거의 매주 올라온다.
 * - 가격대: (시장, 종목, 분석 시각, 선의 종류, 가격). 진입 구간과 무효화 기준: (시장, 종목, 분석 시각, 구간 위치) — 같은
 *   분석의 같은 선·구간은 다시 알리지 않고, 새 분석이 나오면 새 키다.
 */
export function suppressionKey(item: MailAlertItem): string {
    switch (item.kind) {
        case 'signal':
            return `s:${item.market}:${item.symbol}:${item.signalType}`;
        case 'fear_greed':
            return `f:${item.market}:${item.zone}`;
        case 'change': {
            const { change } = item;
            const prefix = `${item.market}:${item.symbol}`;
            switch (change.kind) {
                case 'trend':
                    return `t:${prefix}`;
                case 'level':
                    return `l:${prefix}:${change.analyzedAt}:${change.side}:${change.price}`;
                case 'plan_zone':
                    return `pp:${prefix}:${change.analyzedAt}:${change.position}`;
                case 'plan_stopped':
                    return `pp:${prefix}:${change.analyzedAt}:stopped`;
            }
        }
    }
}
