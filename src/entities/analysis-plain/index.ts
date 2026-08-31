// analysis-plain 배럴 — 외부 소비자용 public API.

export { rewriteToPlainLanguage } from './api';
export { tryReadPlainModelConfig } from './lib/plainModel';
export { collectFacts, collectNumbers } from './lib/collectFacts';
export type { PlainFacts, CurrencyCode } from './lib/collectFacts';
export { dropSupersededPaths } from './lib/supersededPaths';
export { buildPlainPrompt, PLAIN_PROMPT_VERSION } from './lib/buildPlainPrompt';
export {
    buildAllowedNumbers,
    describeFailure,
    findUnsupportedNumbers,
    guardPlainText,
} from './lib/guardPlainText';
export type { PlainGuardFailure } from './lib/guardPlainText';
