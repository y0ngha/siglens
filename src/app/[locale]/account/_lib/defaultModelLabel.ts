import { isActiveModelId } from '@/shared/lib/isActiveModelId';
import { getModelDisplay } from '@/shared/lib/modelDisplay';

/**
 * 계정 페이지 "API 기본 모델" 폼에 보여 줄 현재 모델 이름. 미설정이거나 저장된 값이 더 이상
 * 제공하지 않는 모델이면 `null` — 폼이 "미설정"으로 그린다(없는 모델 이름을 지어내지 않는다).
 */
export function defaultModelLabel(model: string | null): string | null {
    if (model === null || !isActiveModelId(model)) return null;
    return getModelDisplay(model).fullName;
}
