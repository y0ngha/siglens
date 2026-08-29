import type { ReactNode } from 'react';
import { expect } from 'vitest';
import { FaqSection } from '@/shared/ui/FaqSection';
import type { FaqItem } from '@/shared/lib/seo';
import { findAllElementsByType } from './findElementByType';
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
    const sections = findAllElementsByType(tree, FaqSection);
    expect(sections, 'FaqSection은 한 번만 렌더돼야 한다').toHaveLength(1);
    const section = sections[0];

    const items = (section?.props as { items: readonly FaqItem[] }).items;
    expect(items.length).toBeGreaterThan(0);

    // **개수까지 본다.** 예전엔 첫 일치만 집어서, 같은 페이지에 `FaqSection`이나
    // FAQPage 블록이 두 벌 있어도 통과했다 — 이 레포가 리디자인 브랜치와
    // 구조화데이터 PR을 병합할 때 실제로 만들 뻔한 형태이고, 중복 FAQPage는
    // 구글이 스팸으로 보는 신호다. "단일 소스"라는 이름값을 하려면 한 벌임을
    // 먼저 단언해야 한다.
    const faqBlocks = collectJsonLdData(tree).filter(
        d => d['@type'] === 'FAQPage'
    );
    expect(faqBlocks, 'FAQPage JSON-LD는 한 벌이어야 한다').toHaveLength(1);
    const faqJsonLd = faqBlocks[0];

    const entities = faqJsonLd?.mainEntity as FaqQuestionNode[];
    expect(entities).toHaveLength(items.length);
    items.forEach((item, index) => {
        expect(entities[index].name).toBe(item.question);
        expect(entities[index].acceptedAnswer.text).toBe(item.answer);
    });
}
