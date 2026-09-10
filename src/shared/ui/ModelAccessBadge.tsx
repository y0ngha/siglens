import { type ModelId } from '@y0ngha/siglens-core';
import { tryGetModelAccess } from '@/shared/lib/modelAccess';

interface ModelAccessBadgeProps {
    model: ModelId;
}

/**
 * 모델 선택 목록에서 접근 등급을 표시하는 뱃지.
 *
 * 등급이 셋(free / member / byok)이 되면서 기존 "PRO" 단일 뱃지로는 구분이
 * 안 된다 — member 모델은 로그인만으로 서버 키가 열리는 반면 byok 모델은
 * 사용자 키가 필요하고, 둘을 같은 표시로 묶으면 회원이 키를 등록해야 한다고
 * 오해한다.
 *
 * free는 뱃지를 붙이지 않는다(대다수라 노이즈만 된다).
 *
 * 문자열은 기존 "PRO" 뱃지와 마찬가지로 번역하지 않는다 — 짧은 등급 토큰이고,
 * 카탈로그에 넣으면 로케일마다 폭이 달라져 접힌 트리거 레이아웃이 흔들린다.
 */
export function ModelAccessBadge({ model }: ModelAccessBadgeProps) {
    // `getModelAccess`는 레지스트리에 없는 ID에 throw한다. 저장된 옛 모델이나
    // 배포 간 시차로 그런 값이 목록에 섞일 수 있는데, 렌더 중 throw는 뱃지 하나가
    // 아니라 모델 선택 UI 전체를 죽인다. 뱃지는 부가 정보이므로 조용히 생략한다.
    const access = tryGetModelAccess(model);
    if (access === null || access === 'free') return null;

    const isByok = access === 'byok';
    return (
        <span
            className={
                isByok
                    ? 'text-[9px] leading-none font-semibold text-ui-warning-text uppercase'
                    : 'text-[9px] leading-none font-semibold text-primary-300 uppercase'
            }
        >
            {isByok ? 'BYOK' : 'MEMBER'}
        </span>
    );
}
