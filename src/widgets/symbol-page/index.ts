// symbol-page widget barrel — public API for cross-widget consumers.
// Heavy components (SymbolPageClient, ChartContent, MobileAnalysisSheet, etc.)
// are imported directly by app routes, not re-exported here, to keep the
// barrel tree-shake-friendly and avoid Jest ESM resolution issues.

export { SymbolPageProvider, useSymbolPageContext } from './SymbolPageContext';
export { SymbolModelProvider, useSymbolModel } from './SymbolModelContext';

export { CrossLinkCards } from './CrossLinkCards';
export { SymbolPageHeading } from './ui/SymbolPageHeading';
// 차트 라우트 h1 텍스트 단일 소스 — SSR fallback h1(page.tsx)과 가시 h1(SymbolPageClient)
// 일치 보장(cloaking 방지). 순수 string 헬퍼라 barrel 노출 안전.
export { buildChartPageHeading } from './utils/chartPageHeading';
// 경량 순수 컴포넌트(priceFormat/technicalFacts util만 의존) — heavy 컴포넌트 deep-import
// 정책에 해당하지 않아 barrel로 노출한다. app route의 FactLayer SSR fallback이 소비.
export { TechnicalFactsSummary } from './TechnicalFactsSummary';

// useAssetInfo, useBars, useDefaultModelId는 여기에 re-export하지 않는다:
// 서버 사이드 의존성(entity actions → @google/genai ESM)이 Jest 모듈 해석을 깨뜨림.
// cross-widget 소비자는 deep path로 직접 import한다.
