import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { LOCAL_STORAGE_FUNNEL_METER_SHOWN_KEY } from '@/shared/lib/storageKeys';
import type { MeterState } from './funnelEvents';

interface MeterShownRecord {
    date: string;
    keys: string[];
}

/** 저장소가 막힌 브라우저용 — 페이지 수명 동안만 중복을 막는다. */
const memoryFallback = { date: '', keys: new Set<string>() };

function isRecord(value: unknown): value is MeterShownRecord {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Partial<MeterShownRecord>;
    return (
        typeof record.date === 'string' &&
        Array.isArray(record.keys) &&
        record.keys.every(key => typeof key === 'string')
    );
}

function claimInMemory(date: string, key: string): boolean {
    if (memoryFallback.date !== date) {
        memoryFallback.date = date;
        memoryFallback.keys.clear();
    }
    if (memoryFallback.keys.has(key)) return false;
    memoryFallback.keys.add(key);
    return true;
}

/**
 * 이 (종목, 상태)의 `meter_shown`을 오늘(KST) 처음 보내는가. 처음이면 기록하고 `true`.
 *
 * 하루 무료 공개 미터가 KST 날짜로 끊기므로 중복 억제도 같은 날짜 경계를 쓴다. 저장소가
 * 막혀 있으면 페이지 수명 메모리로 물러난다 — 던지지 않는다.
 */
export function claimMeterShown(
    symbol: string,
    state: MeterState,
    now: Date = new Date()
): boolean {
    const date = kstDateKey(now);
    const key = `${symbol.toUpperCase()}:${state}`;
    try {
        const raw = window.localStorage.getItem(
            LOCAL_STORAGE_FUNNEL_METER_SHOWN_KEY
        );
        const parsed: unknown = raw === null ? null : JSON.parse(raw);
        const keys =
            isRecord(parsed) && parsed.date === date ? parsed.keys : [];
        if (keys.includes(key)) return false;
        window.localStorage.setItem(
            LOCAL_STORAGE_FUNNEL_METER_SHOWN_KEY,
            JSON.stringify({ date, keys: [...keys, key] })
        );
        return true;
    } catch {
        return claimInMemory(date, key);
    }
}
