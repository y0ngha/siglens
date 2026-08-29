// analysis-translation 배럴 — 외부 소비자용 public API.

export { translateAnalysisForLocale } from './api';
export { translateAnalysis } from './lib/translateAnalysis';
export type { TranslateBatch } from './lib/translateAnalysis';
export { extractProse, applyProse } from './lib/proseFields';
export type { ProseEntry } from './lib/proseFields';
