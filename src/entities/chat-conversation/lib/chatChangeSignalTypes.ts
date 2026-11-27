import type { ConfirmedSignalType } from '@y0ngha/siglens-core';
import { SIGNAL_HUB_TYPES } from '@/entities/signal-history/lib/signalHubs';
import type { ChatChangeSignalType } from '../types';

/**
 * 카드와 `sinceEarlier`가 문장으로 푸는 신호. 신호별 종목 페이지(허브)가 여는 유형 목록(`SIGNAL_HUBS`)을 그대로
 * 쓴다 — 이름 카탈로그(`shared.enumLabel.signalType`)를 ai 호스트에 싣는 목록도 이것에서 나오므로, 허브가 늘면
 * 세 곳이 함께 따라온다. 그 밖의 신호는 core에 달라고 하지 않는다(`signalTypes` 필터).
 */
export const CHAT_CHANGE_SIGNAL_TYPES: readonly (ChatChangeSignalType &
    ConfirmedSignalType)[] = SIGNAL_HUB_TYPES;

const SIGNAL_TYPE_SET: ReadonlySet<string> = new Set(CHAT_CHANGE_SIGNAL_TYPES);

export function isChatChangeSignalType(
    type: string
): type is ChatChangeSignalType {
    return SIGNAL_TYPE_SET.has(type);
}
