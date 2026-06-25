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
export { buildChartPageHeading } from './utils/chartPageHeading';
// 경량 순수 컴포넌트(priceFormat/technicalFacts util만 의존) — heavy 컴포넌트 deep-import
// 정책에 해당하지 않아 barrel로 노출한다. app route의 FactLayer SSR fallback이 소비.
export { TechnicalFactsSummary } from './TechnicalFactsSummary';
