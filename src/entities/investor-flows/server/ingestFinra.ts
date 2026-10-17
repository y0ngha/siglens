import { toUtcIsoDate } from '@/shared/lib/isoDate';
import {
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_STATE_FINRA_REBACKFILL,
    INVESTOR_FLOWS_SHORT_INTEREST_RETENTION_DAYS,
    INVESTOR_FLOWS_SHORT_VOLUME_RETENTION_DAYS,
} from '../lib/investorFlowsPolicy';
import { parseCnmsShortVolume, parseShortInterest } from '../lib/finraParsers';
import { buildSymbolAliasResolver } from '../lib/symbolAliasResolver';
import {
    shortInterestCandidateGroups,
    shortVolumeCandidateDates,
} from '../lib/finraSchedule';
import { addDays } from '../lib/investorFlowsDates';
import {
    type FinraRebackfillProgress,
    parseFinraRebackfillProgress,
    rebackfillDates,
    serializeFinraRebackfillProgress,
} from '../lib/finraRebackfill';
import type { ShortInterestRow, ShortVolumeRow } from '../model';

/** 일별 거래량을 채워 두는 창(일) — 60일 z-score 창에 쓸 거래량. 창 안에서 빠진 평일을 받는다. */
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
        /** `since`(포함) 이후 저장된 일별 거래량 거래일 집합. */
        listShortVolumeTradeDates(since: string): Promise<Set<string>>;
        listShortInterestSettlementDates(since: string): Promise<Set<string>>;
        upsertShortVolume(rows: readonly ShortVolumeRow[]): Promise<void>;
        upsertShortInterest(rows: readonly ShortInterestRow[]): Promise<void>;
        pruneShortVolumeBefore(cutoffDate: string): Promise<number>;
        pruneShortInterestBefore(cutoffDate: string): Promise<number>;
    };
    /** `investor_flows_state` — 1회 재수집 요청(`INVESTOR_FLOWS_STATE_FINRA_REBACKFILL`)과 그 진행 커서. */
    state: {
        getState(key: string): Promise<string | null>;
        setState(key: string, value: string): Promise<void>;
        deleteState(key: string): Promise<void>;
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
    /**
     * 1회 재수집을 끝내 요청을 지웠을 때 한 번 부른다 — 공매도 준비 상태가 `collecting` → `ready`로 바뀌므로(요청이 있는 동안은
     * 빈 종목에 "수집 중"을 낸다) 준비 상태 캐시를 무효화한다.
     */
    onRebackfillCompleted?: () => void | Promise<void>;
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
    /**
     * 1회 재수집(`INVESTOR_FLOWS_STATE_FINRA_REBACKFILL`) — 요청이 없으면 `none`, 남았으면 `in_progress`, 이번 실행에 끝내 요청을
     * 지웠으면 `completed`. 파일 수는 이번 실행이 **다시** 읽은 것이다(위 `volumeFiles`·`interestFiles`와 따로 센다).
     */
    rebackfill: {
        status: 'none' | 'in_progress' | 'completed';
        volumeFiles: number;
        interestFiles: number;
    };
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
    rebackfill: { status: 'none', volumeFiles: 0, interestFiles: 0 },
});

/**
 * FINRA 일별 공매도 거래량(CNMS) + 공매도 잔고(biweekly) 수집. 둘 다 유니버스 심볼로 걸러 저장한다.
 *
 * ⚠️ 비상업 라이선스 — `deps.isEnabled()`가 false면 **아무 요청도 보내지 않고** 끝낸다
 * (`shared/api/finra/finraShortDataEnabled.ts`, 라이선스 이슈 #1042). 재수집 요청도 그대로 남아 켜진 뒤에 돈다.
 *
 * **1회 재수집**: cusip-map이 전수 한 바퀴를 처음 끝내면 `INVESTOR_FLOWS_STATE_FINRA_REBACKFILL`을 남긴다. 그 요청이 있으면 빠진
 * 날을 받은 뒤 **남은 실행당 상한** 안에서 이미 저장된 파일(거래량 창 전체, 잔고 1년치)을 최근 것부터 다시 읽어 지금의 전체
 * 유니버스로 upsert한다(멱등). 진행은 요청 값에 커서로 남겨 여러 실행에 걸쳐 잇고, 둘 다 끝나면 요청을 지운다. 상한을 나눠 쓰므로
 * 실행 하나의 최악 시간은 그대로다(`finra-short/route.ts`).
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
    const resolver = buildSymbolAliasResolver(universeSymbols);
    // 결과는 로컬에 모았다가 마지막에 한 번 만든다(함수 중간에 결과 객체를 바꾸지 않는다).
    let status: IngestFinraResult['status'] = 'ok';
    let volumeFiles = 0;
    let volumeRows = 0;
    let interestFiles = 0;
    let interestRows = 0;
    const today = toUtcIsoDate(deps.now());
    const changedSymbols = new Set<string>();

    // ── 일별 공매도 거래량 ──
    // 창 안의 평일 중 저장되지 않은 날을 **최근 날부터** 받는다 — 첫 백필(≈63일 > 실행당 상한)의 첫 실행에 최신 거래량이 들어오고,
    // 마지막 저장일 커서가 아니라 저장된 날짜 집합으로 고르므로 상한·마감에 걸려 남은 옛날 날은 다음 실행이 채운다(멱등 — upsert).
    // 대가: 휴장일(파일 없음)과 유니버스 행이 하나도 없는 파일은 저장되지 않아 창을 벗어날 때까지 매 실행 다시 묻는다(창 90일에
    // 휴장일 2~4일, 없는 파일 응답은 작다).
    const volumeWindowStart = addDays(today, -SHORT_VOLUME_BACKFILL_DAYS - 1);
    const haveVolume = await deps.repo.listShortVolumeTradeDates(
        addDays(volumeWindowStart, 1)
    );
    let interestWasEmpty = false;
    const volumeDates = shortVolumeCandidateDates(volumeWindowStart, today)
        .filter(date => !haveVolume.has(date))
        .toReversed()
        .slice(0, MAX_SHORT_VOLUME_FILES_PER_RUN);
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

    // ── 1회 재수집: 일별 거래량 ── 빠진 날을 받고 남은 상한으로, 이미 저장된 날을 최근 것부터 다시 읽는다.
    const rebackfillValue = await deps.state.getState(
        INVESTOR_FLOWS_STATE_FINRA_REBACKFILL
    );
    const rebackfill =
        rebackfillValue === null
            ? null
            : parseFinraRebackfillProgress(rebackfillValue);
    let volumeBefore = rebackfill?.volumeBefore ?? null;
    let interestBefore = rebackfill?.interestBefore ?? null;
    let volumeRebackfillDone = false;
    let interestRebackfillDone = false;
    let rebackfillVolumeFiles = 0;
    let rebackfillInterestFiles = 0;
    if (rebackfill !== null && status === 'ok') {
        const pending = rebackfillDates(haveVolume, volumeBefore);
        const batch = pending.slice(
            0,
            Math.max(0, MAX_SHORT_VOLUME_FILES_PER_RUN - volumeDates.length)
        );
        for (const date of batch) {
            if (deps.isDeadlineReached()) {
                status = 'deadline';
                break;
            }
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const text = await deps.finra.fetchCnmsShortVolumeText(date);
            if (text !== null) {
                const rows = parseCnmsShortVolume(text, resolver);
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                await deps.repo.upsertShortVolume(rows);
                rebackfillVolumeFiles += 1;
                for (const row of rows) changedSymbols.add(row.symbol);
            }
            volumeBefore = date;
        }
        volumeRebackfillDone =
            status === 'ok' && batch.length === pending.length;
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
        // 최근 결제일부터 — 첫 백필(1년 ≈24개 > 실행당 8개)의 첫 실행에 최신 잔고가 들어온다. 저장된 결제일 집합으로 고르므로 남은
        // 옛 결제일은 다음 실행이 채운다.
        const groups = shortInterestCandidateGroups(today, lookback)
            .filter(group => !group.some(variant => have.has(variant)))
            .toReversed();
        const interestGroups = groups.slice(
            0,
            MAX_SHORT_INTEREST_FILES_PER_RUN
        );
        for (const group of interestGroups) {
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

        // ── 1회 재수집: 공매도 잔고 ── 저장된 결제일(1년 창)을 그 날짜 그대로 다시 받는다(변형을 다시 찾을 필요가 없다).
        if (rebackfill !== null && status === 'ok') {
            const pending = rebackfillDates(have, interestBefore);
            const batch = pending.slice(
                0,
                Math.max(
                    0,
                    MAX_SHORT_INTEREST_FILES_PER_RUN - interestGroups.length
                )
            );
            for (const date of batch) {
                if (deps.isDeadlineReached()) {
                    status = 'deadline';
                    break;
                }
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                const text = await deps.finra.fetchShortInterestText(date);
                if (text !== null) {
                    const rows = parseShortInterest(text, resolver);
                    // react-doctor-disable-next-line react-doctor/async-await-in-loop
                    await deps.repo.upsertShortInterest(rows);
                    rebackfillInterestFiles += 1;
                    for (const row of rows) changedSymbols.add(row.symbol);
                }
                interestBefore = date;
            }
            interestRebackfillDone =
                status === 'ok' && batch.length === pending.length;
        }
    }

    const rebackfillStatus = await settleRebackfill(deps, rebackfill, {
        volumeBefore,
        interestBefore,
        done: volumeRebackfillDone && interestRebackfillDone,
    });

    const toInvalidate = [...changedSymbols]
        .sort()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
    if (toInvalidate.length > 0) await deps.invalidateSymbols(toInvalidate);
    // 잔고가 비어 있었는지는 잔고 단계에서만 알 수 있다(마감으로 건너뛰면 모른다 — 그땐 거래량 쪽만 본다). 거래량은 창(90일) 안이
    // 비어 있었는지로 본다 — 90일 넘게 멈췄다 돌아오면 보존(120일) 행이 남아 있어도 참이 되지만, 그때 부르는 훅은 준비 상태 캐시
    // 무효화뿐이라 해가 없다.
    const firstDataStored =
        (volumeFiles > 0 && haveVolume.size === 0) ||
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
        rebackfill: {
            status: rebackfillStatus,
            volumeFiles: rebackfillVolumeFiles,
            interestFiles: rebackfillInterestFiles,
        },
    };
}

/** 재수집 요청을 끝났으면 지우고, 남았으면 커서를 남긴다. 요청이 없었으면 아무것도 하지 않는다. */
async function settleRebackfill(
    deps: IngestFinraDeps,
    progress: FinraRebackfillProgress | null,
    next: {
        volumeBefore: string | null;
        interestBefore: string | null;
        done: boolean;
    }
): Promise<IngestFinraResult['rebackfill']['status']> {
    if (progress === null) return 'none';
    if (next.done) {
        await deps.state.deleteState(INVESTOR_FLOWS_STATE_FINRA_REBACKFILL);
        await deps.onRebackfillCompleted?.();
        deps.log(
            '[finra-short] FINRA re-ingest for the full universe complete — request cleared'
        );
        return 'completed';
    }
    await deps.state.setState(
        INVESTOR_FLOWS_STATE_FINRA_REBACKFILL,
        serializeFinraRebackfillProgress({
            requestedAt: progress.requestedAt,
            volumeBefore: next.volumeBefore,
            interestBefore: next.interestBefore,
        })
    );
    return 'in_progress';
}
