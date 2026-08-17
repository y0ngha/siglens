import type { ReactNode } from 'react';
import type { FundamentalProfile } from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';

const HEADING_ID = 'profile-heading';
const HEADING_CLASS_NAME = 'text-xl font-semibold tracking-tight';

interface ProfileCardProps {
    profile: FundamentalProfile | null;
    descriptionSlot: ReactNode;
}

export function ProfileCard({ profile, descriptionSlot }: ProfileCardProps) {
    if (profile === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title="회사 프로필"
                headingClassName={HEADING_CLASS_NAME}
            >
                {descriptionSlot}
            </EmptySectionCard>
        );
    }

    const formattedMarketCap = new Intl.NumberFormat('ko-KR', {
        notation: 'compact',
        maximumFractionDigits: 1,
        style: 'currency',
        currency: 'USD',
    }).format(profile.marketCap);

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                        {profile.companyName}
                        <span className="ml-2 text-base font-normal text-secondary-400">
                            ({profile.symbol})
                        </span>
                    </h2>
                    <p className="mt-1 text-sm text-secondary-400">
                        {profile.sector}
                        {profile.industry ? ` / ${profile.industry}` : ''}
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-xs tracking-widest text-secondary-400 uppercase">
                        시가총액
                    </span>
                    <p className="font-mono text-lg font-medium tabular-nums">
                        {formattedMarketCap}
                    </p>
                </div>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-y-2 sm:grid-cols-2">
                {profile.ceo !== null && (
                    <div className="flex gap-2">
                        <dt className="w-10 shrink-0 text-sm text-secondary-400">
                            CEO
                        </dt>
                        <dd className="text-sm">{profile.ceo}</dd>
                    </div>
                )}
                {profile.website !== null && (
                    <div className="flex gap-2">
                        <dt className="w-10 shrink-0 text-sm text-secondary-400">
                            웹
                        </dt>
                        <dd className="text-sm">
                            <a
                                href={profile.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-sm text-secondary-400 underline underline-offset-2 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
                                translate="no"
                            >
                                {profile.website.replace(/^https?:\/\//, '')}
                            </a>
                        </dd>
                    </div>
                )}
            </dl>

            {descriptionSlot}
        </section>
    );
}
