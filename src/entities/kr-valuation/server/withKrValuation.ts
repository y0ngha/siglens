import 'server-only';
import type {
    FundamentalPeerInput,
    FundamentalValuationMetrics,
} from '@y0ngha/siglens-core';
import type { FundamentalProviderWithRawPeers } from '@/shared/api/fmp/fundamentalProvider.types';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import type { KrPrice, KrValuation } from '../model';
import {
    resolveKrValuation,
    type KrValuationResolution,
} from './getKrValuation';
import type { KrValuationMode } from './getKrValuationInputs';
import { loadKrLastClose } from './loadKrLastClose';

interface KrValuationDeps {
    loadClose?: (symbol: string) => Promise<KrPrice | null>;
    now?: () => Date;
    /** 화면·에이전트는 `request`(기본), 프리웜은 `background`. */
    mode?: KrValuationMode;
}

/** 제공처 지표(`base`)와 DART를 합쳐 한국 종목 밸류에이션을 만든다. 화면 값·카드 캡션·분석 입력이 모두 이 한 함수를 거친다. */
async function resolveFor(
    base: FundamentalValuationMetrics,
    symbol: string,
    deps: KrValuationDeps
): Promise<KrValuationResolution> {
    const loadClose = deps.loadClose ?? loadKrLastClose;
    const now = deps.now ?? (() => new Date());
    return resolveKrValuation(
        symbol,
        await loadClose(symbol),
        { pe: base.peRatioTTM, pb: base.pbRatioTTM, epsTtm: base.epsTTM },
        now(),
        deps.mode ?? 'request'
    );
}

/** DART 기준이면 PER·PBR·EPS만 바꾸고 PSR·PEG·EV/EBITDA는 제공처 값을 그대로 둔다. 제공처 기준이면 원본 객체 그대로다. */
function applyValuation(
    base: FundamentalValuationMetrics,
    valuation: KrValuation
): FundamentalValuationMetrics {
    return valuation.basis.source === 'dart'
        ? {
              ...base,
              peRatioTTM: valuation.pe,
              pbRatioTTM: valuation.pb,
              epsTTM: valuation.epsTtm,
          }
        : base;
}

/**
 * peer 환산의 DART 동시 조회 상한. peer 목록은 `PEER_LIMIT`(10)개 이하이고 DART·종가 조회는 외부 호출이라 한 번에 이만큼만 연다
 * (SERVER.md#CC-1). 이 경로의 유일한 fan-out이다.
 *
 * 최악의 경우(SERVER.md#CC-7, #SA-14):
 * - `request`: 한국 peer를 목록 순서로 앞의 이 개수만 환산한다(나머지는 제공처 PER). 청크가 하나라 종목당 5초 시한(`request` 예산) 한 번이면
 *   끝나고, 전역 DART 슬롯 4개 중 최대 이 개수만 한 번 잡는다.
 * - `background`: 전부 환산한다. 최악은 ceil(n / 이 개수) × 120초(n ≤ `PEER_LIMIT`)다.
 */
const PEER_VALUATION_CONCURRENCY = 3;

/** 한국 peer 한 건의 `per`를 DART `pe`로 바꾼다. DART 기준을 못 만들면(제공처 대체) 원본 peer 그대로이고 `psr` 등 나머지 필드는 건드리지 않는다. */
async function withDartPeerPer(
    peer: FundamentalPeerInput,
    deps: KrValuationDeps
): Promise<FundamentalPeerInput> {
    try {
        // 제공처 PER은 `resolveFor`의 대체값으로만 넘긴다. DART 기준을 못 만들면 이 값이 쓰이지 않고 원본 peer를 돌려주므로 PBR·EPS는 읽는 곳이 없어 null이다.
        const { valuation } = await resolveFor(
            {
                peRatioTTM: peer.per ?? null,
                priceToSalesRatioTTM: peer.psr ?? null,
                pbRatioTTM: null,
                pegRatioTTM: null,
                enterpriseValueOverEBITDATTM: null,
                epsTTM: null,
            },
            peer.symbol,
            deps
        );
        // DART 기준의 `pe`가 null이면(적자) 그대로 null이다 — 주체 본인의 PER과 같은 기준이다.
        return valuation.basis.source === 'dart'
            ? { ...peer, per: valuation.pe }
            : peer;
    } catch (error) {
        if (isDynamicServerError(error)) throw error;
        console.warn(
            '[kr-valuation] peer PER fallback:',
            redactDbErrorForLog(error)
        );
        return peer;
    }
}

async function withDartPeerPers(
    peers: FundamentalPeerInput[],
    deps: KrValuationDeps
): Promise<FundamentalPeerInput[]> {
    const krPeers = peers.filter(peer => isKrEquitySymbol(peer.symbol));
    const targets =
        (deps.mode ?? 'request') === 'request'
            ? krPeers.slice(0, PEER_VALUATION_CONCURRENCY)
            : krPeers;
    const settled = await withConcurrencyLimit(
        targets,
        PEER_VALUATION_CONCURRENCY,
        peer => withDartPeerPer(peer, deps)
    );
    const converted = new Map<string, FundamentalPeerInput>();
    settled.forEach((result, index) => {
        const original = targets[index];
        if (original === undefined) return;
        // `withDartPeerPer`는 동적 서버 오류만 던진다 — 그건 호출부(Next)가 알아야 하므로 다시 던진다.
        if (result.status === 'rejected') throw result.reason;
        converted.set(original.symbol, result.value);
    });
    return peers.map(peer => converted.get(peer.symbol) ?? peer);
}

/**
 * `getKeyMetricsTtm`(한국 주체)와 `getStockPeers`(모든 주체)를 DART 기준으로 바꿔 끼운 provider. 나머지 메서드는 원본 그대로 위임한다.
 *
 * 이 provider를 쓰는 곳 — 펀더멘털·종합 분석 입력 — 이 에이전트·화면과 같은 기준을 보게 하려는 것이다.
 * - 한국 주체의 `getKeyMetricsTtm`: PER·PBR·EPS를 DART 값으로.
 * - 모든 주체의 `getStockPeers`: peer 중 한국 종목의 `per`를 DART `pe`로. 미국 주체의 FMP peer 목록에 한국 종목이 섞여 오는데, peer
 *   enrich는 `shared`에서 raw yahoo로 하므로(FSD상 shared는 entities를 못 부른다) 캐시(`fundamental:peers-v2`) 바깥, 이 래퍼 층에서 바꾼다.
 *   peer 캐시 키와 저장 값은 그대로이고 읽은 뒤에 바꾼다. 펀더멘털 분석에는 입력 해시가 없고(core 키는 심볼·모델·티어·스킬), 종합 분석의
 *   inputHash는 펀더멘털 결과를 접으므로 그 결과가 다시 만들어질 때 한 번 바뀐다. 화면 peer 표(`getStockPeersRaw`)는 per를 읽지 않아 영향이 없다.
 *
 * 래퍼는 `Proxy`다: provider 클래스 인스턴스의 메서드는 프로토타입에 있거나 `React.cache`로 감싼 필드라 객체 전개로는 복사되지 않는다.
 */
export function withKrValuation(
    provider: FundamentalProviderWithRawPeers,
    symbol: string,
    deps: KrValuationDeps = {}
): FundamentalProviderWithRawPeers {
    const isKrSubject = isKrEquitySymbol(symbol);

    const getKeyMetricsTtm = async (
        target: string
    ): Promise<FundamentalValuationMetrics | null> => {
        const base = await provider.getKeyMetricsTtm(target);
        if (base === null || !isKrEquitySymbol(target)) return base;
        const { valuation } = await resolveFor(base, target, deps);
        return applyValuation(base, valuation);
    };

    // 한국 주체는 peer가 없다(원본이 빈 목록) — 그대로 위임한다.
    const getStockPeers = async (
        target: string
    ): Promise<FundamentalPeerInput[]> =>
        withDartPeerPers(await provider.getStockPeers(target), deps);

    return new Proxy(provider, {
        get(target, property) {
            if (property === 'getKeyMetricsTtm' && isKrSubject) {
                return getKeyMetricsTtm;
            }
            if (property === 'getStockPeers' && !isKrSubject) {
                return getStockPeers;
            }
            const value: unknown = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}

export interface KrPageValuation {
    metrics: FundamentalValuationMetrics | null;
    basis: KrValuation['basis'] | null;
    transient: boolean;
}

/**
 * 펀더멘털 탭 카드용: 지표와 계산 기준을 **한 번에** 만든다. 값과 캡션(`priceDate`·`ttmEnd`)이 서로 다른 시점의 계산에서 나와 어긋나지
 * 않게 하려는 것이다. 제공처 지표가 없으면 둘 다 null.
 */
export async function resolveKrPageValuation(
    provider: FundamentalProviderWithRawPeers,
    symbol: string,
    deps: KrValuationDeps = {}
): Promise<KrPageValuation> {
    const base = await provider.getKeyMetricsTtm(symbol);
    if (base === null) return { metrics: null, basis: null, transient: false };
    const { valuation, transient } = await resolveFor(base, symbol, deps);
    return {
        metrics: applyValuation(base, valuation),
        basis: valuation.basis,
        transient,
    };
}
