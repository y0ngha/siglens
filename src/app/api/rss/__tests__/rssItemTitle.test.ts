import { describe, expect, it } from 'vitest';
import { rssItemTitle } from '../rssItemTitle';

describe('rssItemTitle', () => {
    it('표면 이름 뒤에 스탬프 시각의 KST 날짜를 붙인다', () => {
        expect(
            rssItemTitle('미국 시장 브리핑', new Date('2026-10-05T01:00:00Z'))
        ).toBe('미국 시장 브리핑 — 10월 5일');
    });

    it('UTC 15시 이후는 KST로 다음 날이다', () => {
        expect(
            rssItemTitle('미국 시장 브리핑', new Date('2026-10-05T15:30:00Z'))
        ).toBe('미국 시장 브리핑 — 10월 6일');
    });

    it('월·일의 앞자리 0을 쓰지 않는다', () => {
        expect(
            rssItemTitle('거시 경제 브리핑', new Date('2026-01-02T00:00:00Z'))
        ).toBe('거시 경제 브리핑 — 1월 2일');
    });
});
