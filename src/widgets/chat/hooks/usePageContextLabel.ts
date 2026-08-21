'use client';

import { useTranslations } from 'next-intl';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { deriveLabelKey } from '@/entities/chat-message';

/** Localized page-context label for the current pathname; `null` on non-symbol pages. */
export function usePageContextLabel(): string | null {
    // `derivePageContextLabel`의 정규식은 `^/SYMBOL(/subpage)?$`로 앵커돼 있다.
    // 로케일 세그먼트가 붙으면 매칭이 통째로 실패해 챗의 페이지 컨텍스트 라벨이
    // 비-ko 사용자에게서 항상 null이 된다.
    const pathname = useAppPathname();
    const t = useTranslations('entities.chat-message.pageContext');
    const key = deriveLabelKey(pathname);
    return key === null ? null : t(key);
}
