import { SectionSkeleton } from '@/components/symbol-page/SectionSkeleton';

// Matches the typical expiration-chip rendering on this page (4 weekly + monthly + 'all').
const EXPIRATION_CHIP_SKELETON_COUNT = 6;
// One per loaded section: AI analysis card, metrics row, OI chart + chain table block.
const SECTION_SKELETON_COUNT = 3;

export default function OptionsLoading() {
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            <div className="flex gap-2">
                {Array.from({ length: EXPIRATION_CHIP_SKELETON_COUNT }).map(
                    (_, i) => (
                        <div
                            key={i}
                            className="bg-secondary-700 h-7 w-16 animate-pulse rounded-full"
                        />
                    )
                )}
            </div>
            {Array.from({ length: SECTION_SKELETON_COUNT }).map((_, i) => (
                <SectionSkeleton key={i} />
            ))}
        </main>
    );
}
