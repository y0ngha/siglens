import { toFmpSearchSymbol } from '@/shared/lib/fmpSymbol';
import { normalizeCompanyName } from './normalizeCompanyName';

/**
 * 후보가 이 수를 **넘으면 그 회차를 통째로 건너뛴다**(앞의 N개만 처리하는 상한이 아니다).
 *
 * 실제 사명 변경·티커 재할당은 하루 한 자릿수~수십 건이다. 수백 건이 한꺼번에 "바뀐 것"으로
 * 잡히면 FMP 표기 체계가 바뀌었거나 정규화에 결함이 있다는 뜻이라, 그 상태로 재번역(Gemini
 * 호출·DB 쓰기·ISR 무효화)을 돌리면 멀쩡한 한글명이 대량으로 갈아엎힌다. KR cron의 소실 상한
 * 가드(`KR_RECONCILE_DELIST_ABORT_THRESHOLD`)와 같은 철학이다 — 걸리면 하루 미뤄질 뿐이다.
 */
export const RENAME_GUARD_MAX = 300;

/**
 * 정상일 때도 하루에 처리하는 최대 개수. 나머지는 다음 날 이어서 처리된다 — 처리된
 * 심볼은 저장 이름이 FMP와 같아져 후보에서 빠지므로 재대조가 멱등이다.
 *
 * 시간 예산(SERVER.md#CC-7, 각 단계 최악의 합): 이 상한이 한 회차의 번역 호출 크기를 정한다 —
 * 번역은 **최대 이 개수를 담은 Gemini 호출 1회**이고, DB 쓰기는 심볼당 최대 2 upsert를
 * 순차로 한다. 같은 회차에서 앞단 KR 동기화(data.go.kr 페이지네이션)와 stock-list 수신
 * (`fmpGet` 시도당 10초 × 최대 4회 + 백오프 예산 60초 ≈ 최악 100초)가 먼저 돈다.
 * 202 + `after()`라 요청 타임아웃에 걸리지 않지만 SIGTERM drain이 이 합만큼 기다릴 수 있다.
 */
export const RENAME_BATCH_MAX = 60;

/** FMP `stock-list` 한 행(필요한 필드만). */
export interface StockListEntry {
    symbol: string;
    companyName: string;
}

/** 저장소(두 테이블 중 하나)에 저장된 심볼과 영문명. */
export interface StoredNameRow {
    symbol: string;
    name: string;
    /**
     * stock-list에서 이 행을 찾을 FMP 표기. 없으면 `toFmpSearchSymbol(symbol)`로 정한다
     * (dual-class `HEI.A` → `HEI-A`). `asset_translations` 행은 자신이 저장한 `fmpSymbol`을
     * 넘긴다.
     */
    fmpKey?: string;
}

export interface RenameCandidate {
    symbol: string;
    oldName: string;
    newName: string;
}

export interface TickerNameReconcileInput {
    listed: readonly StockListEntry[];
    /** `korean_tickers`의 국내 외 행. */
    koreanTickerRows: readonly StoredNameRow[];
    /** `asset_translations` 행. */
    assetTranslationRows: readonly StoredNameRow[];
    /** 사람이 고른 이름이라 자동으로 고치지 않는 심볼. */
    canonicalSymbols: ReadonlySet<string>;
    isKrEquitySymbol: (symbol: string) => boolean;
}

export interface TickerNameReconcilePlan {
    /** 이번 회차에 처리할 후보(정본 제외, 최대 `RENAME_BATCH_MAX`, 심볼순). 가드가 걸리면 빈 배열. */
    candidates: readonly RenameCandidate[];
    /** 사람이 검토할 정본 심볼의 변경 — 로그만 남기고 쓰지 않는다. 가드가 걸리면 빈 배열. */
    canonicalRenamed: readonly RenameCandidate[];
    /** 상한 때문에 다음 날로 넘긴 후보 수. */
    deferred: number;
    /** stock-list에 있어 실제로 비교한 서로 다른 심볼 수. */
    compared: number;
    /** 가드가 걸린 사유(후보 수 포함). 정상이면 `null`. */
    guardTrip: string | null;
    /** 가드가 걸렸을 때 사람이 볼 앞쪽 샘플. 정상이면 빈 배열. */
    guardSample: readonly RenameCandidate[];
}

/** 로케일에 흔들리지 않는 심볼순 — 이월 순서가 실행 환경과 무관하게 같아야 한다. */
function compareBySymbol(a: RenameCandidate, b: RenameCandidate): number {
    return a.symbol.localeCompare(b.symbol, 'en');
}

/** 가드 로그에 담을 샘플 수. */
export const GUARD_SAMPLE_SIZE = 10;

/**
 * 저장된 이름과 FMP `stock-list`를 대조해 이름이 바뀐 심볼을 계산한다. 순수 함수 —
 * DB·네트워크를 건드리지 않는다.
 *
 * - 국내 심볼은 제외한다(KRX cron이 정본).
 * - stock-list에 없는 심볼(상폐·지수·크립토)은 건너뛴다.
 * - 같은 심볼이 두 테이블에 모두 있으면 하나의 후보로 합친다. 어느 한쪽이라도 달라야
 *   후보이며, `oldName`은 먼저 어긋난 쪽(`korean_tickers` 우선)의 값이다.
 * - 정규화 결과가 다를 때만 "변경"이다(`normalizeCompanyName`).
 */
export function planTickerNameReconcile(
    input: TickerNameReconcileInput
): TickerNameReconcilePlan {
    const listedByFmpSymbol = new Map(
        input.listed.map(entry => [entry.symbol, entry.companyName])
    );

    // stock-list에 있는 국내 외 행만 비교 대상이다.
    const looked = [
        ...input.koreanTickerRows,
        ...input.assetTranslationRows,
    ].flatMap(row => {
        if (input.isKrEquitySymbol(row.symbol)) return [];
        const newName = listedByFmpSymbol.get(
            row.fmpKey ?? toFmpSearchSymbol(row.symbol)
        );
        return newName === undefined ? [] : [{ row, newName }];
    });
    const compared = new Set(looked.map(({ row }) => row.symbol));

    // 같은 심볼이 두 테이블에 있으면 먼저 어긋난 쪽(`korean_tickers` 우선)만 남긴다.
    const changedBySymbol = looked
        .filter(
            ({ row, newName }) =>
                normalizeCompanyName(row.name) !== normalizeCompanyName(newName)
        )
        .reduce(
            (acc, { row, newName }) =>
                acc.has(row.symbol)
                    ? acc
                    : acc.set(row.symbol, {
                          symbol: row.symbol,
                          oldName: row.name,
                          newName,
                      }),
            new Map<string, RenameCandidate>()
        );

    const all = [...changedBySymbol.values()].sort(compareBySymbol);

    if (all.length > RENAME_GUARD_MAX) {
        return {
            candidates: [],
            canonicalRenamed: [],
            deferred: 0,
            compared: compared.size,
            guardTrip: `${all.length} candidates`,
            guardSample: all.slice(0, GUARD_SAMPLE_SIZE),
        };
    }

    const canonicalRenamed = all.filter(c =>
        input.canonicalSymbols.has(c.symbol)
    );
    const processable = all.filter(c => !input.canonicalSymbols.has(c.symbol));

    return {
        candidates: processable.slice(0, RENAME_BATCH_MAX),
        canonicalRenamed,
        deferred: Math.max(0, processable.length - RENAME_BATCH_MAX),
        compared: compared.size,
        guardTrip: null,
        guardSample: [],
    };
}
