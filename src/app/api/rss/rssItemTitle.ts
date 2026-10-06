import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';

/** 피드는 한국어 전용이다 — 로케일과 타임존을 고정한다. */
const FEED_LOCALE = 'ko-KR';
const FEED_TIME_ZONE = 'Asia/Seoul';

/**
 * 항목 제목 = 표면 이름 + **KST 날짜** — `미국 시장 브리핑 — 10월 5일`.
 *
 * 같은 제목이 매일 올라오면 리더에서 어느 날 글인지 구분되지 않는다. 날짜는 스탬프 시각
 * (`pubDate` = 이 본문이 처음 확인된 시각)의 한국 날짜다 — 피드가 한국어 전용이고 브리핑이
 * 한국 독자 기준으로 나오므로 로케일(`ko-KR`)과 타임존(`Asia/Seoul`)을 고정한다.
 * 월(`long`)·일(`numeric`) 조합은 `scripts/assert-icu-locale.mjs`가 이미 이미지 단위로
 * 검증하는 옵션이라(`ko-KR` ICU 회귀 가드) 출력이 `10월 5일`로 고정된다.
 */
export function rssItemTitle(title: string, at: Date): string {
    const date = cachedDateTimeFormat(FEED_LOCALE, {
        timeZone: FEED_TIME_ZONE,
        month: 'long',
        day: 'numeric',
    }).format(at);
    return `${title} — ${date}`;
}
