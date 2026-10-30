/**
 * 상한 때문에 목록에서 뺀 항목이 있음을 알리는 작은 안내 한 줄.
 */
import type { ReactNode } from 'react';

/** 문구는 호출부가 목록 종류에 맞는 완결 문장 키로 만들어 넘긴다(건수는 로케일 표기로 보간). */
export function OmittedNote({ children }: { readonly children: ReactNode }) {
    return <p className="mt-2 text-xs text-secondary-400">{children}</p>;
}
