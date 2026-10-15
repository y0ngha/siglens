import { toUtcIsoDate } from '@/shared/lib/isoDate';
import {
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_SHORT_INTEREST_RETENTION_DAYS,
    INVESTOR_FLOWS_SHORT_VOLUME_RETENTION_DAYS,
} from '../lib/investorFlowsPolicy';
import {
    buildFinraSymbolResolver,
    parseCnmsShortVolume,
    parseShortInterest,
} from '../lib/finraParsers';
import {
    shortInterestCandidateGroups,
    shortVolumeCandidateDates,
} from '../lib/finraSchedule';
import { addDays } from '../lib/investorFlowsDates';
import type { ShortInterestRow, ShortVolumeRow } from '../model';

/** 첫 실행(테이블이 비었을 때)에 거슬러 올라가는 일수 — 60일 z-score 창에 쓸 거래량을 채운다. */
export const SHORT_VOLUME_BACKFILL_DAYS = 90;
/** 한 실행이 받는 일별 거래량 파일 상한(파일당 ~0.5MB). 나머지는 다음 실행이 이어 간다. */
export const MAX_SHORT_VOLUME_FILES_PER_RUN = 45;
/** 공매도 잔고: 평소엔 최근 75일, 비어 있으면 FINRA가 공개하는 1년치를 본다. */
export const SHORT_INTEREST_LOOKBACK_DAYS = 75;
export const SHORT_INTEREST_BACKFILL_LOOKBACK_DAYS = 365;
/** 한 실행이 받는 잔고 파일 상한(파일당 ~2.7MB). */
export const MAX_SHORT_INTEREST_FILES_PER_RUN = 8;

export interface IngestFinraDeps {
    /** `FINRA_SHORT_DATA_ENABLED` — 꺼지면 HTTP·DB 쓰기 없이 즉시 끝난다. */
    isEnabled: () => boolean;
    loadUniverseSymbols: () => Promise<string[]>;
    finra: {
        fetchCnmsShortVolumeText(tradeDate: string): Promise<string | null>;
        fetchShortInterestText(settlementDate: string): Promise<string | null>;
    };
    repo: {
        latestShortVolumeDate(): Promise<string | null>;
        listShortInterestSettlementDates(since: string): Promise<Set<string>>;
        upsertShortVolume(rows: readonly ShortVolumeRow[]): Promise<void>;
        upsertShortInterest(rows: readonly ShortInterestRow[]): Promise<void>;
        pruneShortVolumeBefore(cutoffDate: string): Promise<number>;
        pruneShortInterestBefore(cutoffDate: string): Promise<number>;
    };
    now: () => Date;
    isDeadlineReached: () => boolean;
    /** 새로 들어온 공매도 데이터의 심볼 캐시 태그 무효화(실행당 상한). */
    invalidateSymbols: (symbols: readonly string[]) => void | Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

export interface IngestFinraResult {
    status: 'disabled' | 'empty_universe' | 'ok' | 'deadline';
    volumeFiles: number;
    volumeRows: number;
    interestFiles: number;
    interestRows: number;
    invalidated: number;
    pruned: { shortVolume: number; shortInterest: number };
}

const emptyResult = (
    status: IngestFinraResult['status']
): IngestFinraResult => ({
    status,
    volumeFiles: 0,
    volumeRows: 0,
    interestFiles: 0,
    interestRows: 0,
    invalidated: 0,
    pruned: { shortVolume: 0, shortInterest: 0 },
});

/**
 * FINRA 일별 공매도 거래량(CNMS) + 공매도 잔고(biweekly) 수집. 둘 다 유니버스 심볼로 걸러 저장한다.
 *
 * ⚠️ 비상업 라이선스 — `deps.isEnabled()`가 false면 **아무 요청도 보내지 않고** 끝낸다
 * (`shared/api/finra/finraShortDataEnabled.ts`, 라이선스 이슈 #1042).
 */
export async function runFinraIngest(
    deps: IngestFinraDeps
): Promise<IngestFinraResult> {
    if (!deps.isEnabled()) return emptyResult('disabled');

    const universeSymbols = await deps.loadUniverseSymbols();
    if (universeSymbols.length === 0) {
        deps.log('[finra-short] empty universe — run cusip-map first');
        return emptyResult('empty_universe');
    }
    const resolver = buildFinraSymbolResolver(universeSymbols);
    const result = emptyResult('ok');
    const today = toUtcIsoDate(deps.now());
    const changedSymbols = new Set<string>();

    // ── 일별 공매도 거래량 ──
    const latestVolume = await deps.repo.latestShortVolumeDate();
    const volumeDates = shortVolumeCandidateDates(
        latestVolume ?? addDays(today, -SHORT_VOLUME_BACKFILL_DAYS - 1),
        today
    ).slice(0, MAX_SHORT_VOLUME_FILES_PER_RUN);
    for (const date of volumeDates) {
        if (deps.isDeadlineReached()) {
            result.status = 'deadline';
            break;
        }
        // 파일은 하나씩 받아 메모리·CDN 부담을 묶는다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const text = await deps.finra.fetchCnmsShortVolumeText(date);
        if (text === null) continue; // 휴장일이거나 아직 미공개
        const rows = parseCnmsShortVolume(text, resolver);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await deps.repo.upsertShortVolume(rows);
        result.volumeFiles += 1;
        result.volumeRows += rows.length;
        for (const row of rows) changedSymbols.add(row.symbol);
    }

    // ── 공매도 잔고(결제일별) ──
    if (result.status === 'ok') {
        const have = await deps.repo.listShortInterestSettlementDates(
            addDays(today, -SHORT_INTEREST_BACKFILL_LOOKBACK_DAYS)
        );
        const lookback =
            have.size === 0
                ? SHORT_INTEREST_BACKFILL_LOOKBACK_DAYS
                : SHORT_INTEREST_LOOKBACK_DAYS;
        const groups = shortInterestCandidateGroups(today, lookback).filter(
            group => !group.some(variant => have.has(variant))
        );
        for (const group of groups.slice(0, MAX_SHORT_INTEREST_FILES_PER_RUN)) {
            if (deps.isDeadlineReached()) {
                result.status = 'deadline';
                break;
            }
            for (const variant of group) {
                // 공휴일로 결제일이 앞당겨졌을 수 있어 변형을 순서대로 본다.
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                const text = await deps.finra.fetchShortInterestText(variant);
                if (text === null) continue;
                const rows = parseShortInterest(text, resolver);
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                await deps.repo.upsertShortInterest(rows);
                result.interestFiles += 1;
                result.interestRows += rows.length;
                for (const row of rows) changedSymbols.add(row.symbol);
                break;
            }
        }
    }

    const toInvalidate = [...changedSymbols]
        .sort()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
    if (toInvalidate.length > 0) {
        await deps.invalidateSymbols(toInvalidate);
        result.invalidated = toInvalidate.length;
    }

    result.pruned = {
        shortVolume: await deps.repo.pruneShortVolumeBefore(
            addDays(today, -INVESTOR_FLOWS_SHORT_VOLUME_RETENTION_DAYS)
        ),
        shortInterest: await deps.repo.pruneShortInterestBefore(
            addDays(today, -INVESTOR_FLOWS_SHORT_INTEREST_RETENTION_DAYS)
        ),
    };
    return result;
}
