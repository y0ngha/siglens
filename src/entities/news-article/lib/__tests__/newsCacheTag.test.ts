import { describe, expect, it } from 'vitest';
import { newsCacheTag } from '@/entities/news-article/lib/newsCacheTag';

describe('newsCacheTag', () => {
    it('대소문자가 섞인 입력을 대문자 티커 태그로 정규화한다', () => {
        expect(newsCacheTag('aApl')).toBe('news:AAPL');
    });

    it('캐시 태깅 쪽(페이지 upper)과 무효화 쪽(원시 입력)이 같은 태그를 만든다', () => {
        // 페이지는 URL 세그먼트를 upper-case한 뒤 태깅하고, 무효화 경로는 액션/크론이
        // 받은 원시 심볼을 그대로 넘긴다 — 두 경로의 태그가 갈라지면 revalidateTag가 빗나간다.
        const raw = 'brk.b';
        const taggedByPage = newsCacheTag(raw.toUpperCase());
        const revalidatedByAction = newsCacheTag(raw);
        expect(revalidatedByAction).toBe(taggedByPage);
        expect(taggedByPage).toBe('news:BRK.B');
    });
});
