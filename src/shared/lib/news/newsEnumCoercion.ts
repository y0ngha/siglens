import type {
    NewsCategory,
    NewsImpact,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import { isNewsSentiment } from '@/shared/lib/sentimentDisplay';
import { isNewsImpact } from '@/shared/lib/news/impactDisplay';

/**
 * 뉴스 분석 컬럼의 읽기 경계 검증. DB는 이 필드를 raw text로 저장하고(CHECK 제약
 * 없음) writer를 믿지 않으므로, 읽을 때 검증해 미지값은 null로 강등한다.
 *
 * sentiment/impact 가드는 표시 테이블(`SENTIMENT_LABEL_KEY`/`IMPACT_CLASS`,
 * `Record<T, …>`)을 exhaustiveness 원천으로 쓰는 `sentimentDisplay`/`impactDisplay`의
 * 것을 그대로 쓴다 — 여기서 같은 enum 레코드를 한 벌 더 들고 있을 이유가 없다.
 * category는 표시 테이블이 없어 아래 레코드가 원천이다.
 *
 * `Record<NewsCategory, true>`는 core의 `NewsCategory`에 멤버가 추가되면 이 파일이
 * 컴파일되지 않게 해서, "유효한 값이 경계에서 조용히 null로 바뀌는" 실패를 막는다.
 */
const NEWS_CATEGORY_RECORD: Record<NewsCategory, true> = {
    earnings: true,
    m_and_a: true,
    guidance: true,
    regulation: true,
    macro: true,
    product: true,
    other: true,
};

function isNewsCategory(value: string): value is NewsCategory {
    // `in`은 프로토타입까지 본다(`'toString' in {}` → true) — 자기 키만 인정한다.
    return Object.hasOwn(NEWS_CATEGORY_RECORD, value);
}

export function toNewsSentiment(value: unknown): NewsSentiment | null {
    return isNewsSentiment(value) ? value : null;
}

export function toNewsCategory(value: unknown): NewsCategory | null {
    if (typeof value !== 'string') return null;
    return isNewsCategory(value) ? value : null;
}

export function toNewsImpact(value: unknown): NewsImpact | null {
    return isNewsImpact(value) ? value : null;
}
