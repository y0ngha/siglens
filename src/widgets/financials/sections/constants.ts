import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';

/**
 * Shared section heading className for the four financials statement sections
 * (손익계산서·재무상태표·현금흐름표·성장 분석). Centralized so the visual
 * heading style stays consistent across sections and changes in one place.
 */
export const HEADING_CLASS_NAME = cn('mb-4', HEADING_SECTION);
