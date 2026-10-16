import { useTranslations } from 'next-intl';

export type CollectingVariant =
    | 'institutional'
    | 'short'
    | 'failsToDeliver'
    | 'filings';

interface CollectingNoticeProps {
    /** 어느 구간의 안내인지 — 문구가 다르다. */
    readonly variant: CollectingVariant;
}

/**
 * "데이터를 모으는 중" 안내 — 수집 파이프라인이 초기 수집을 끝내기 전에 "데이터 없음"을 대신한다. "데이터 없음"은
 * "이 종목에는 데이터가 없다"로 읽히지만 이 시점의 빈 구간은 "아직 못 모았다"이기 때문이다.
 *
 * 모양은 둥근 모서리의 차분한 정보 상자(`bg-secondary-700/40`, 부분 집계 안내 `partialNote`와 같은 톤)이고, 안에 제목 한 줄과
 * 본문 설명(작은 글씨, 좁은 화면에서는 줄바꿈)이 `p-4` 안쪽 여백으로 쌓인다 — 기존 "데이터 없음" 한 줄 문장보다 두 줄 분량 높다.
 * 서버 렌더되는 정적 텍스트이고(클라이언트 전용 브리지 없음) 높이가 SSR 시점에 정해져 있어 하이드레이션·상태 전환으로 레이아웃이
 * 움직이지 않는다(CLS 없음). 날짜는 약속하지 않는다.
 */
export function CollectingNotice({ variant }: CollectingNoticeProps) {
    const t = useTranslations('widgets.investor-flows');
    // 리터럴 `t()` 호출로 만들어 두고 고른다(추출기가 키를 볼 수 있게).
    const texts: Record<CollectingVariant, { title: string; body: string }> = {
        institutional: {
            title: t('collecting.institutional.title'),
            body: t('collecting.institutional.body'),
        },
        short: {
            title: t('collecting.short.title'),
            body: t('collecting.short.body'),
        },
        failsToDeliver: {
            title: t('collecting.failsToDeliver.title'),
            body: t('collecting.failsToDeliver.body'),
        },
        filings: {
            title: t('collecting.filings.title'),
            body: t('collecting.filings.body'),
        },
    };
    const { title, body } = texts[variant];
    return (
        <div
            role="note"
            data-testid={`flows-collecting-${variant}`}
            className="rounded-lg bg-secondary-700/40 p-4"
        >
            <p className="text-sm font-medium text-secondary-100">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-secondary-300">
                {body}
            </p>
        </div>
    );
}
