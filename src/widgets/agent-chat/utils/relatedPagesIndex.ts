import {
    relatedSymbolPages,
    type RelatedSymbolPage,
} from '@/features/agent-chat/lib/relatedSymbolPages';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';

export interface RelatedPagesIndex {
    readonly pagesById: ReadonlyMap<string, RelatedSymbolPage[]>;
    /** 대화 전체 심볼(중복 제거·정렬) — 라벨 쿼리 키로 쓰이므로 순서가 프레임마다 같아야 한다. */
    readonly symbols: readonly string[];
}

/**
 * 끝난 답변의 링크 계산 결과를 **메시지 객체별로** 기억한다. 스트리밍 중에는 마지막
 * 말풍선만 새 객체가 되고(`patchLast`) 앞 답변들은 같은 객체로 남으므로, 매 프레임
 * 렌더에서도 다시 계산되는 건 없다. 객체가 버려지면 항목도 함께 사라진다(WeakMap).
 * 같은 입력에 같은 결과를 돌려주는 메모이즈라 호출부 입장에서는 순수 함수다.
 */
const relatedPagesCache = new WeakMap<AgentUiMessage, RelatedSymbolPage[]>();

function pagesFor(message: AgentUiMessage): RelatedSymbolPage[] {
    const cached = relatedPagesCache.get(message);
    if (cached) return cached;
    const pages = relatedSymbolPages(message.tools);
    relatedPagesCache.set(message, pages);
    return pages;
}

/**
 * 끝난 답변마다의 "siglens에서 보기" 링크와 대화 전체 심볼. 표시 이름은 답변마다 묻지
 * 않고 대화 전체 심볼을 모아 한 번에 묻는다(긴 대화를 열 때 답변 수만큼 POST가 줄 서지
 * 않게).
 */
export function relatedPagesOf(
    messages: readonly AgentUiMessage[]
): RelatedPagesIndex {
    const pagesById = new Map(
        messages
            .filter(
                m =>
                    m.role === 'assistant' &&
                    m.status !== 'streaming' &&
                    m.content !== ''
            )
            .map(m => [m.id, pagesFor(m)] as const)
    );
    const symbols = [
        ...new Set(
            [...pagesById.values()].flatMap(pages =>
                pages.map(page => page.symbol)
            )
        ),
    ].toSorted();
    return { pagesById, symbols };
}
