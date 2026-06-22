import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import Link from 'next/link';

export const CRYPTO_SHOWCASE_COUNT = 12;

const SHOWCASE = POPULAR_CRYPTOS.slice(0, CRYPTO_SHOWCASE_COUNT);

export function CryptoShowcase() {
    return (
        <section className="px-6 pb-8 lg:px-[15vw]">
            <h2 className="text-secondary-200 mb-3 text-sm font-semibold">
                인기 암호화폐
            </h2>
            <ul className="flex flex-wrap gap-2">
                {SHOWCASE.map(symbol => (
                    <li key={symbol}>
                        <Link
                            href={`/${symbol}`}
                            className="border-secondary-800 bg-secondary-800/30 text-secondary-300 hover:border-primary-600 hover:text-primary-300 focus-visible:ring-primary-500 inline-flex rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                            {symbol}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
