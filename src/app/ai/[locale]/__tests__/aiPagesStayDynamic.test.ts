import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 두 ai 페이지는 쿠키로 갈리는 응답(로그인 흔적이 있으면 핸드오프 307, 없으면 익명 랜딩 200)을
 * 낸다. `force-dynamic`이 빠져 정적/ISR이 되면 한쪽 응답이 공유 캐시에 저장돼 다른 방문자에게
 * 나간다 — 그리고 `Vary`로 가르는 방식은 URL 퍼지가 안 된다. 그래서 `private, no-store`로
 * 고정하고, 이 소스 스캔이 그 선언을 지킨다.
 */
const AI_DIR = path.resolve(process.cwd(), 'src/app/ai/[locale]');
const PAGES = ['page.tsx', 'c/[id]/page.tsx'];

describe('ai pages stay force-dynamic', () => {
    it.each(PAGES)('%s declares dynamic = force-dynamic', file => {
        const source = readFileSync(path.join(AI_DIR, file), 'utf8');
        expect(source).toMatch(/^export const dynamic = 'force-dynamic';$/m);
    });

    it.each(PAGES)('%s calls maybeHandoffRedirect', file => {
        const source = readFileSync(path.join(AI_DIR, file), 'utf8');
        expect(source).toContain('maybeHandoffRedirect(');
    });
});
