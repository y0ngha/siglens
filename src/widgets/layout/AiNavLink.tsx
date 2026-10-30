'use client';

import type { ComponentType } from 'react';
import {
    AiPillLink,
    AiTextLink,
    AiWordmarkLink,
    type AiLinkProps,
} from './ui/ai/AiLinkVariants';
import { useAiNavLinkTarget } from './hooks/useAiNavLinkTarget';

interface Props {
    readonly className?: string;
    /**
     * `wordmark` — 헤더 로고 락업의 "AI" 반쪽(워드마크와 같은 mono/자간 문법, 브랜드 색).
     * `pill` — 모바일 드로어의 라벨 달린 항목. `text` — 푸터 사이트맵 행의 평문 링크
     * (Beta 배지 없음). `pill`·`text`는 글자 라벨이라 ko에서 `시그렌즈 AI`를 읽고,
     * 로고의 반쪽인 `wordmark`만 `SIGLENS AI`를 유지한다.
     */
    readonly variant?: 'pill' | 'wordmark' | 'text';
}

const VARIANT_LINK: Record<
    NonNullable<Props['variant']>,
    ComponentType<AiLinkProps>
> = {
    pill: AiPillLink,
    wordmark: AiWordmarkLink,
    text: AiTextLink,
};

/**
 * ai.siglens.io 진입 링크.
 *
 * 다른 오리진이라 `LocaleLink`의 클라이언트 라우팅이 할 일이 없으므로 일반 `<a>`다.
 * ai 호스트에서는 같은 헤더가 링크 기준(`useHrefBase() !== ''`)을 둔 채 렌더되며,
 * 그것으로 링크가 스스로를 현재 페이지로 표시한다.
 */
export function AiNavLink({ className, variant = 'pill' }: Props) {
    const target = useAiNavLinkTarget();
    const Link = VARIANT_LINK[variant];
    return <Link {...target} className={className} />;
}
