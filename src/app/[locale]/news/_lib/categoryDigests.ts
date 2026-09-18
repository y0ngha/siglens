import { peekMarketNewsDigestStatic } from '@/entities/market-news/api/marketNewsDigestStaticCache';
import type { NewsFeedCategoryId } from '@/entities/market-news';
import type { Locale } from '@/shared/i18n/locales';

/** 카드 한 장에 얹는 최대 길이 — 두 줄을 넘기면 카드 그리드가 들쭉날쭉해진다. */
const DIGEST_SENTENCE_MAX = 90;

/**
 * 허브 카드에 얹을 **우리 자체 서술** 한 줄.
 *
 * 허브 두 곳(`/news`·`/news/us`)은 지금 카테고리 설명 한 줄 + 제3자 헤드라인
 * 3개로만 이뤄져 있어 본문이 1,100~1,200자에 그친다. 헤드라인을 더 늘리는 것은
 * 해답이 아니다 — 남의 기사 제목 비중만 커져 스크랩 콘텐츠 쪽으로 기운다
 * (2026-09 감사에서 리프 페이지의 기사 본문을 걷어낸 것과 같은 이유).
 *
 * 대신 이미 만들어 둔 카테고리 다이제스트(`currentDriverKo` — 그 카테고리 흐름을
 * 우리 모델이 요약한 문장)의 첫 문장을 얹는다. 새로 생성하지 않고 `peek`만 하므로
 * LLM 호출이 없고, 다이제스트가 없으면 `null`이라 카드가 예전 모양 그대로다.
 *
 * **목적지 페이지와 한 문장이 겹치는 것은 의도다.** 리프 카테고리 페이지는 같은
 * 다이제스트를 전문으로 싣는다. 허브 카드가 그 앞 한 문장을 발췌로 보여 주는 것은
 * 목록→본문의 일반적인 티저 패턴이고, 이 페이지가 복제하는 분량은 한 문장이다.
 * 중복이 문제가 되는 형태는 "같은 본문을 통째로 두 URL이 싣는 것"이지 발췌가 아니다.
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
                // 다이제스트는 부가 정보다 — 실패가 허브를 깨뜨리지 않는다.
                //
                // 지금은 `peekMarketNewsDigestStatic`이 내부에서 모든 에러를 잡아
                // `null`로 수렴시키므로 **이 분기는 도달하지 않는다.** 그래도 두는
                // 이유는 경계가 여기이기 때문이다 — 그 함수가 언젠가 던지게 바뀌면
                // 허브 전체가 500이 되고, 그 사고는 이 페이지의 존재 이유(내부 링크)를
                // 통째로 날린다. 값이 없어도 카드가 렌더되는 쪽이 항상 옳다.
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
