import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { grepFiles } from '@/shared/test-utils/grepSource';

/**
 * **서버 데이터를 기다리는 async 컴포넌트는 `<Suspense>`로 감싸지 않는다 — 자리별로 고정한다.**
 *
 * 서버 데이터 경계는 PPR이 꺼진 이 앱에서 이득이 없고 비용만 남는다(2026-10-05 운영 크롤):
 *
 * 1. raw HTML에 fallback 골격 + `<template>` 숨김 청크 + 교체 스크립트가 남아, JS를 실행하지
 *    않는 크롤러(Naver Yeti·Daumoa)에게 본문이 문서 끝으로 밀린다.
 * 2. 하이드레이션 때 스켈레톤이 실제 내용으로 교체되며 레이아웃이 흔들린다(CLS).
 *
 * 클라 위젯(`'use client'` + 클라 훅으로 데이터를 받는 것)의 경계는 별개다 — 그건 이 가드의
 * 대상이 아니고, 남겨 둔 자리는 아래에서 이름으로 허용한다.
 */
const APP_DIR = path.resolve(__dirname, '../../app/[locale]');

/**
 * 페이지 소스에서 주석을 걷어 낸 코드. 근거 주석이 "`<Suspense>`로 감싸지 않는다"처럼
 * 태그 이름을 그대로 적으므로, 주석을 남기면 가드가 설명문에 걸린다.
 */
function readPageCode(relativePath: string): string {
    return readFileSync(path.join(APP_DIR, relativePath), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

/** `<Suspense ...>` 여는 태그 바로 안쪽의 첫 JSX 요소 이름들. */
function suspenseChildren(source: string): string[] {
    return [...source.matchAll(/<Suspense\b[\s\S]*?>\s*<([A-Z][\w.]*)/g)].map(
        match => match[1]
    );
}

describe('홈 — 스킬 쇼케이스', () => {
    const source = readPageCode('(home)/page.tsx');

    it('Suspense 경계가 없다(쇼케이스 목록은 본문에서 스킬 개수와 함께 읽는다)', () => {
        expect(source).not.toMatch(/<Suspense\b/);
    });

    it('쇼케이스 목록을 스킬 개수와 같은 Promise.all에서 읽는다', () => {
        expect(source).toMatch(
            /Promise\.all\(\[\s*countSkillFiles\(\)[\s\S]*?loadShowcase\(\),?\s*\]\)/
        );
    });

    it('죽은 SkillsShowcaseSkeleton이 다시 생기지 않는다', () => {
        const thisFile = path.resolve(__filename);
        expect(
            grepFiles('SkillsShowcaseSkeleton', [
                path.resolve(__dirname, '../..'),
            ]).filter(file => path.resolve(file) !== thisFile)
        ).toEqual([]);
    });
});

describe('펀더멘털 탭', () => {
    const source = readPageCode('[symbol]/fundamental/page.tsx');

    it('남은 Suspense 경계는 클라 위젯 FundamentalAiSummary의 것 하나뿐이다', () => {
        expect(suspenseChildren(source)).toEqual(['FundamentalAiSummary']);
    });

    it.each([
        'ProfileSection',
        'ValuationSection',
        'PeersSection',
        'ProfitabilitySection',
        'GrowthSection',
        'FinancialHealthSection',
        'FutureDirectionSection',
    ])('%s를 본문에서 직접 렌더한다', section => {
        expect(source).toMatch(new RegExp(`<${section} symbol=\\{upper\\}`));
    });
});

/**
 * 차트 탭: `SymbolPageClient`는 `useUrlSearchParam`으로 CSR bailout 없이 서버 렌더된다. 페이지가
 * 그것을 Suspense(fallback = sr-only h1 + 사실 요약)로 감싸면, 경계가 대기 상태로 플러시될 때
 * raw HTML에 h1이 둘 남는다(e2e `symbol-seo` "exactly one h1" 실측).
 */
describe('차트 탭 페이지', () => {
    it('Suspense 경계가 없다', () => {
        expect(readPageCode('[symbol]/page.tsx')).not.toMatch(/<Suspense\b/);
    });

    /**
     * AI 패널의 사실 요약은 차트 경계 안이라 숨김 청크로 아웃라인될 수 있다 — 페이지가
     * 경계 밖 영구 사본을 싣고, CSS가 패널 사본이 있을 때만 그것을 감춘다.
     */
    it('크롤용 사실 요약 영구 사본(placement="page")과 그 중복 정리 CSS가 있다', () => {
        expect(readPageCode('[symbol]/page.tsx')).toMatch(
            /<TechnicalFactsSummary[\s\S]*?placement="page"/
        );
        const css = readFileSync(
            path.resolve(__dirname, '../../app/globals.css'),
            'utf8'
        );
        expect(css).toMatch(
            /body:has\(\[data-technical-facts='panel'\]\) \[data-technical-facts-page-slot\] \{\s*display: none;\s*\}/
        );
    });
});

describe('[symbol] 레이아웃', () => {
    it('Suspense 경계가 없다(AskAiFab은 확정된 assetInfo로 인라인 렌더)', () => {
        expect(readPageCode('[symbol]/layout.tsx')).not.toMatch(/<Suspense\b/);
    });
});
