import type {
    SkillGating,
    SkillStateFeature,
    SkillStatePredicate,
    SkillStatePredicateKind,
} from '@y0ngha/siglens-core';
import { isRecord } from '@/shared/lib/isRecord';
import { isOneOf } from './guards';

// core의 `SkillGating` 판별 유니온은 `tier` / `signalKind`를 인라인 리터럴로만 갖고 있어
// 독립 export 유니온이 없다. 그래서 유니온에서 닫힌 집합을 뽑고, `satisfies` + 아래 완전성
// 가드로 core가 tier나 gated signalKind를 늘리면 빌드가 깨지게 한다.
type SkillGatingTier = SkillGating['tier'];
type SkillSignalKind = Extract<SkillGating, { tier: 'gated' }>['signalKind'];

const SKILL_GATING_TIERS = [
    'always_on',
    'gated',
] as const satisfies readonly SkillGatingTier[];
const SIGNAL_KINDS = [
    'event',
    'state',
] as const satisfies readonly SkillSignalKind[];

type MissingGatingTier = Exclude<
    SkillGatingTier,
    (typeof SKILL_GATING_TIERS)[number]
>;
const _gatingTiersAreExhaustive: MissingGatingTier extends never
    ? true
    : never = true;
void _gatingTiersAreExhaustive;

type MissingSignalKind = Exclude<
    SkillSignalKind,
    (typeof SIGNAL_KINDS)[number]
>;
const _signalKindsAreExhaustive: MissingSignalKind extends never
    ? true
    : never = true;
void _signalKindsAreExhaustive;

/**
 * scripts/validate-skills.ts의 `STATE_FEATURES` / `STATE_PREDICATE_KINDS`와 같은 목록이다.
 * core의 SkillStateFeature / SkillStatePredicateKind에 멤버가 늘면 두 곳을 함께 고친다.
 * (src/는 런타임 파서이고 scripts/는 빌드 타임 검증기라 앱 `src/`를 import할 수 없어 공유하지
 * 못한다. `satisfies` + 아래 완전성 가드가 이쪽 사본의 드리프트를 빌드 실패로 드러낸다.)
 *
 * `chandelier`·`ewma`는 core의 정식 `SkillStateFeature` 게이팅 키(짧은 형태)이며
 * `chandelierExit` / `ewmaVolatility` 같은 IndicatorResult 필드명과 의도적으로 다르다.
 * `satisfies` 검사가 이 키를 강제하므로 필드명에 맞춰 바꾸지 않는다.
 */
const SKILL_STATE_FEATURES = [
    'bollinger',
    'keltner',
    'williamsR',
    'stochastic',
    'stochRsi',
    'donchian',
    'vwap',
    'buySellVolume',
    // 프로 지표 — core가 모두 'level' 종류로 평가한다.
    'macdV',
    'connorsRsi',
    'forceIndex',
    'elderRay',
    'elderImpulse',
    'chandelier',
    'hurst',
    'varianceRatio',
    'regression',
    'yangZhang',
    'ewma',
] as const satisfies readonly SkillStateFeature[];
const SKILL_STATE_PREDICATE_KINDS = [
    'pctB',
    'bandDistAtr',
    'level',
    'ratio',
    'channelProximity',
] as const satisfies readonly SkillStatePredicateKind[];

// 완전성 가드: core에 새 SkillStateFeature / SkillStatePredicateKind 멤버가 생기고 위 목록에
// 반영되지 않으면 아래 타입이 `never`가 아닌 유니온이 되어 tsc가 실패한다 — core 드리프트가
// 유효한 스킬의 게이팅을 조용히 버리는 대신 빌드 실패로 드러난다.
type MissingStateFeature = Exclude<
    SkillStateFeature,
    (typeof SKILL_STATE_FEATURES)[number]
>;
const _stateFeaturesAreExhaustive: MissingStateFeature extends never
    ? true
    : never = true;
void _stateFeaturesAreExhaustive;

type MissingPredicateKind = Exclude<
    SkillStatePredicateKind,
    (typeof SKILL_STATE_PREDICATE_KINDS)[number]
>;
const _predicateKindsAreExhaustive: MissingPredicateKind extends never
    ? true
    : never = true;
void _predicateKindsAreExhaustive;

/**
 * core의 `isStateNotable`이 실제로 평가하는 (feature, predicate) 쌍. 그 밖의 조합은 어떤
 * 차트에서도 `false`라 게이팅된 스킬에 도달할 수 없다. 각 절반만이 아니라 쌍을 여기서 검증해,
 * 도달 불가 조합을 CI 검증기에만 맡기지 않고 런타임 파서에서도 거른다.
 *
 * scripts/validate-skills.ts의 `VALID_STATE_PAIRS`와 같은 목록이다. core가 평가하는 쌍이
 * 바뀌면 두 곳을 함께 고친다. (src/는 런타임 파서, scripts/는 빌드 타임 검증기 — 공유 import 없음)
 */
const VALID_STATE_PAIRS: ReadonlySet<string> = new Set([
    'bollinger:pctB',
    'keltner:bandDistAtr',
    'williamsR:level',
    'stochastic:level',
    'stochRsi:level',
    'donchian:channelProximity',
    'vwap:bandDistAtr',
    'buySellVolume:ratio',
    // 프로 지표 — core의 isStateNotable이 각각 'level'로 평가한다.
    'macdV:level',
    'connorsRsi:level',
    'forceIndex:level',
    'elderRay:level',
    'elderImpulse:level',
    'chandelier:level',
    'hurst:level',
    'varianceRatio:level',
    'regression:level',
    'yangZhang:level',
    'ewma:level',
]);

/** state 술어를 파싱한다. 필수 필드가 하나라도 유효하지 않으면 undefined. */
const parseStatePredicate = (raw: unknown): SkillStatePredicate | undefined => {
    if (!isRecord(raw)) return undefined;

    const { feature, predicate, hi, lo } = raw;

    if (
        !isOneOf(SKILL_STATE_FEATURES, feature) ||
        !isOneOf(SKILL_STATE_PREDICATE_KINDS, predicate)
    ) {
        return undefined;
    }

    // 각 절반이 유효해도 도달 불가능한 쌍(예: bollinger + channelProximity)은 core가 절대
    // 발화시키지 않는 SkillGating이 된다. 태그 없는 스킬로 취급해 core 셀렉터가 throw
    // (fail-closed)하게 하고, 발화할 수 없는 게이팅 스킬을 들고 있지 않는다.
    if (!VALID_STATE_PAIRS.has(`${feature}:${predicate}`)) return undefined;

    return {
        feature,
        predicate,
        ...(typeof hi === 'number' ? { hi } : {}),
        ...(typeof lo === 'number' ? { lo } : {}),
    };
};

/**
 * `gating` frontmatter 블록을 core 로더와 같은 규칙으로 검증·정규화한다. 블록이 잘못됐거나
 * 도달 불가능하면 undefined(태그 없는 스킬)를 돌려준다. 이 파서는 throw하지 않지만 core의
 * `selectSkills`가 fail-closed라서, 화이트리스트에 오른 스킬의 gating이 undefined면 throw해
 * 잘못된 블록이 주입되는 대신 분석이 실패한다.
 *
 * 인라인 배열 YAML 파서로는 닿지 않는 분기(예: 문자열이 아닌 trigger 원소)를 단위 테스트하려고
 * export한다.
 */
export const parseGating = (raw: unknown): SkillGating | undefined => {
    if (!isRecord(raw)) return undefined;

    const tier = raw.tier;
    if (!isOneOf(SKILL_GATING_TIERS, tier)) return undefined;
    if (tier === 'always_on') return { tier: 'always_on' };

    const signalKind = raw.signal_kind;
    if (!isOneOf(SIGNAL_KINDS, signalKind)) return undefined;

    if (signalKind === 'event') {
        const triggers = raw.triggers;
        if (
            !Array.isArray(triggers) ||
            triggers.length === 0 ||
            !triggers.every((t): t is string => typeof t === 'string')
        ) {
            return undefined;
        }
        return { tier: 'gated', signalKind: 'event', triggers };
    }

    const state = parseStatePredicate(raw.state);
    if (state === undefined) return undefined;
    return { tier: 'gated', signalKind: 'state', state };
};
