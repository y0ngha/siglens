import 'server-only';
import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';
import type { FundamentalProviderWithRawPeers } from '@/shared/api/fmp/fundamentalProvider.types';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
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
 * 한국 종목의 `getKeyMetricsTtm`만 DART 기준 값으로 바꿔 끼운 provider. 나머지 메서드는 원본 그대로 위임한다.
 *
 * 이 provider를 쓰는 곳 — 펀더멘털·종합 분석 입력 — 이 에이전트·화면과 같은 기준을 보게 하려는 것이다. 미국·크립토 심볼은 건드리지 않는다.
 *
 * 래퍼는 `Proxy`다: provider 클래스 인스턴스의 메서드는 프로토타입에 있거나 `React.cache`로 감싼 필드라 객체 전개로는 복사되지 않는다.
 */
export function withKrValuation(
    provider: FundamentalProviderWithRawPeers,
    symbol: string,
    deps: KrValuationDeps = {}
): FundamentalProviderWithRawPeers {
    if (!isKrEquitySymbol(symbol)) return provider;

    const getKeyMetricsTtm = async (
        target: string
    ): Promise<FundamentalValuationMetrics | null> => {
        const base = await provider.getKeyMetricsTtm(target);
        if (base === null || !isKrEquitySymbol(target)) return base;
        const { valuation } = await resolveFor(base, target, deps);
        return applyValuation(base, valuation);
    };

    return new Proxy(provider, {
        get(target, property) {
            if (property === 'getKeyMetricsTtm') return getKeyMetricsTtm;
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
