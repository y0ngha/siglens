import { SHAREABLE_KIND_VALUES, USER_TIER_VALUES } from '@/shared/db/constants';
import type { CreateShareInput } from '../types';

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}

/** 클라가 전달한 공유 입력의 형태를 검증한다(내용 신뢰 X, 형태만). */
export function isValidShareInput(raw: unknown): raw is CreateShareInput {
    if (typeof raw !== 'object' || raw === null) return false;
    const o = raw as Record<string, unknown>;
    if (
        !(SHAREABLE_KIND_VALUES as readonly string[]).includes(o.kind as string)
    )
        return false;
    if (!isNonEmptyString(o.symbol)) return false;
    if (typeof o.context !== 'object' || o.context === null) return false;
    const ctx = o.context as Record<string, unknown>;
    if (!isNonEmptyString(ctx.displayName) || !isNonEmptyString(ctx.assetClass))
        return false;
    if (typeof o.result !== 'object' || o.result === null) return false;
    if (
        !(USER_TIER_VALUES as readonly string[]).includes(
            o.sharerTier as string
        )
    )
        return false;
    return true;
}
