import { LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY } from '@/shared/lib/storageKeys';
import {
    EMPTY_MEMBER_NUDGE_RECORD,
    type MemberNudgeRecord,
} from './memberNudgePolicy';

type Store = Record<string, MemberNudgeRecord>;

function isRecord(value: unknown): value is MemberNudgeRecord {
    if (typeof value !== 'object' || value === null) return false;
    const r = value as Record<string, unknown>;
    return (
        typeof r.setupShown === 'boolean' &&
        typeof r.symbolCounts === 'object' &&
        r.symbolCounts !== null &&
        Array.isArray(r.symbolsNudged) &&
        (r.lastSymbolNudgeAt === null ||
            typeof r.lastSymbolNudgeAt === 'number')
    );
}

/** 깨진 JSON은 빈 저장소로 본다 — 다음 쓰기가 덮어써 스스로 복구된다. 접근 자체가 막히면 던진다. */
function readStore(): Store {
    const raw = localStorage.getItem(
        LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY
    );
    if (raw === null) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed)
            ? (parsed as Store)
            : {};
    } catch {
        return {};
    }
}

/**
 * 회원 id별 넛지 기록. 한 브라우저를 여러 회원이 쓰면 기록이 섞이지 않게 id로 나눈다.
 * 저장소가 막혀 있거나 값이 깨졌으면 빈 기록 — 소프트 넛지라 최악이어도 한 번 더 뜰 뿐이다.
 */
export function readMemberNudgeRecord(userId: string): MemberNudgeRecord {
    if (typeof window === 'undefined') return EMPTY_MEMBER_NUDGE_RECORD;
    try {
        const record = readStore()[userId];
        return isRecord(record) ? record : EMPTY_MEMBER_NUDGE_RECORD;
    } catch {
        return EMPTY_MEMBER_NUDGE_RECORD;
    }
}

export function writeMemberNudgeRecord(
    userId: string,
    record: MemberNudgeRecord
): void {
    if (typeof window === 'undefined') return;
    try {
        const store = readStore();
        localStorage.setItem(
            LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY,
            JSON.stringify({ ...store, [userId]: record })
        );
    } catch {
        // storage blocked or corrupted — 다음에 한 번 더 뜰 수 있을 뿐이다.
    }
}
