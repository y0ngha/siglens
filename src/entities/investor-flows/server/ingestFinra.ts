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
    /**
     * 테이블이 비어 있던 상태에서 **처음** 파일이 저장됐을 때 한 번 부른다 — 수급 탭의 "공매도 수집 중" 안내를 담은 준비 상태
     * 캐시를 무효화한다. 생략하면 캐시 TTL(12시간)이 지나서야 안내가 사라진다.
     */
    onFirstDataStored?: () => void | Promise<void>;
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
    /** 이번 실행이 비어 있던 저장소에 처음으로 파일을 저장했는가(= 준비 상태가 `collecting` → `ready`로 바뀌었을 수 있다). */
    firstDataStored: boolean;
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
    firstDataStored: false,
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
    // 결과는 로컬에 모았다가 마지막에 한 번 만든다(함수 중간에 결과 객체를 바꾸지 않는다).
    let status: IngestFinraResult['status'] = 'ok';
    let volumeFiles = 0;
    let volumeRows = 0;
    let interestFiles = 0;
    let interestRows = 0;
    const today = toUtcIsoDate(deps.now());
    const changedSymbols = new Set<string>();

    // ── 일별 공매도 거래량 ──
    const latestVolume = await deps.repo.latestShortVolumeDate();
    let interestWasEmpty = false;
    const volumeDates = shortVolumeCandidateDates(
        latestVolume ?? addDays(today, -SHORT_VOLUME_BACKFILL_DAYS - 1),
        today
    ).slice(0, MAX_SHORT_VOLUME_FILES_PER_RUN);
    for (const date of volumeDates) {
        if (deps.isDeadlineReached()) {
            status = 'deadline';
            break;
        }
        // 파일은 하나씩 받아 메모리·CDN 부담을 묶는다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const text = await deps.finra.fetchCnmsShortVolumeText(date);
        if (text === null) continue; // 휴장일이거나 아직 미공개
        const rows = parseCnmsShortVolume(text, resolver);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await deps.repo.upsertShortVolume(rows);
        volumeFiles += 1;
        volumeRows += rows.length;
        for (const row of rows) changedSymbols.add(row.symbol);
    }

    // ── 공매도 잔고(결제일별) ──
    if (status === 'ok') {
        const have = await deps.repo.listShortInterestSettlementDates(
            addDays(today, -SHORT_INTEREST_BACKFILL_LOOKBACK_DAYS)
        );
        interestWasEmpty = have.size === 0;
        const lookback =
            have.size === 0
                ? SHORT_INTEREST_BACKFILL_LOOKBACK_DAYS
                : SHORT_INTEREST_LOOKBACK_DAYS;
        const groups = shortInterestCandidateGroups(today, lookback).filter(
            group => !group.some(variant => have.has(variant))
        );
        for (const group of groups.slice(0, MAX_SHORT_INTEREST_FILES_PER_RUN)) {
            if (deps.isDeadlineReached()) {
                status = 'deadline';
                break;
            }
            for (const variant of group) {
                // 그룹은 변형이 최대 5개라 파일당 최악(재시도 포함)이 곱해진다 — 마감이 지나면 남은 변형은 시작하지 않는다
                // (락 TTL = 마감 + 파일 하나의 최악, `finra-short/route.ts`·`route.test.ts`).
                if (deps.isDeadlineReached()) {
                    status = 'deadline';
                    break;
                }
                // 공휴일로 결제일이 앞당겨졌을 수 있어 변형을 순서대로 본다.
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                const text = await deps.finra.fetchShortInterestText(variant);
                if (text === null) continue;
                const rows = parseShortInterest(text, resolver);
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                await deps.repo.upsertShortInterest(rows);
                interestFiles += 1;
                interestRows += rows.length;
                for (const row of rows) changedSymbols.add(row.symbol);
                break;
            }
        }
    }

    const toInvalidate = [...changedSymbols]
        .sort()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
    if (toInvalidate.length > 0) await deps.invalidateSymbols(toInvalidate);
    // 잔고가 비어 있었는지는 잔고 단계에서만 알 수 있다(마감으로 건너뛰면 모른다 — 그땐 거래량 쪽만 본다).
    const firstDataStored =
        (volumeFiles > 0 && latestVolume === null) ||
        (interestFiles > 0 && interestWasEmpty);
    if (firstDataStored) await deps.onFirstDataStored?.();

    const pruned = {
        shortVolume: await deps.repo.pruneShortVolumeBefore(
            addDays(today, -INVESTOR_FLOWS_SHORT_VOLUME_RETENTION_DAYS)
        ),
        shortInterest: await deps.repo.pruneShortInterestBefore(
            addDays(today, -INVESTOR_FLOWS_SHORT_INTEREST_RETENTION_DAYS)
        ),
    };
    return {
        status,
        volumeFiles,
        volumeRows,
        interestFiles,
        interestRows,
        invalidated: toInvalidate.length,
        pruned,
        firstDataStored,
    };
}
