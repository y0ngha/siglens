/**
 * `/methodology` "공포 탐욕 지수" — 규칙 기반 점수의 계산 방식과 네 가지 지수.
 *
 * 가중치는 공개하지 않는다. 구성 요소와 단계 경계만 밝힌다.
 */
import { EXTREME_ZONE_REENTRY_GAP } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { MethodologySectionProps } from '../../types';
import { MethodologySection } from '../layout/MethodologySection';
import { BODY_TEXT, CARD, TEXT_LINK } from '../methodologyStyles';

interface VariantLink {
    readonly href: string;
    readonly label: string;
}

interface VariantProps {
    readonly title: string;
    readonly body: string;
    /** 그 지수의 전용 페이지. 종목별 지수는 종목 페이지에만 있어 링크가 없다. */
    readonly link?: VariantLink;
}

/** 지수 하나(종목별·미국·한국·암호화폐)의 구성 요소 설명 카드. */
function Variant({ title, body, link }: VariantProps) {
    return (
        <li className={CARD}>
            <h3 className={HEADING_SUBSECTION}>{title}</h3>
            <p className="mt-2 text-sm leading-6 text-secondary-300">{body}</p>
            {link ? (
                <LocaleLink
                    href={link.href}
                    prefetch={false}
                    className={TEXT_LINK}
                >
                    {link.label}
                </LocaleLink>
            ) : null}
        </li>
    );
}

/** 점수 계산 방식, 다섯 단계 경계, 극단 구간 기록 규칙, 네 지수 카드. */
export function FearGreedSection({ t, title }: MethodologySectionProps) {
    const variants: readonly VariantProps[] = [
        { title: t('fearGreed.symbol'), body: t('fearGreed.symbolBody') },
        {
            title: t('fearGreed.us'),
            body: t('fearGreed.usBody'),
            link: { href: '/fear-greed', label: t('fearGreed.linkUs') },
        },
        {
            title: t('fearGreed.kr'),
            body: t('fearGreed.krBody'),
            link: { href: '/fear-greed/kr', label: t('fearGreed.linkKr') },
        },
        {
            title: t('fearGreed.crypto'),
            body: t('fearGreed.cryptoBody'),
            link: {
                href: '/fear-greed/crypto',
                label: t('fearGreed.linkCrypto'),
            },
        },
    ];
    return (
        <MethodologySection
            id="fear-greed"
            title={title}
            sub={t('fearGreed.sub')}
        >
            <p className={cn(BODY_TEXT, 'mt-4')}>{t('fearGreed.how')}</p>
            <p className={cn(BODY_TEXT, 'mt-3')}>{t('fearGreed.labels')}</p>
            <p className={cn(BODY_TEXT, 'mt-3')}>
                {t('fearGreed.episodes', { v0: EXTREME_ZONE_REENTRY_GAP })}
            </p>
            <ul className="mt-6 flex flex-col gap-3">
                {variants.map(variant => (
                    <Variant
                        key={variant.title}
                        title={variant.title}
                        body={variant.body}
                        link={variant.link}
                    />
                ))}
            </ul>
        </MethodologySection>
    );
}
