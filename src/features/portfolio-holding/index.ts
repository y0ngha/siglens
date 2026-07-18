// portfolio-holding feature barrel — symbol-page header holding chip 공개 API.
export { PortfolioChipMounted } from './ui/PortfolioChipMounted';
// useSymbolHolding은 views/symbol의 useAnalysis가 personalized-analysis-by-position-bucket
// spec(Subsystem C)의 holding-change 재분석 트리거로 직접 소비한다.
export {
    useSymbolHolding,
    type UseSymbolHoldingReturn,
} from './hooks/useSymbolHolding';
