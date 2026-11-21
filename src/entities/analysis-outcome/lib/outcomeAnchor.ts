import type {
    MarketSessionSpec,
    OutcomeAnchor,
    OutcomeSubject,
    Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import {
    lastClosedSessionDate,
    sessionCloseUtcOnDate,
} from '@/shared/lib/marketSessionDate';
import type { AnchorCloseBasis } from '../types';
import { barSeconds } from './outcomePolicy';

/**
 * 분석이 어느 봉을 본 것인지(`OutcomeAnchor`)를 만든다.
 *
 * - `subject.anchor`가 있으면 그 봉과 종가를 넘기고, 분석 시점에 그 봉이 이미 닫혀 있었는지
 *   (`closedAtAnalysis`)를 시계로 계산한다. 닫혀 있었다면 core가 오늘의 종가와 비교해 분할·배당 조정 계수를 재고,
 *   형성 중이었다면 재지 못한다(`anchorForming`). 일봉은 세션 마감 순간(`sessionCloseUtcOnDate`), 분봉은
 *   봉 시작 + 봉 길이다. 마감 직후~EOD 발행 전에 생성된 분석도 완결된 봉을 본 것이므로 닫힌 앵커로 둔다 — 형성 중으로
 *   두면 미국 프리웜 분석(마감 뒤 몇 시간 안에 생성)의 대부분이 형성 중 앵커가 되어 조정 계수 보정을 건너뛰고
 *   통계에서 빠진다. 그 구간의 종가 출처는 {@link anchorCloseBasisOf}로 따로 기록한다.
 * - 없으면(`dataAsOf`가 생기기 전 옛 행) 생성 시각이 속한 봉을 쓰는 열화 경로(`{ generatedAtMs }`)다.
 *   core가 이 경우 `anchorSource: 'generated_at'`을 라벨에 싣는다 — 통계는 그 행을 따로 센다.
 */
export function buildOutcomeAnchor(
    subject: OutcomeSubject,
    generatedAt: Date,
    timeframe: Timeframe,
    spec: MarketSessionSpec
): OutcomeAnchor {
    const anchor = subject.anchor;
    if (anchor === null) return { generatedAtMs: generatedAt.getTime() };
    const closedAtMs =
        timeframe === '1Day'
            ? sessionCloseUtcOnDate(
                  spec,
                  toUtcIsoDate(new Date(anchor.barTime * MS_PER_SECOND))
              ).getTime()
            : (anchor.barTime + barSeconds(timeframe)) * MS_PER_SECOND;
    return {
        barTime: anchor.barTime,
        closeAtAnalysis: anchor.close,
        closedAtAnalysis: generatedAt.getTime() >= closedAtMs,
    };
}

/**
 * 일봉 앵커 종가가 공식 종가였는지 실시간 시세였는지(`analysis_outcomes.anchor_close_basis`). 라벨 단계에서
 * 정한다 — 저장된 생성 시각·앵커 봉 날짜와 그룹의 세션 스펙만 쓰므로 캡처는 종목을 해석하지 않아도 된다.
 *
 * - `'eod_published'`: 봉 날짜가 생성 시각의 `lastClosedSessionDate`(마감 + EOD 발행 버퍼를 지난 마지막 세션) 이하다.
 * - `'after_close_quote'`: 세션 마감 뒤지만 EOD 발행 전이라 제공자의 "오늘" 봉이 실시간 시세로 만들어졌다.
 * - `null`: 앵커가 없거나, 분봉(분봉 봉은 시세로 만들지 않아 구분할 게 없다)이거나, 일봉이 마감 전 형성 중이었다
 *   (이 경우는 core가 `anchorForming`으로 따로 다룬다).
 */
export function anchorCloseBasisOf(
    subject: OutcomeSubject,
    generatedAt: Date,
    timeframe: Timeframe,
    spec: MarketSessionSpec
): AnchorCloseBasis | null {
    const anchor = subject.anchor;
    if (anchor === null || timeframe !== '1Day') return null;
    const barDate = toUtcIsoDate(new Date(anchor.barTime * MS_PER_SECOND));
    if (barDate <= lastClosedSessionDate(spec, generatedAt)) {
        return 'eod_published';
    }
    return generatedAt.getTime() >=
        sessionCloseUtcOnDate(spec, barDate).getTime()
        ? 'after_close_quote'
        : null;
}
