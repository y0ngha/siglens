import { POPULAR_OPTIONS_TICKERS } from '@/shared/config/popular-options-tickers';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';

/** 워밍 유니버스 크기 — 노출 순서 상위 N개. 옵션 탭 트래픽이 몰리는 대형주에 한정한다. */
export const OPTIONS_WARM_UNIVERSE_SIZE = 100;

/** tick 한 번에 Yahoo를 치는 종목 수. 5분 tick × ~43회(저녁 창)면 유니버스를 한 바퀴 이상 돈다. */
export const OPTIONS_WARM_SYMBOLS_PER_TICK = 6;

const OPTIONS_TICKER_SET: ReadonlySet<string> = new Set(
    POPULAR_OPTIONS_TICKERS
);

/**
 * 워밍 대상 유니버스 — `POPULAR_TICKERS`(노출 순서)에서 옵션 시장이 있는 종목만 남겨 상위
 * `size`개. 순서를 `POPULAR_TICKERS`에서 가져오는 이유: `POPULAR_OPTIONS_TICKERS`는 알파벳
 * 순이라 "인기순"이 아니다.
 */
export function buildOptionsWarmUniverse(
    size: number = OPTIONS_WARM_UNIVERSE_SIZE
): readonly string[] {
    return POPULAR_TICKERS.filter(symbol =>
        OPTIONS_TICKER_SET.has(symbol)
    ).slice(0, size);
}

export interface OptionsWarmPick {
    symbol: string;
    /** 커서 위치에서 이 종목까지 걸어온 걸음 수(1부터) — 이 종목 **앞**까지만 소화했다면 `step - 1`. */
    step: number;
}

export interface OptionsWarmSelection {
    picks: readonly OptionsWarmPick[];
    /** 이미 확보돼 건너뛴 종목 수. */
    skipped: number;
    /** 이번 선택이 훑은 걸음 수(건너뛴 것 포함). 커서를 이만큼 전진시키면 빈틈이 없다. */
    examined: number;
}

interface SelectParams {
    universe: readonly string[];
    /** 저장된 커서 값(모듈로 전). */
    cursor: number;
    batchSize: number;
    /** 오늘 마감 이후 last-good이 이미 있으면 true. */
    isCaptured: (symbol: string) => Promise<boolean>;
    /** true면 더 훑지 않는다(시간 예산). */
    shouldStop?: () => boolean;
}

/**
 * 커서에서 시작해 유니버스를 한 방향으로 돌며 워밍할 종목을 `batchSize`개까지 고른다.
 * 이미 확보된 종목은 건너뛰되 걸음 수에는 센다 — 유니버스를 한 바퀴(`universe.length`걸음)
 * 넘게 돌지 않으므로 전부 확보된 날도 무한히 돌지 않는다.
 *
 * 커서가 유니버스 길이를 넘어도(누적 값·유니버스 축소) 모듈로로 감싸 처리한다.
 */
export async function selectOptionsWarmSymbols({
    universe,
    cursor,
    batchSize,
    isCaptured,
    shouldStop = () => false,
}: SelectParams): Promise<OptionsWarmSelection> {
    const length = universe.length;
    if (length === 0 || batchSize <= 0) {
        return { picks: [], skipped: 0, examined: 0 };
    }
    const start = ((cursor % length) + length) % length;
    const picks: OptionsWarmPick[] = [];
    let skipped = 0;
    let examined = 0;
    while (examined < length && picks.length < batchSize && !shouldStop()) {
        const symbol = universe[(start + examined) % length];
        examined += 1;
        if (await isCaptured(symbol)) {
            skipped += 1;
        } else {
            picks.push({ symbol, step: examined });
        }
    }
    return { picks, skipped, examined };
}
