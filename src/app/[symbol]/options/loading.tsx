import { SectionSkeleton } from '@/components/symbol-page/SectionSkeleton';

export default function OptionsLoading() {
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="bg-secondary-700 h-7 w-16 animate-pulse rounded-full"
                    />
                ))}
            </div>
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
        </main>
    );
}
