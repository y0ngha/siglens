import type {
    OptionsChain,
    OptionsContract,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';

/**
 * 옵션 탭 클라이언트로 보내는 계약 한 건 — 화면과 클라이언트 계산이 실제로 읽는 필드만.
 *
 * `OptionsContract`에서 빠지는 셋:
 * - `contractSymbol`(`"MSFT260117C00400000"`), `lastPrice`: 테이블·차트·지표 어디서도
 *   읽지 않는다(`clientOptionsSnapshot.test.ts`의 가드가 `src/widgets/options`를 훑어 고정).
 * - `inTheMoney`: 같은 스냅샷의 `strike`와 `underlyingPrice`로 정확히 다시 계산된다.
 *
 * 계약 수가 많은 종목(`/MSFT/options` HTML 565KB, 이 변경 직전 운영 측정)에서 이 셋이
 * 계약당 바이트의 약 3분의 1이었고, 같은 스냅샷이 RSC 페이로드에 한 번 더(죽은
 * `HydrationBoundary`) 실려 있었다. 재는 법: `curl -s --compressed
 * https://siglens.io/MSFT/options | wc -c`로 압축을 푼 HTML 바이트를 재고, 같은 본문에서
 * 계약 객체 하나를 골라 이 타입에서 뺀 필드가 차지하는 바이트 비율을 본다. 장중·만기 수에
 * 따라 계약 수가 달라 값은 측정 시점마다 다르다.
 */
export type ClientOptionsContract = Pick<
    OptionsContract,
    'strike' | 'bid' | 'ask' | 'volume' | 'openInterest' | 'impliedVolatility'
>;

export interface ClientOptionsChain extends Omit<
    OptionsChain,
    'calls' | 'puts'
> {
    calls: ReadonlyArray<ClientOptionsContract>;
    puts: ReadonlyArray<ClientOptionsContract>;
}

export interface ClientOptionsSnapshot extends Omit<OptionsSnapshot, 'chains'> {
    chains: ReadonlyArray<ClientOptionsChain>;
}

function toClientContract(contract: OptionsContract): ClientOptionsContract {
    return {
        strike: contract.strike,
        bid: contract.bid,
        ask: contract.ask,
        volume: contract.volume,
        openInterest: contract.openInterest,
        impliedVolatility: contract.impliedVolatility,
    };
}

/** 서버(RSC)에서 클라이언트로 넘기기 직전에 계약을 투영한다. */
export function toClientOptionsSnapshot(
    snapshot: OptionsSnapshot
): ClientOptionsSnapshot {
    return {
        symbol: snapshot.symbol,
        underlyingPrice: snapshot.underlyingPrice,
        capturedAt: snapshot.capturedAt,
        chains: snapshot.chains.map(chain => ({
            expirationDate: chain.expirationDate,
            daysToExpiration: chain.daysToExpiration,
            calls: chain.calls.map(toClientContract),
            puts: chain.puts.map(toClientContract),
        })),
    };
}

type ContractSide = 'call' | 'put';

/**
 * 콜은 행사가가 현재가보다 낮을 때, 풋은 높을 때 내가격이다. 행사가가 현재가와 같으면
 * 등가격(ATM)이라 양쪽 모두 `false`다.
 *
 * 현재가가 0 이하이면(시세가 없어 0으로 떨어진 스냅샷) 판정할 근거가 없으므로 `false`로
 * 둔다 — 그대로 비교하면 모든 풋이 내가격으로 뒤집힌다.
 */
export function isInTheMoney(
    side: ContractSide,
    strike: number,
    underlyingPrice: number
): boolean {
    if (underlyingPrice <= 0) return false;
    return side === 'call'
        ? strike < underlyingPrice
        : strike > underlyingPrice;
}

/**
 * core 어댑터가 채우는 자리표시값. 클라이언트로 보내지 않은 필드라 실제 값이 아니다 —
 * 그래서 이 어댑터의 결과는 core 계산(`summarizeChainForLlm`·`aggregateOpenInterest`)에만
 * 넘기고, 위젯은 `ClientOptionsChain`만 받는다(자식 위젯 prop 타입). 위젯이 이 필드를 읽기
 * 시작하면 타입 오류가 나고, 정적 가드(`clientOptionsSnapshot.test.ts`)도 실패한다.
 */
const NOT_SENT_TO_CLIENT = {
    contractSymbol: '',
    lastPrice: null,
} as const satisfies Pick<OptionsContract, 'contractSymbol' | 'lastPrice'>;

function toCoreContract(
    contract: ClientOptionsContract,
    side: ContractSide,
    underlyingPrice: number
): OptionsContract {
    return {
        ...contract,
        ...NOT_SENT_TO_CLIENT,
        inTheMoney: isInTheMoney(side, contract.strike, underlyingPrice),
    };
}

/**
 * 클라이언트에서 core 옵션 계산이 요구하는 `OptionsChain` 모양으로 되돌린다.
 *
 * core의 `summarizeChainForLlm`·`aggregateOpenInterest`가 매개변수를 전체
 * `OptionsChain`으로 받기 때문에 필요한 어댑터다. **core 호출 인자로만** 쓴다 — 결과를
 * 위젯에 내리지 않는다(`NOT_SENT_TO_CLIENT`). 매개변수를 필요한 필드로 좁히는 일은
 * siglens-core 쪽 변경이다.
 */
export function toCoreOptionsChain(
    chain: ClientOptionsChain,
    underlyingPrice: number
): OptionsChain {
    return {
        ...chain,
        calls: chain.calls.map(c => toCoreContract(c, 'call', underlyingPrice)),
        puts: chain.puts.map(p => toCoreContract(p, 'put', underlyingPrice)),
    };
}
