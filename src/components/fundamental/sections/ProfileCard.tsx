import type { FundamentalProfileInput } from '@y0ngha/siglens-core';

interface ProfileCardProps {
    profile: FundamentalProfileInput;
}

export function ProfileCard({ profile }: ProfileCardProps) {
    const formattedMarketCap = new Intl.NumberFormat('ko-KR', {
        notation: 'compact',
        maximumFractionDigits: 1,
        style: 'currency',
        currency: 'USD',
    }).format(profile.marketCap);

    return (
        <section
            aria-labelledby="profile-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2
                        id="profile-heading"
                        className="text-xl font-semibold tracking-tight"
                    >
                        {profile.companyName}
                        <span className="text-secondary-400 ml-2 text-base font-normal">
                            ({profile.symbol})
                        </span>
                    </h2>
                    <p className="text-secondary-400 mt-1 text-sm">
                        {profile.sector}
                        {profile.industry ? ` / ${profile.industry}` : ''}
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-secondary-400 text-xs tracking-widest uppercase">
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
                        <dt className="text-secondary-400 w-10 shrink-0 text-sm">
                            CEO
                        </dt>
                        <dd className="text-sm">{profile.ceo}</dd>
                    </div>
                )}
                {profile.website !== null && (
                    <div className="flex gap-2">
                        <dt className="text-secondary-400 w-10 shrink-0 text-sm">
                            웹
                        </dt>
                        <dd className="text-sm">
                            <a
                                href={profile.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-secondary-100 text-secondary-400 underline underline-offset-2 transition-colors"
                                translate="no"
                            >
                                {profile.website.replace(/^https?:\/\//, '')}
                            </a>
                        </dd>
                    </div>
                )}
            </dl>

            {profile.description !== null && (
                <p className="text-secondary-400 mt-4 line-clamp-4 text-sm leading-relaxed">
                    {profile.description}
                </p>
            )}
        </section>
    );
}
