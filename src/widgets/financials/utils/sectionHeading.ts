/**
 * 재무제표 섹션 제목의 공통 클래스.
 */
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';

/**
 * 네 재무제표 섹션(손익계산서·재무상태표·현금흐름표·성장 분석)이 공유하는 제목 className.
 * 한 곳에 두어 섹션 간 제목 스타일이 어긋나지 않게 한다.
 */
export const HEADING_CLASS_NAME = cn('mb-4', HEADING_SECTION);
