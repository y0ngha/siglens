import { peekMarketNewsDigestStatic } from '@/entities/market-news/api/marketNewsDigestStaticCache';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import type { Locale } from '@/shared/i18n/locales';

/** 카드 한 장에 얹는 최대 길이 — 두 줄을 넘기면 카드 그리드가 들쭉날쭉해진다. */
const DIGEST_SENTENCE_MAX = 90;

/**
 * 허브 카드에 얹을 **우리 자체 서술** 한 줄(카테고리 순서와 같은 순서, 없으면 `null`).
 *
 * 허브 본문은 카테고리 설명 + 제3자 헤드라인뿐이라 얇다. 헤드라인을 늘리면 남의 기사 제목
 * 비중만 커져 스크랩 콘텐츠 쪽으로 기운다. 대신 이미 만들어 둔 카테고리 다이제스트
 * (`currentDriverKo` — 그 카테고리 흐름을 우리 모델이 요약한 문장)의 첫 문장을 얹는다.
 * `peek`만 하므로 LLM 호출이 없고, 다이제스트가 없으면 카드가 기본 모양 그대로다.
 *
 * 목적지 페이지와 한 문장이 겹치는 것은 의도다 — 리프 페이지가 같은 다이제스트를 전문으로
 * 싣고, 허브는 그 앞 한 문장을 발췌로 보여 주는 티저다. 중복이 문제가 되는 형태는 같은
 * 본문을 통째로 두 URL이 싣는 것이다.
 */
export async function fetchCategoryDigestLines(
    categories: readonly NewsFeedCategoryId[],
    locale: Locale
): Promise<readonly (string | null)[]> {
    return Promise.all(
        categories.map(async category => {
            try {
                const digest = await peekMarketNewsDigestStatic(
                    category,
                    locale
                );
                return firstSentence(digest?.currentDriverKo);
            } catch {
                // 다이제스트는 부가 정보다 — 실패가 허브를 깨뜨리지 않는다. 지금은
                // `peekMarketNewsDigestStatic`이 내부에서 에러를 `null`로 수렴시키지만, 경계가
                // 여기라 그 계약이 바뀌어도 허브 전체가 500이 되지 않게 둔다.
                return null;
            }
        })
    );
}

/**
 * 첫 문장만 잘라 낸다. 길면 자르되 **말줄임표를 붙이지 않는다** — 잘린 문장에
 * `…`를 붙이면 카드가 "이어지는 내용이 이 링크 너머에 있다"고 약속하는데,
 * 목적지 페이지의 다이제스트는 같은 문장으로 시작할 뿐 이어지는 글이 아니다.
 */
function firstSentence(text: string | undefined): string | null {
    if (!text) return null;
    const trimmed = text.trim();
    if (trimmed === '') return null;
    const end = trimmed.search(/[.!?。]\s|[.!?。]$/);
    const sentence = end === -1 ? trimmed : trimmed.slice(0, end + 1);
    if (sentence.length <= DIGEST_SENTENCE_MAX) return sentence;
    // 상한에서 **공백까지 되감아** 자른다. 말줄임표를 안 붙이기로 했으므로(위 주석),
    // 단어 중간에서 끊기면 의도한 요약이 아니라 깨진 문장으로 읽힌다.
    const cut = sentence.slice(0, DIGEST_SENTENCE_MAX);
    const lastSpace = cut.lastIndexOf(' ');
    return (
        lastSpace > DIGEST_SENTENCE_MAX / 2 ? cut.slice(0, lastSpace) : cut
    ).trimEnd();
}
