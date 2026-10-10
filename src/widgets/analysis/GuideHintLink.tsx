import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';

interface GuideHintLinkProps {
    /** 가이드 항목 경로(로케일 접두사 없음). */
    href: string;
    /** 링크가 설명하는 항목의 표시 이름 — 같은 문구 링크가 여럿이라 접근성 이름에 실린다. */
    name: string;
}

/**
 * 분석 카드의 "뜻 보기" — 그 패턴·전략·신호를 설명하는 차트 가이드 항목으로 가는 같은 탭 링크.
 *
 * 아코디언 헤더의 `<button>` 안에 넣지 않는다(링크를 버튼 안에 중첩하면 키보드·스크린리더가
 * 어느 쪽을 활성화하는지 모호해진다). 펼친 본문 맨 아래에 별도 링크로 둔다. 보이는 문구
 * "뜻 보기"를 그대로 포함한 접근성 이름이라 음성 제어에서도 같은 말로 부를 수 있다.
 */
export function GuideHintLink({ href, name }: GuideHintLinkProps) {
    const t = useTranslations('widgets.analysis');
    return (
        <Link
            href={href}
            prefetch={false}
            aria-label={t('GuideHintLink.aria', { name })}
            className="inline-flex min-h-6 w-fit items-center gap-1 rounded text-xs font-medium text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {t('GuideHintLink.label')}
            <ArrowRightIcon className="size-3" />
        </Link>
    );
}

/**
 * 분석 패널 하단의 차트 가이드 진입 링크 — 패널에 한 줄만 둔다. 항목별 "뜻 보기"가 없는
 * 캔들 패턴(차트 캔버스 마커)이나 용어 전반을 찾아보려는 사람을 가이드 허브로 보낸다.
 */
export function GuideEntryLink() {
    const t = useTranslations('widgets.analysis');
    return (
        <Link
            href={GUIDE_PATH}
            prefetch={false}
            className="inline-flex min-h-6 w-fit items-center gap-1 rounded text-xs text-secondary-400 transition-colors hover:text-primary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {t('GuideHintLink.entry')}
            <ArrowRightIcon className="size-3" />
        </Link>
    );
}
