import { SECONDS_PER_HOUR } from '@/shared/config/time';
import type {
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '../model';

/**
 * 판독값이 아직 마지막 세션까지 오지 않았을 때(어느 시리즈든 FMP가 그 날짜를 아직 발행하지
 * 않음)의 재시도 간격. 예전 고정 TTL과 같은 1시간이다. 키가 넘어가기까지 남은 시간은
 * 언제나 이보다 길다(롤 여유가 이미 1시간이다) — 그래서 따로 상한을 걸지 않는다.
 */
const INCOMPLETE_READING_TTL_SECONDS = SECONDS_PER_HOUR;

/**
 * 키가 넘어가는 시각에 더하는 여유. 인스턴스 간 시계 차이로 넘어가기 직전에 읽는 요청을
 * 덮는 정도면 된다(`CachedMarketDataProvider`의 EOD 히스토리 키와 같은 값).
 */
const ROLL_MARGIN_SECONDS = SECONDS_PER_HOUR;

/**
 * 마지막 마감 세션 날짜(`to`)를 키에 넣은 공포·탐욕 판독값의 Redis TTL.
 *
 * 입력은 `to`까지의 일봉 종가뿐이라, 모든 시리즈가 `to`까지 차 있으면(`snapshot.asOf`는
 * 모든 시리즈에 공통인 마지막 날짜다) 그 키의 값은 다음 세션이 마감될 때까지 바뀌지 않는다.
 * 그때 `to`가 넘어가 키가 바뀌므로 TTL은 그 시각까지면 된다.
 *
 * 예전엔 키에 날짜가 없어 1시간마다 5년치 시리즈(미국 6개·크립토 21개)를 통째로 다시 받았다
 * — 하루 최대 648회. 1시간 고정은 "마감 직후 캐시된 항목이 살아남으면 안 된다"는 이유였는데,
 * 날짜를 키에 넣으면 마감 뒤 새 `to`는 새 키라 그 문제가 생기지 않는다. 다만 `to`가 넘어간
 * 직후 FMP가 일부 시리즈를 아직 발행하지 않았으면(`asOf < to`) 그 값은 1시간만 둬
 * 발행되면 다시 받게 한다. snapshot이 없는 뷰는 애초에 캐시하지 않는다(`hasSnapshot`).
 */
export function sessionKeyedTtlSeconds<S extends MarketFearGreedViewSnapshot>(
    view: MarketFearGreedView<S>,
    to: string,
    secondsUntilRoll: number
): number {
    return view.snapshot?.asOf === to
        ? secondsUntilRoll + ROLL_MARGIN_SECONDS
        : INCOMPLETE_READING_TTL_SECONDS;
}
