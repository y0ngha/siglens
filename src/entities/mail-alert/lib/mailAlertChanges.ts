import {
    alertablePlanLevels,
    type ChangeReference,
    type TechnicalChange,
} from '@y0ngha/siglens-core';
import type { MailAlertChange } from '../model';

/**
 * 코어가 읽은 두 종가 사이의 변화(`technicalChangesBetween`)를 메일이 말하는 모양으로 옮긴다. 코어의 순서(가격 판정,
 * 가격대, 추세)를 그대로 지킨다.
 *
 * - 신호(`signal_started`)는 여기서 다루지 않는다: 신호 줄은 기존 `signal` 항목이고, 발송기가 같은 결과에서 따로
 *   꺼낸다(`collectAlertSources`의 일봉 판정).
 * - 진입 구간 안·위·아래와 무효화 기준 이하만 줄로 만든다. 계획이 "없어졌다"는 판정(`no_zone`, `no_stop`,
 *   `no_room_above`)은 가격으로 말할 수 있는 사실이 아니어서 뺀다.
 * - 줄이 말해야 하는 가격(구간 양끝, 무효화 기준)을 분석에서 읽지 못하면 그 줄은 뺀다 — 값을 지어내지 않는다.
 */
export function toMailAlertChanges(
    changes: readonly TechnicalChange[],
    reference: ChangeReference | null
): MailAlertChange[] {
    return changes.flatMap((change): MailAlertChange[] => {
        switch (change.kind) {
            case 'trend_changed':
                return [{ kind: 'trend', from: change.from, to: change.to }];
            case 'level_crossed':
                return reference === null
                    ? []
                    : [
                          {
                              kind: 'level',
                              side: change.side,
                              direction: change.direction,
                              price: change.price,
                              close: change.close,
                              analyzedAt: reference.analyzedAt,
                          },
                      ];
            case 'plan_position_changed':
                return planChangeOf(change, reference);
            case 'signal_started':
                return [];
            // 메일은 하루(직전 종가→오늘 종가)만 비교하고 계획 변화는 위치(`plan_position_changed`)로 이미 말한다.
            // 계획 경계의 첫 돌파 시각·되돌림(`pastNow`)은 여러 날을 보는 대화 쪽 읽기라 메일 줄로 만들지 않는다.
            case 'plan_level_crossed':
                return [];
        }
    });
}

function planChangeOf(
    change: Extract<TechnicalChange, { kind: 'plan_position_changed' }>,
    reference: ChangeReference | null
): MailAlertChange[] {
    if (reference === null || reference.plan === null) return [];
    const levels = alertablePlanLevels(reference.plan);
    if (change.to === 'no_setup') {
        return change.reason === 'stopped' && levels.invalidation !== null
            ? [
                  {
                      kind: 'plan_stopped',
                      stop: levels.invalidation,
                      close: change.close,
                      analyzedAt: reference.analyzedAt,
                  },
              ]
            : [];
    }
    return levels.entryZone === null
        ? []
        : [
              {
                  kind: 'plan_zone',
                  position: change.to,
                  low: levels.entryZone.low,
                  high: levels.entryZone.high,
                  close: change.close,
                  analyzedAt: reference.analyzedAt,
              },
          ];
}
