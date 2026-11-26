import type { ShareKindCounts, ShareTotals } from '../model';

/**
 * KRX 상장주식수(`lstgStCnt`) — 한 기준일의 한 회사. 우선주는 KRX가 별도 종목으로 상장한 것만 더한다(`preferred`가 null이면 상장 우선주가
 * 없다: 비상장 상환전환우선주 등은 DART 표의 값을 그대로 둔다).
 */
export interface KrxShareCounts {
    /** KRX 기준일(`YYYY-MM-DD`). */
    asOf: string;
    common: number;
    preferred: number | null;
}

/**
 * 한 종류의 주식수를 KRX 상장주식수로 맞춘다. 차이 Δ = 상장주식수 − DART 발행주식 총수의 부호로 무슨 일이 있었는지 가른다:
 * - Δ ≥ 0 신주(유상·무상·전환): 발행·유통 모두 +Δ. 자기주식으로 바로 들어간 신주는 유통을 과대 계상하지만 드물다(표 이후의 일은 알 수 없다).
 * - −자기주식 ≤ Δ < 0 소각: 발행만 줄고 유통은 그대로 — 소각은 자기주식에서 나간다.
 * - Δ < −자기주식 감자·병합: 자기주식으로 설명되지 않으므로 유통도 같은 비율로 준다.
 */
function refreshKind(
    kind: ShareKindCounts | null,
    listed: number | null
): ShareKindCounts | null {
    if (kind === null || listed === null || !(listed > 0)) return kind;
    const delta = listed - kind.issued;
    if (delta >= 0) {
        return {
            issued: listed,
            treasury: kind.treasury,
            outstanding: kind.outstanding + delta,
        };
    }
    if (delta >= -kind.treasury) {
        return {
            issued: listed,
            treasury: kind.treasury + delta,
            outstanding: kind.outstanding,
        };
    }
    const scale = listed / kind.issued;
    return {
        issued: listed,
        treasury: kind.treasury * scale,
        outstanding: kind.outstanding * scale,
    };
}

/**
 * DART 주식 표(결산일 기준)를 그보다 늦은 KRX 상장주식수로 갱신한다(순수 함수). 1·3분기 보고서는 표를 싣지 않는 회사가 많아 앞선
 * 보고서의 표를 쓰는데, 그 사이의 증자·무상·분할·전환·소각이 빠지는 것을 막는다.
 *
 * 우선주 줄이 둘 이상이면(`preferredIsMixed`) 우선주는 갱신하지 않는다.
 *
 * 갱신하지 않고 `dart`를 그대로 돌려주는 경우: KRX 기준일이 표의 결산일보다 늦지 않다(최신이 아니다), 결산일을 모른다, 보통주 줄을
 * 못 읽었다(종류별로 가를 수 없다), 모든 종류의 Δ가 0이다. DART 표에 우선주 줄이 없으면 KRX가 우선주를 상장했어도 우선주는 건드리지 않는다(표에 없는 줄을 만들지 않는다). 갱신하면 합계는 `합계 줄 + Σ(종류별 변화)`다 — 종류로 분류되지 않는 줄이 있어도
 * 합계 줄의 값을 지키려는 것이다. 결과의 `settledOn`은 KRX 기준일, `source`는 `dart_krx`다.
 */
export function refreshShareCounts(
    dart: ShareTotals,
    krx: KrxShareCounts
): ShareTotals {
    if (
        dart.settledOn === null ||
        krx.asOf <= dart.settledOn ||
        dart.common === null
    )
        return dart;
    const common = refreshKind(dart.common, krx.common);
    // 우선주 줄이 여럿이면 KRX 상장 우선주 수가 DART 합과 같은 범위를 세지 않아(비상장 종류주식 포함 여부) 그대로 둔다.
    const preferred = dart.preferredIsMixed
        ? dart.preferred
        : refreshKind(dart.preferred, krx.preferred);
    const change = (field: keyof ShareKindCounts): number =>
        (common?.[field] ?? 0) -
        (dart.common?.[field] ?? 0) +
        ((preferred?.[field] ?? 0) - (dart.preferred?.[field] ?? 0));
    if (
        change('issued') === 0 &&
        change('treasury') === 0 &&
        change('outstanding') === 0
    )
        return dart;
    return {
        issued: dart.issued + change('issued'),
        treasury: dart.treasury + change('treasury'),
        outstanding: dart.outstanding + change('outstanding'),
        settledOn: krx.asOf,
        source: 'dart_krx',
        common,
        preferred,
        preferredIsMixed: dart.preferredIsMixed,
    };
}
