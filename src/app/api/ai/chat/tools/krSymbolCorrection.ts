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
    const single =
        typeof args.symbol === 'string' && isKrEquitySymbol(args.symbol)
            ? args.symbol
            : null;
    const list = Array.isArray(args.symbols) ? args.symbols : null;
    const listHasKr =
        list?.some(s => typeof s === 'string' && isKrEquitySymbol(s)) ?? false;
    if (single === null && !listHasKr) {
        return { args, annotate: result => result };
    }

    const [correctedSingle, correctedList] = await Promise.all([
        single === null ? Promise.resolve(null) : correctOne(single, toolName),
        list === null || !listHasKr
            ? Promise.resolve(null)
            : Promise.all(
                  list.map(s =>
                      typeof s === 'string' && isKrEquitySymbol(s)
                          ? correctOne(s, toolName)
                          : Promise.resolve(s)
                  )
              ),
    ]);

    const singleChanged =
        single !== null &&
        correctedSingle !== null &&
        correctedSingle !== single.toUpperCase();
    const listCorrections =
        list !== null && correctedList !== null
            ? list.flatMap((from, i) => {
                  const to = correctedList[i];
                  return typeof from === 'string' &&
                      typeof to === 'string' &&
                      to !== from.toUpperCase()
                      ? [{ from, to }]
                      : [];
              })
            : [];
    if (!singleChanged && listCorrections.length === 0) {
        return { args, annotate: result => result };
    }

    const nextArgs: Record<string, unknown> = {
        ...args,
        ...(singleChanged ? { symbol: correctedSingle } : {}),
        ...(listCorrections.length > 0 ? { symbols: correctedList } : {}),
    };
    return {
        args: nextArgs,
        annotate: result =>
            isPlainObject(result)
                ? {
                      ...(singleChanged ? { symbolCorrectedFrom: single } : {}),
                      ...(listCorrections.length > 0
                          ? { symbolCorrections: listCorrections }
                          : {}),
                      ...result,
                  }
                : result,
    };
}
