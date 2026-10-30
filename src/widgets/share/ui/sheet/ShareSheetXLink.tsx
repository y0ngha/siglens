/** 공유 시트의 X 공유 행 — 게시 화면을 새 탭으로 연다. */

import { useTranslations } from 'next-intl';
import { XLogoIcon } from '../icons/shareIcons';
import { SHARE_SHEET_ROW } from '../../utils/sheetStyles';

interface ShareSheetXLinkProps {
    /** 본문·링크가 채워진 X 게시 화면 주소. */
    href: string;
}

/**
 * X 게시 화면 링크. 접근 이름은 보이는 문구 그대로다 — 음성 제어 사용자는 화면에
 * 보이는 글자를 말해 누르므로, 다른 문구로 덮으면 그 말이 링크에 닿지 않는다.
 */
export function ShareSheetXLink({ href }: ShareSheetXLinkProps) {
    const t = useTranslations('widgets.share');

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={SHARE_SHEET_ROW}
        >
            <XLogoIcon className="size-5" />
            <span>{t('ShareSheet.4cb3cd')}</span>
        </a>
    );
}
