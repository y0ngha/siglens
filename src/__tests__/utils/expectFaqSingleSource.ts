import type { ReactNode } from 'react';
import { expect } from 'vitest';
import { FaqSection } from '@/shared/ui/FaqSection';
import type { FaqItem } from '@/shared/lib/seo';
import { findElementByType } from './findElementByType';
import { collectJsonLdData } from './collectJsonLdData';

interface FaqQuestionNode {
    name: string;
    acceptedAnswer: { text: string };
}

/**
 * FAQPage 구조화데이터가 **화면에 렌더된 것과 같은 배열**에서 나왔는지 못 박는다.
 *
 * JSON-LD가 파싱된다는 것만 확인하는 테스트는 이 결함을 못 잡는다 — 종목 탭 5개가
 * 오랫동안 마크업만 내보내고 화면에는 Q&A가 없었고, 그 상태로도 스키마는 유효했다.
 * 그래서 `FaqSection`에 넘어간 items와 마크업의 `mainEntity`를 **순서까지** 대조한다.
 */
export function expectFaqSingleSource(tree: ReactNode): void {
    const section = findElementByType(tree, FaqSection);
    expect(section, 'FaqSection이 렌더되지 않았다').not.toBeNull();

    const items = (section?.props as { items: readonly FaqItem[] }).items;
    expect(items.length).toBeGreaterThan(0);

    const faqJsonLd = collectJsonLdData(tree).find(
        d => d['@type'] === 'FAQPage'
    );
    expect(faqJsonLd, 'FAQPage JSON-LD가 없다').toBeDefined();

    const entities = faqJsonLd?.mainEntity as FaqQuestionNode[];
    expect(entities).toHaveLength(items.length);
    items.forEach((item, index) => {
        expect(entities[index].name).toBe(item.question);
        expect(entities[index].acceptedAnswer.text).toBe(item.answer);
    });
}
