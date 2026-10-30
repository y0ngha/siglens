/** 공유할 분석이 없는 탭에서 공유 버튼 아래에 뜨는 안내. */

import { useTranslations } from 'next-intl';

interface ShareUnavailableNoticeProps {
    /** 공유 버튼의 `aria-describedby`가 가리키는 id. */
    id: string;
    visible: boolean;
}

/**
 * 상태 영역(`role="status"`)은 늘 마운트해 두고 문구만 넣고 뺀다. 내용과 함께 새로
 * 삽입된 live region은 스크린리더가 읽지 않아, 버튼을 눌러도 안내가 들리지 않는다.
 * 빈 영역은 폭이 내용에 맞춰지는 절대 배치라 비어 있을 때는 크기가 없어 레이아웃·클릭에
 * 끼어들지 않는다.
 */
export function ShareUnavailableNotice({
    id,
    visible,
}: ShareUnavailableNoticeProps) {
    const t = useTranslations('widgets.share');

    return (
        <div
            id={id}
            role="status"
            className="absolute top-full right-0 z-50 mt-1 w-max max-w-xs"
        >
            {visible && (
                <p className="rounded-lg border border-secondary-700 bg-secondary-900 px-3 py-2 text-xs text-secondary-400 shadow-lg">
                    {t('ShareButton.30b27f')}
                </p>
            )}
        </div>
    );
}
