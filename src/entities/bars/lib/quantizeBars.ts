import type { Bar } from '@y0ngha/siglens-core';
import { isEtRegularSessionOpen } from '@y0ngha/siglens-core';

/**
 * SSR 직렬화 전용: 진행 중(forming) 당일 봉을 제외해 "마지막 완료 일봉"까지만 남긴다.
 *
 * 차트·fear-greed 페이지는 일봉(DEFAULT_TIMEFRAME='1Day') bars를 TechnicalFactsSummary와
 * dehydrate seed로 SSR HTML에 박는다. bars Redis TTL이 장중 60초라, 가공 없이 박으면 ISR
 * 재생성마다 forming 봉의 가격이 달라 매번 ISR write가 발생한다(= $25/사이클의 주범).
 *
 * 정규장 중에는 마지막 일봉이 아직 확정되지 않았으므로(forming) 제외한다 → SSR 출력이
 * 장 마감 시 하루 1회만 변경된다. 장 마감 후·주말·휴일에는 마지막 봉이 이미 완료이므로 보존한다.
 * 클라이언트(useBars/getBarsAction)는 이 함수를 거치지 않으므로 사용자는 라이브 가격을 그대로 본다.
 */
export function quantizeBarsToLastClosed(
    bars: readonly Bar[],
    now: Date
): readonly Bar[] {
    if (bars.length === 0) return bars;
    return isEtRegularSessionOpen(now) ? bars.slice(0, -1) : bars;
}
