import { LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY } from '@/shared/lib/storageKeys';
import {
    EMPTY_MEMBER_NUDGE_RECORD,
    type MemberNudgeRecord,
} from './memberNudgePolicy';

/**
 * 저장된 값 그대로의 모양 — 회원 id → 아직 검증하지 않은 기록. 원소는 읽을 때
 * {@link isMemberNudgeRecord}로 좁힌다(사용자가 손댈 수 있는 저장소라 믿지 않는다).
 */
type RawStore = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 기록 하나를 필드 단위로 검증한다. 카운트가 문자열이면 `"2" + 1 = "21"`처럼 판정이
 * 어긋나므로 중첩 값의 타입까지 본다.
 */
function isMemberNudgeRecord(value: unknown): value is MemberNudgeRecord {
    if (!isPlainObject(value)) return false;
    const { setupShown, symbolCounts, symbolsNudged, lastSymbolNudgeAt } =
        value;
    return (
        typeof setupShown === 'boolean' &&
        isPlainObject(symbolCounts) &&
        Object.values(symbolCounts).every(
            count => typeof count === 'number' && Number.isFinite(count)
        ) &&
        Array.isArray(symbolsNudged) &&
        symbolsNudged.every(symbol => typeof symbol === 'string') &&
        (lastSymbolNudgeAt === null ||
            (typeof lastSymbolNudgeAt === 'number' &&
                Number.isFinite(lastSymbolNudgeAt)))
    );
}

/** 깨진 JSON은 빈 저장소로 본다 — 다음 쓰기가 덮어써 스스로 복구된다. 접근 자체가 막히면 던진다. */
function readStore(): RawStore {
    const raw = localStorage.getItem(
        LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY
    );
    if (raw === null) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        return isPlainObject(parsed) ? parsed : {};
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
        return isMemberNudgeRecord(record) ? record : EMPTY_MEMBER_NUDGE_RECORD;
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
