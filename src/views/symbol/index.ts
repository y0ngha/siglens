// src/views/symbol barrel — 종목 페이지 컴포지션 레이어 공개 API.
// Heavy 컴포넌트(SymbolPageClient, ChartContent, MobileAnalysisSheet 등)는
// app 라우트에서 direct import. barrel은 가벼운 공용 컴포넌트만 노출.
//
// 이동 이력 (Spec-2 PR-B2):
//  - SymbolModelProvider/useSymbolModel → @/features/symbol-model
//  - CrossLinkCards → @/shared/ui/CrossLinkCards
//  - SymbolPageProvider/useSymbolPageContext — views-internal 전용(barrel 제외)

export { SymbolPageHeading } from './ui/SymbolPageHeading';
// 차트 라우트 h1 텍스트 단일 소스 — SSR fallback h1(page.tsx)과 가시 h1(SymbolPageClient)
// 일치 보장(cloaking 방지). 순수 string 헬퍼라 barrel 노출 안전.
export { CHART_PAGE_HEADING_KEY } from './utils/chartPageHeading';
// 경량 순수 컴포넌트(priceFormat/technicalFacts util만 의존) — heavy 컴포넌트 deep-import
// 정책에 해당하지 않아 barrel로 노출한다. app route의 FactLayer SSR fallback이 소비.
export { TechnicalFactsSummary } from './TechnicalFactsSummary';
// TechnicalFactsSummary와 동일한 결정적 사실 층 패턴 — fear-greed 페이지의 SSR
// 서버 계산 factor 요약. app route가 소비.
export { FearGreedFactsSummary } from './fearGreed/FearGreedFactsSummary';
// 실제 시트(dynamic ssr:false)가 하이드레이션 후에야 청크를 요청해 생기는 하단 공백을
// 메우는 서버 렌더 껍데기. app 라우트가 SSR 트리에서 직접 소비한다(SymbolPageClient는
// useSearchParams CSR-bailout이라 그 안에 두면 SSR HTML에 박히지 않는다).
export { MobileSheetPlaceholder } from './MobileSheetPlaceholder';
// 심볼 간 내부링크(연관검색어형 칩 스트립). 순수 config 조회만 하는 서버
// 컴포넌트라 barrel 노출 안전. app route가 persistent server sibling으로 소비.
export { RelatedSymbols } from './RelatedSymbols';
