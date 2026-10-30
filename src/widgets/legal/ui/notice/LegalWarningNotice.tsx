import type { ReactNode } from 'react';

interface LegalWarningNoticeProps {
    /** `note`: 읽어 둘 안내(번역 대체) · `status`: 본문 대신 나가는 상태 안내. */
    readonly role: 'note' | 'status';
    /** 랜드마크 이름. 안내에 보이는 제목이 없으므로 무엇에 관한 안내인지 적는다. */
    readonly label: string;
    readonly children: ReactNode;
}

/**
 * 약관 페이지의 경고 톤 안내 상자. 번역 대체 안내와 본문 불러오기 실패 안내가
 * 같은 모양을 쓴다.
 */
export function LegalWarningNotice({
    role,
    label,
    children,
}: LegalWarningNoticeProps) {
    return (
        <div
            role={role}
            aria-label={label}
            className="my-8 rounded-lg border border-ui-warning/30 bg-ui-warning/5 p-4"
        >
            <p className="text-sm leading-relaxed text-secondary-200">
                {children}
            </p>
        </div>
    );
}
