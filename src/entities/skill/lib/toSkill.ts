import type {
    Skill,
    SkillCategory,
    SkillDisplay,
    SkillType,
    StrategyOverlayKind,
} from '@y0ngha/siglens-core';
import { STRATEGY_OVERLAY_KINDS } from '@y0ngha/siglens-core';
import { isRecord } from '@/shared/lib/isRecord';
import { isOneOf } from './guards';
import { parseGating } from './parseGating';
import { parseUsageRoles } from './parseUsageRoles';

const SKILL_CATEGORIES = [
    'reversal_bullish',
    'reversal_bearish',
    'continuation_bullish',
    'continuation_bearish',
    'neutral',
    'fundamental',
    'news',
] as const satisfies readonly SkillCategory[];

const SKILL_TYPES = [
    'pattern',
    'indicator_guide',
    'strategy',
    'candlestick',
    'support_resistance',
] as const satisfies readonly SkillType[];

const parseSkillDisplay = (raw: unknown): SkillDisplay | undefined => {
    if (!isRecord(raw)) return undefined;

    const chart = raw.chart;
    if (!isRecord(chart)) return undefined;
    if (
        typeof chart.show !== 'boolean' &&
        chart.show !== 'true' &&
        chart.show !== 'false'
    )
        return undefined;

    const show =
        typeof chart.show === 'boolean' ? chart.show : chart.show === 'true';
    const type = String(chart.type ?? '');
    const color = String(chart.color ?? '');
    const label = String(chart.label ?? '');

    if (type !== 'line' && type !== 'marker' && type !== 'region')
        return undefined;

    return {
        chart: { show, type, color, label },
    };
};

/**
 * `overlay_kind` frontmatter → `Skill.overlayKind` — 전략 카드가 그릴 수 있는 차트 오버레이
 * 종류 하나(core `resolveChartOverlays`가 나머지는 버린다). 알 수 없는 값은 `undefined`가 되어
 * 그 전략은 아무것도 그리지 않는다. 허용 목록은 core의 `STRATEGY_OVERLAY_KINDS`라서 새 종류가
 * 생겨도 여기는 바꿀 필요가 없다.
 *
 * siglens-core infrastructure/skills/loader의 `parseOverlayKind`와 같은 규칙이다.
 */
const parseOverlayKind = (raw: unknown): StrategyOverlayKind | undefined =>
    STRATEGY_OVERLAY_KINDS.find(kind => kind === raw);

/**
 * frontmatter 불리언을 읽는다. 일부 작성자가 올바른 `smc_full_guide: true` 대신 따옴표 문자열
 * `smc_full_guide: 'true'`를 쓰므로 두 형태를 모두 받는다.
 */
const isYamlTrue = (value: unknown): boolean =>
    value === true || value === 'true';

/** `indicators` 값에서 문자열 원소만 남긴다. 배열이 아니면 빈 배열. */
const toIndicators = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];

/**
 * 파싱된 frontmatter 데이터와 본문을 core `Skill`로 만든다. 키는 snake_case(`confidence_weight`,
 * `signal_kind`, `token_cost`, `smc_full_guide`)로 읽어 camelCase `Skill` 필드에 매핑한다.
 * `FileSkillsLoader`와 카탈로그 집계가 쓴다.
 */
export const toSkill = (
    data: Record<string, unknown>,
    content: string
): Skill => ({
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    type: isOneOf(SKILL_TYPES, data.type) ? data.type : undefined,
    category: isOneOf(SKILL_CATEGORIES, data.category)
        ? data.category
        : undefined,
    pattern: data.pattern != null ? String(data.pattern) : undefined,
    indicators: toIndicators(data.indicators),
    confidenceWeight:
        typeof data.confidence_weight === 'number' ? data.confidence_weight : 0,
    content,
    display: parseSkillDisplay(data.display),
    gating: parseGating(data.gating),
    // 빌드 타임 토크나이저 baking용으로 예약됨. 현재는 쓰이지 않는다(자리표시 0). skills/CLAUDE.md 참고.
    tokenCost:
        typeof data.token_cost === 'number' ? data.token_cost : undefined,
    smcFullGuide: isYamlTrue(data.smc_full_guide),
    usageRoles: parseUsageRoles(data.usage_roles),
    overlayKind: parseOverlayKind(data.overlay_kind),
});
