import type { PatternResult } from '@/domain/types';

export const isDetectedAndVisible = (p: PatternResult): boolean =>
    p.detected && (p.renderConfig?.show ?? false);
