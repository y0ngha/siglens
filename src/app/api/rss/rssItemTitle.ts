import { kstDateKey } from '@/shared/lib/etTimeUtils';

/**
 * 항목 제목 = 표면 이름 + **KST 날짜** — `미국 시장 브리핑 — 10월 5일`.
 *
 * 같은 제목이 매일 올라오면 리더에서 어느 날 글인지 구분되지 않는다. 날짜는 스탬프 시각
 * (`pubDate` = 이 본문이 처음 확인된 시각)의 한국 날짜다 — 피드가 한국어 전용이고 브리핑이
 * 한국 독자 기준으로 나오므로 KST로 고정한다. `Date`를 포맷터에 넘기지 않고 날짜 키를
 * 분해해 ICU 버전에 따른 표기 차이를 피한다.
 */
export function rssItemTitle(title: string, at: Date): string {
    const [, month, day] = kstDateKey(at).split('-');
    return `${title} — ${Number(month)}월 ${Number(day)}일`;
}
