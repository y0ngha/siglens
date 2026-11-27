import {
    isHubGuide,
    SIGNAL_HUBS,
    type SignalHub,
} from '@/entities/signal-history/lib/signalHubs';

/**
 * 이 가이드 항목을 설명 문서로 삼는 신호 페이지들 — 항목 자신만 본다(`hubSlugsFor`와 달리 howto의 `about`
 * 항목은 따라가지 않는다). 이동평균선 가이드는 골든크로스·데드크로스 둘을 돌려준다. 없으면 `[]`.
 */
export function hubsForGuide(entry: {
    readonly category: string;
    readonly slug: string;
}): readonly SignalHub[] {
    return SIGNAL_HUBS.filter(hub => isHubGuide(hub, entry));
}
