import 'server-only';
import {
    computeKrValuation,
    providerKrValuation,
} from '../lib/computeKrValuation';
import type { KrPrice, KrProviderValues, KrValuation } from '../model';
import {
    getKrValuationInputs,
    type KrValuationMode,
} from './getKrValuationInputs';

export interface KrValuationResolution {
    valuation: KrValuation;
    /**
     * 오류·시한·예산·종가 조회 실패 때문에 DART 값을 못 만들고 제공처 값으로 내려왔거나, KRX 주식수 갱신이 실패해 낡은 DART 주식수로 계산했다. 다시 읽으면 달라질 수 있으니 호출부는 이 결과를
     * 장기 캐시에 굳히지 않는다(SERVER.md#SA-18).
     */
    transient: boolean;
}

/**
 * 한국 종목 PER·PBR 한 벌(값 + 기준)과 그것이 일시적 대체값인지. DART 입력을 읽을 수 없거나(키·한도·보고서 없음·12월 결산이 아님) 종가가
 * 없거나 숫자가 모자라면 `provider`(제공처 값 그대로, 다시 곱하지 않음)로 돌아가며 `basis`가 그렇다고 밝힌다. 종가가 없으면 DART를
 * 아예 읽지 않는다(PER·PBR을 못 만드는 호출에 예산을 쓰지 않는다). 절대 던지지 않는다.
 */
export async function resolveKrValuation(
    symbol: string,
    price: KrPrice | null,
    provider: KrProviderValues,
    now: Date = new Date(),
    mode: KrValuationMode = 'request'
): Promise<KrValuationResolution> {
    if (price === null) {
        return {
            valuation: providerKrValuation(provider, 'price_unavailable'),
            transient: true,
        };
    }
    const load = await getKrValuationInputs(symbol, now, mode);
    if (load.kind === 'fallback') {
        return {
            valuation: providerKrValuation(provider, load.reason),
            transient: load.transient,
        };
    }
    const computed = computeKrValuation({ ...load.data, price });
    return computed === null
        ? {
              valuation: providerKrValuation(provider, 'incomplete_report'),
              transient: false,
          }
        : { valuation: computed, transient: load.transient };
}

/**
 * 에이전트 도구가 쓰는 짧은 형태 — 일시적 대체인지는 알 필요가 없다(결과를 캐시하지 않는다).
 *
 * @param price 마지막 완료 종가(`loadKrLastClose`).
 * @param provider 제공처가 이미 계산한 값 — `provider` 기준일 때 그대로 돌려줄 대체값.
 */
export async function getKrValuation(
    symbol: string,
    price: KrPrice | null,
    provider: KrProviderValues,
    now: Date = new Date()
): Promise<KrValuation> {
    return (await resolveKrValuation(symbol, price, provider, now)).valuation;
}
