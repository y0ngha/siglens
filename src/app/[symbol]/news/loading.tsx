const SKELETON_SECTION_COUNT = 5;

export default function NewsLoading() {
    return (
        <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
            {[...Array(SKELETON_SECTION_COUNT)].map((_, i) => (
                <div
                    key={i}
                    className="bg-secondary-700 h-32 w-full animate-pulse rounded-xl motion-reduce:animate-none"
                    aria-hidden="true"
                />
            ))}
        </main>
    );
}
