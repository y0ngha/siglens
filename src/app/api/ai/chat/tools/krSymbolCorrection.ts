import 'server-only';
import { correctKrSymbolSuffix } from '@/entities/ticker/lib/koreanNameStore';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { logToolDegrade } from './logToolDegrade';

/** 도구 결과에 덧붙는 교정 기록 — 모델이 "다른 심볼로 답했다"는 사실을 보게 한다. */
export interface KrSymbolCorrectionResult {
    /** 교정된 심볼로 바꾼 인자. 교정이 없으면 입력과 같은 객체다. */
    args: Record<string, unknown>;
    /** 실행 결과에 교정 기록을 싣는다. 교정이 없거나 결과가 객체가 아니면 그대로 돌려준다. */
    annotate: (result: unknown) => unknown;
}

async function correctOne(symbol: string, toolName: string): Promise<string> {
    // 교정은 보조 장치다 — 마스터 조회가 어떤 식으로 실패해도 호출을 막지 않는다. 다만 조용히
    // 삼키면 교정이 왜 빠졌는지 볼 길이 없으므로(SERVER.md#SA-4) 오류 이름만 남긴다.
    try {
        return await correctKrSymbolSuffix(symbol);
    } catch (error) {
        logToolDegrade(toolName, 'kr symbol suffix correction', error);
        return symbol;
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isKrSymbolString(value: unknown): value is string {
    return typeof value === 'string' && isKrEquitySymbol(value);
}

/** 단일 `symbol` 인자의 교정 한 건. */
export interface SingleSymbolCorrection {
    from: string;
    to: string;
}

/** 목록 `symbols` 인자의 교정 — 교정된 전체 목록과 바뀐 항목만. */
export interface SymbolListCorrection {
    symbols: unknown[];
    corrections: { from: string; to: string }[];
}

/** 원래 심볼과 마스터가 고른 심볼 → 바뀌었으면 교정 한 건, 대소문자만 다르거나 같으면 `null`. */
export function singleSymbolCorrection(
    from: string,
    to: string
): SingleSymbolCorrection | null {
    return to === from.toUpperCase() ? null : { from, to };
}

/** 원래 목록과 교정된 목록(같은 길이·순서) → 바뀐 항목이 있으면 교정, 없으면 `null`. */
export function symbolListCorrection(
    from: readonly unknown[],
    to: readonly unknown[]
): SymbolListCorrection | null {
    const corrections = from.flatMap((original, i) => {
        const corrected = to[i];
        return typeof original === 'string' &&
            typeof corrected === 'string' &&
            corrected !== original.toUpperCase()
            ? [{ from: original, to: corrected }]
            : [];
    });
    return corrections.length === 0 ? null : { symbols: [...to], corrections };
}

/** 교정 결과를 인자·결과 기록으로 접는다. 교정이 없으면 입력 인자 객체를 그대로 돌려준다. */
export function applyKrSymbolCorrections(
    args: Record<string, unknown>,
    single: SingleSymbolCorrection | null,
    list: SymbolListCorrection | null
): KrSymbolCorrectionResult {
    if (single === null && list === null) {
        return { args, annotate: result => result };
    }
    return {
        args: {
            ...args,
            ...(single ? { symbol: single.to } : {}),
            ...(list ? { symbols: list.symbols } : {}),
        },
        annotate: result =>
            isPlainObject(result)
                ? {
                      ...(single ? { symbolCorrectedFrom: single.from } : {}),
                      ...(list ? { symbolCorrections: list.corrections } : {}),
                      ...result,
                  }
                : result,
    };
}

async function correctSingleArg(
    args: Record<string, unknown>,
    toolName: string
): Promise<SingleSymbolCorrection | null> {
    const symbol = args.symbol;
    if (!isKrSymbolString(symbol)) return null;
    return singleSymbolCorrection(symbol, await correctOne(symbol, toolName));
}

async function correctListArg(
    args: Record<string, unknown>,
    toolName: string
): Promise<SymbolListCorrection | null> {
    const list = args.symbols;
    if (!Array.isArray(list) || !list.some(isKrSymbolString)) return null;
    const corrected = await Promise.all(
        list.map(s =>
            isKrSymbolString(s) ? correctOne(s, toolName) : Promise.resolve(s)
        )
    );
    return symbolListCorrection(list, corrected);
}

/**
 * 도구 인자의 한국 종목 심볼(`symbol`, `symbols[]`) 접미사를 `korean_tickers` 마스터로 교정한다.
 *
 * 디스패처 한 곳에서 처리해 한국 종목을 받는 모든 도구(시세·봉·펀더멘털·분석·뉴스·수급)가 같은
 * 판정을 쓴다. 교정 근거와 판정 규칙은 `correctKrSymbolSuffix` JSDoc 참조.
 *
 * 결과 기록: 단일 `symbol` 인자는 `symbolCorrectedFrom`(원래 심볼), 목록 `symbols` 인자는
 * `symbolCorrections: [{ from, to }]`. 한국 종목 심볼이 없으면 DB를 읽지 않는다.
 */
export async function correctKrSymbolArgs(
    args: Record<string, unknown>,
    toolName: string
): Promise<KrSymbolCorrectionResult> {
    const [single, list] = await Promise.all([
        correctSingleArg(args, toolName),
        correctListArg(args, toolName),
    ]);
    return applyKrSymbolCorrections(args, single, list);
}
