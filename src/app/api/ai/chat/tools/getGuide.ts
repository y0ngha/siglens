import 'server-only';
import { loadGuideCatalog } from '@/entities/guide/api';
import type { GuideEntry } from '@/entities/guide/types';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { localePath } from '@/shared/i18n/locales';
import { guideEntryPath } from '@/shared/lib/guidePaths';
import { searchGuide } from '@/shared/lib/guideSearch';
import { SITE_URL } from '@/shared/lib/seo';

/** 최상위 일치 1건의 본문 상한(문자). 문단 경계에서 자른다. */
export const GUIDE_BODY_MAX_CHARS = 3_500;
/** 검색 결과 수 — 최상위 1건 + 나머지 최대 2건. */
const GUIDE_MATCH_LIMIT = 3;

/**
 * `maxChars` 이하가 되도록 **문단(빈 줄) 경계**에서 본문을 자른다.
 *
 * 첫 문단 하나가 상한보다 길면 문단 경계가 없으니 그 문단을 문자 수로 자른다 — 빈 본문을
 * 돌려주는 것보다 낫다. 서로게이트 쌍 중간에서 끊지 않는다.
 */
export function cutAtParagraph(
    body: string,
    maxChars: number
): { text: string; truncated: boolean } {
    if (body.length <= maxChars) return { text: body, truncated: false };

    const kept: string[] = [];
    let length = 0;
    for (const paragraph of body.split(/\n{2,}/)) {
        const added = (kept.length === 0 ? 0 : 2) + paragraph.length;
        if (length + added > maxChars) break;
        kept.push(paragraph);
        length += added;
    }
    if (kept.length > 0) return { text: kept.join('\n\n'), truncated: true };

    const cut = body.slice(0, maxChars);
    const lastCode = cut.charCodeAt(cut.length - 1);
    const midPair = lastCode >= 0xd800 && lastCode <= 0xdbff;
    return { text: midPair ? cut.slice(0, -1) : cut, truncated: true };
}

/**
 * `get_guide` — Siglens 차트 가이드(캔들·차트 패턴·보조지표·전략) 검색.
 *
 * 허브 검색 UI와 같은 `searchGuide`를 쓴다. 최상위 1건만 본문을 싣고 나머지 최대 2건은
 * 제목·요약·url만 — 도구 결과 상한 안에서 모델이 근거를 인용하고 링크를 걸 수 있게 한다.
 * 요청 로케일의 번역이 없으면 카탈로그가 ko 내용으로 채워 준다. 종목·계정과 무관한 공개
 * 콘텐츠라 게스트에게도 열려 있다.
 */
export const getGuideTool: ToolExecutor = async (args, ctx) => {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (query === '') return { error: 'invalid_query' };

    const catalog = await loadGuideCatalog(ctx.locale);
    if (catalog === null) return { found: false, reason: 'guide_unavailable' };

    const matches = searchGuide(catalog.entries, query, GUIDE_MATCH_LIMIT);
    const urlOf = (entry: GuideEntry): string =>
        `${SITE_URL}${localePath(ctx.locale, guideEntryPath(entry.category, entry.slug))}`;
    const [best, ...others] = matches;
    const asOf = new Date().toISOString();

    if (best === undefined) {
        return { asOf, source: 'siglens-guide', found: false, others: [] };
    }

    const body = cutAtParagraph(best.bodyMd, GUIDE_BODY_MAX_CHARS);
    return {
        asOf,
        source: 'siglens-guide',
        found: true,
        best: {
            title: best.title,
            category: best.category,
            summary: best.summary,
            body: body.text,
            bodyTruncated: body.truncated,
            url: urlOf(best),
        },
        others: others.map(entry => ({
            title: entry.title,
            category: entry.category,
            summary: entry.summary,
            url: urlOf(entry),
        })),
    };
};
