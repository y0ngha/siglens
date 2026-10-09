import { toFmpSearchSymbol } from '@/shared/lib/fmpSymbol';
import { normalizeCompanyName } from './normalizeCompanyName';

/**
 * 후보가 `max(RENAME_GUARD_FLOOR, 비교한 심볼 수 × 이 비율)`을 **넘으면 그 회차를 통째로
 * 건너뛴다**(앞의 N개만 처리하는 상한이 아니다).
 *
 * 막으려는 것은 FMP 표기 체계 변경이나 정규화 결함이다 — 그때는 비교 대상의 큰 몫이
 * 한꺼번에 "바뀐 것"으로 잡히고, 그 상태로 재번역(Gemini 호출·DB 쓰기·ISR 무효화)을 돌리면
 * 멀쩡한 한글명이 대량으로 갈아엎힌다. KR cron의 소실 상한 가드
 * (`KR_RECONCILE_DELIST_ABORT_THRESHOLD`)와 같은 철학이다 — 걸리면 하루 미뤄질 뿐이다.
 *
 * 절대 개수(예전 300)가 아니라 비율인 이유: 첫 운영 회차(2026-10-09)가 비교 30,827건 중
 * 후보 1,503건(4.9%)으로 가드에 걸려 통째로 건너뛰어졌다. FMP profile로 표본을 대조하니
 * 전부 stock-list와 같은 실제 불일치였다 — 그동안 쌓인 재할당(FAGI 펀드 → 다른 회사 등)과
 * 표기 차이다. 누적분은 고정 개수로는 영영 가드를 넘지 못하므로, 매일 상한
 * (`RENAME_BATCH_MAX`)만큼 소진하게 두고 가드는 비교 대상의 큰 몫이 뒤집히는 경우만 잡는다.
 *
 * 그 대가로 가드가 받아들이는 후보 수는 커졌다(비교 3만 건이면 약 3,000건). 그 사이의
 * 표기 체계 변경은 이 가드가 아니라 하루 상한(`RENAME_BATCH_MAX`)이 피해를 묶는다 — 하루에
 * 그만큼만 다시 번역되고, 로그(`renamed …`)로 보이므로 다음 회차 전에 멈출 수 있다.
 */
export const RENAME_GUARD_RATIO = 0.1;

/**
 * 가드의 하한 — 비교 대상이 작을 때(stock-list가 일부만 왔거나 저장 행이 적을 때) 비율만으로는
 * 몇 건의 실제 변경에도 가드가 걸린다. 이 수 이하의 후보는 비율과 무관하게 처리한다.
 */
export const RENAME_GUARD_FLOOR = 300;

/**
 * 정상일 때도 하루에 처리하는 최대 개수. 나머지는 다음 날 이어서 처리된다 — 처리된
 * 심볼은 저장 이름이 FMP와 같아져 후보에서 빠지므로 재대조가 멱등이다. 첫 회차 누적분
 * (약 1,500건)을 열흘 안쪽에 소진하는 크기다.
 *
 * 시간 예산(SERVER.md#CC-7, 각 단계 최악의 합): 번역은 `RENAME_TRANSLATE_CHUNK`개씩 나눈
 * Gemini 호출 최대 3회를 순차로 하고, DB 쓰기는 심볼당 최대 2 upsert를 순차로 한다. 같은
 * 회차에서 앞단 KR 동기화(data.go.kr 페이지네이션)와 stock-list 수신(`fmpGet` 시도당 10초 ×
 * 최대 4회 + 백오프 예산 60초 ≈ 최악 100초)이 먼저 돈다. 202 + `after()`라 요청 타임아웃에
 * 걸리지 않지만 SIGTERM drain이 이 합만큼 기다릴 수 있다.
 */
export const RENAME_BATCH_MAX = 180;

/**
 * Gemini 번역 호출 한 번에 담는 최대 개수. 응답 하나가 깨지면(`translateCompanyNames`는 `{}`로
 * degrade) 그 묶음 전체가 다음 날로 밀리므로, 하루 상한을 한 호출에 몰지 않는다.
 */
export const RENAME_TRANSLATE_CHUNK = 60;

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
    /** 이번 회차에 처리할 후보(정본 제외, 최대 `RENAME_BATCH_MAX`, 이름 차이가 큰 순). 가드가 걸리면 빈 배열. */
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

/**
 * 이미 정규화한 두 이름(`normalizeCompanyName` 결과)의 토큰 겹침(Jaccard, 0~1). 1에
 * 가까울수록 표기 차이에 가깝다.
 */
function nameSimilarity(normalizedA: string, normalizedB: string): number {
    const left = new Set(normalizedA.split(' '));
    const right = new Set(normalizedB.split(' '));
    const shared = [...left].filter(token => right.has(token)).length;
    return shared / new Set([...left, ...right]).size;
}

/**
 * 이름이 많이 다른 후보부터 처리한다 — 다른 회사로 넘어간 심볼(엉뚱한 한글명이 보이는
 * 경우)이 표기 차이(`Fund Class A` ↔ `Fund;A`)보다 먼저 고쳐져야 한다. 하루 상한으로 누적분을
 * 나눠 소진할 때 순서가 곧 우선순위다. 같으면 로케일에 흔들리지 않는 심볼순(`'en'`)이다 — 이월
 * 순서가 실행 환경과 무관하게 같아야 한다.
 */
function byPriority(
    candidates: readonly (RenameCandidate & { similarity: number })[]
): RenameCandidate[] {
    return candidates
        .toSorted(
            (a, b) =>
                a.similarity - b.similarity ||
                a.symbol.localeCompare(b.symbol, 'en')
        )
        .map(({ symbol, oldName, newName }) => ({ symbol, oldName, newName }));
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

    // 정규화는 행마다 한 번만 한다 — 변경 판정과 우선순위(토큰 겹침)가 같은 값을 쓴다.
    // 같은 심볼이 두 테이블에 있으면 먼저 어긋난 쪽(`korean_tickers` 우선)만 남긴다.
    const changedBySymbol = looked
        .map(({ row, newName }) => ({
            row,
            newName,
            oldNormalized: normalizeCompanyName(row.name),
            newNormalized: normalizeCompanyName(newName),
        }))
        .filter(
            ({ oldNormalized, newNormalized }) =>
                oldNormalized !== newNormalized
        )
        .reduce(
            (acc, { row, newName, oldNormalized, newNormalized }) =>
                acc.has(row.symbol)
                    ? acc
                    : acc.set(row.symbol, {
                          symbol: row.symbol,
                          oldName: row.name,
                          newName,
                          similarity: nameSimilarity(
                              oldNormalized,
                              newNormalized
                          ),
                      }),
            new Map<string, RenameCandidate & { similarity: number }>()
        );

    const all = byPriority([...changedBySymbol.values()]);

    if (
        all.length >
        Math.max(RENAME_GUARD_FLOOR, compared.size * RENAME_GUARD_RATIO)
    ) {
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
