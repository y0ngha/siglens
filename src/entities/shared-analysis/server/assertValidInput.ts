import { SHAREABLE_KIND_VALUES, USER_TIER_VALUES } from '@/shared/db/constants';
import type { CreateShareInput } from '../types';
import { MAX_CHART_BARS } from '../types';

/**
 * `result` 필드의 UTF-8 바이트 길이 상한.
 * 64 KB는 가장 큰 정상 분석 응답보다 넉넉히 크면서, shared_analyses jsonb 컬럼을
 * 부풀리는 비정상 페이로드는 막는다.
 *
 * 한국어처럼 UTF-8에서 3바이트인 문자가 UTF-16 코드 유닛 1개로 세어지므로
 * `JSON.stringify(...).length`가 아니라 `Buffer.byteLength(..., 'utf8')`로 잰다.
 */
export const MAX_RESULT_BYTES = 65_536;

/**
 * `context.displayName`·`context.assetClass`의 길이 상한.
 * `result` 크기 검사가 닿지 않는 컨텍스트 문자열에 큰 페이로드를 숨겨
 * MAX_RESULT_BYTES를 우회하는 것을 막는다.
 */
export const MAX_DISPLAY_NAME_LENGTH = 128;

/**
 * 공유 스냅샷에 실리는 `plain` 산문의 UTF-8 바이트 길이 상한.
 *
 * 업스트림(`guardPlainText`)은 길이의 상한도 하한도 두지 않는다 — 상한은 분석
 * 타입마다 압축률이 37~105%로 제각각이라 고정값이 의미가 없고, 하한은 원본보기
 * 토글이 항상 옆에 있어 짧은 재작성이 내용을 숨기지 않으므로 없앴다. 따라서 이
 * 값이 파이프라인 전체에서 유일한 길이 방어선이다:
 * 정상적인 재작성을 걸러내지 않도록 관측된 압축률 범위보다 넉넉히 크게 잡아
 * jsonb 컬럼만 보호한다. 멀티바이트 이유는 MAX_RESULT_BYTES와 같아 바이트로 잰다.
 */
export const MAX_PLAIN_BYTES = 32_768;

const MAX_SYMBOL_LENGTH = 32;

const REQUIRED_BAR_NUMERIC_KEYS = ['time', 'open', 'high', 'low', 'close'];

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

function isFiniteNumber(v: unknown): boolean {
    return typeof v === 'number' && Number.isFinite(v);
}

/** 선택 문자열 필드: 없으면 통과, 있으면 문자열이고 길이 상한 이하여야 한다. */
function isOptionalBoundedString(v: unknown): boolean {
    if (v === undefined) return true;
    return typeof v === 'string' && v.length <= MAX_DISPLAY_NAME_LENGTH;
}

/**
 * OHLCV Bar 원소인지 확인한다. `time`·`open`·`high`·`low`·`close`는 유한한 숫자여야
 * 하고, `volume`은 Bar 타입에서 선택이지만 있으면 유한한 숫자여야 한다(`vwap`은 무시).
 */
function isValidBar(v: unknown): boolean {
    if (!isRecord(v)) return false;
    if (!REQUIRED_BAR_NUMERIC_KEYS.every(key => isFiniteNumber(v[key])))
        return false;
    return v.volume === undefined || isFiniteNumber(v.volume);
}

function isValidContext(ctx: unknown): boolean {
    if (!isRecord(ctx)) return false;
    return (
        isNonEmptyString(ctx.displayName) &&
        ctx.displayName.length <= MAX_DISPLAY_NAME_LENGTH &&
        isOptionalBoundedString(ctx.assetClass) &&
        isOptionalBoundedString(ctx.analyzedAt)
    );
}

/** chartBars는 chart kind에만 허용되고, 비어 있지 않으며 개수 상한 이하의 유효 Bar 배열이어야 한다. */
function isValidChartBars(kind: unknown, bars: unknown): boolean {
    if (kind !== 'chart') return false;
    if (!Array.isArray(bars)) return false;
    if (bars.length === 0 || bars.length > MAX_CHART_BARS) return false;
    return bars.every(isValidBar);
}

/**
 * 공백만 있는 값도 거부한다. 클라이언트가 이미 trim으로 거르지만 신뢰 경계는
 * 여기다 — 통과하면 뷰어에 빈 쉽게보기 화면이 뜬다. 내용은 파싱하지 않고 텍스트로만 렌더된다.
 */
function isValidPlain(plain: unknown): boolean {
    if (!isNonEmptyString(plain) || plain.trim().length === 0) return false;
    return Buffer.byteLength(plain, 'utf8') <= MAX_PLAIN_BYTES;
}

/**
 * 클라가 전달한 공유 입력의 형태를 검증한다(내용 신뢰 X, 형태만).
 * `createShareSnapshotAction`의 첫 관문이다.
 */
export function isValidShareInput(raw: unknown): raw is CreateShareInput {
    if (!isRecord(raw)) return false;
    if (
        typeof raw.kind !== 'string' ||
        // readonly 튜플을 string[]으로 넓혀야 임의 string을 includes에 넘길 수 있다
        !(SHAREABLE_KIND_VALUES as readonly string[]).includes(raw.kind)
    )
        return false;
    if (!isNonEmptyString(raw.symbol) || raw.symbol.length > MAX_SYMBOL_LENGTH)
        return false;
    if (!isValidContext(raw.context)) return false;
    if (!isRecord(raw.result)) return false;
    if (
        Buffer.byteLength(JSON.stringify(raw.result), 'utf8') > MAX_RESULT_BYTES
    )
        return false;
    if (
        typeof raw.sharerTier !== 'string' ||
        !(USER_TIER_VALUES as readonly string[]).includes(raw.sharerTier)
    )
        return false;
    if (
        raw.chartBars !== undefined &&
        !isValidChartBars(raw.kind, raw.chartBars)
    )
        return false;
    return raw.plain === undefined || isValidPlain(raw.plain);
}
