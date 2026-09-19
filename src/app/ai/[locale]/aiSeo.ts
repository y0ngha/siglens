import type { Metadata } from 'next';
import {
    AI_SITE_URL,
    type AiIndexablePath,
    type AiSeoCopy,
} from '@/shared/config/aiHost';
import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import {
    DEFAULT_LOCALE,
    LOCALES,
    LOCALE_HREFLANG,
    LOCALE_OG,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { ORGANIZATION_JSON_LD_ID, SITE_NAME, SITE_URL } from '@/shared/lib/seo';

/** Product name as it appears in titles, cards and structured data. */
export const AI_PRODUCT_NAME = 'SIGLENS AI';

export type { AiSeoCopy };

/** Absolute ai-host URL of `path` in `locale` (`/` is the chat home). */
export function aiUrl(locale: Locale, path: string): string {
    return `${AI_SITE_URL}${localePath(locale, path)}`;
}

export function aiHomeUrl(locale: Locale): string {
    return aiUrl(locale, '/');
}

/**
 * Metadata for the SiglensAI landing (`/`, per locale) — one of the ai host's
 * public, indexable pages (`AI_INDEXABLE_PATHS`: `/` and `/about`). Uses the same locale gate as the main
 * site's static pages, so an un-gated locale is `noindex` and gets no hreflang
 * cluster (a cluster of one is not a cluster).
 *
 * Conversations (`/c/*`) never go through here: they are private and `noindex`.
 */
export function buildAiHomeMetadata(locale: Locale, copy: AiSeoCopy): Metadata {
    return buildAiPageMetadata(locale, '/', copy);
}

/**
 * Same as the landing, for `/about` (spec
 * `docs/superpowers/specs/2026-09-19-ai-about-page-design.md`): the page
 * explains how SIGLENS AI answers, so it targets "how it works" queries while
 * the home keeps "stock AI chatbot" — two pages, two intents.
 */
export function buildAiAboutMetadata(
    locale: Locale,
    copy: AiSeoCopy
): Metadata {
    return buildAiPageMetadata(locale, '/about', copy);
}

function buildAiPageMetadata(
    locale: Locale,
    path: AiIndexablePath,
    copy: AiSeoCopy
): Metadata {
    const indexable = STATIC_INDEXABLE_LOCALES.includes(locale);
    const languages: Record<string, string> = {};
    if (STATIC_INDEXABLE_LOCALES.length > 1) {
        for (const l of LOCALES) {
            if (STATIC_INDEXABLE_LOCALES.includes(l))
                languages[LOCALE_HREFLANG[l]] = aiUrl(l, path);
        }
        languages['x-default'] = aiUrl(DEFAULT_LOCALE, path);
    }
    const image = {
        url: `${AI_SITE_URL}/api/ai/og?locale=${locale}`,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: copy.ogLabel,
    };
    return {
        title: { absolute: copy.title },
        description: copy.description,
        applicationName: AI_PRODUCT_NAME,
        alternates: {
            canonical: aiUrl(locale, path),
            ...(Object.keys(languages).length > 0 ? { languages } : {}),
        },
        robots: indexable
            ? { index: true, follow: true }
            : { index: false, follow: true },
        openGraph: {
            type: 'website',
            siteName: AI_PRODUCT_NAME,
            title: copy.title,
            description: copy.description,
            url: aiUrl(locale, path),
            locale: LOCALE_OG[locale],
            images: [image],
        },
        twitter: {
            card: 'summary_large_image',
            title: copy.title,
            description: copy.description,
            images: [image.url],
        },
    };
}

/**
 * `WebApplication` node tied into the main site's entity graph through the
 * shared `Organization` `@id` — SiglensAI is a product of siglens, not a
 * separate publisher.
 */
export function buildAiHomeJsonLd(
    locale: Locale,
    copy: AiSeoCopy
): Record<string, unknown> {
    const siteName = SITE_NAME.toUpperCase();
    return {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        '@id': `${aiHomeUrl(locale)}#webapplication`,
        name: AI_PRODUCT_NAME,
        alternateName: `${SITE_NAME} AI`,
        description: copy.description,
        url: aiHomeUrl(locale),
        inLanguage: LOCALE_HREFLANG[locale],
        applicationCategory: 'FinanceApplication',
        applicationSubCategory: 'Stock and crypto AI chatbot',
        operatingSystem: 'Web',
        // A cross-domain `@id` alone is not resolved by Google: the node has to
        // carry its own name and URL to mean anything on this page.
        isPartOf: {
            '@type': 'WebSite',
            '@id': `${SITE_URL}#website`,
            name: siteName,
            url: SITE_URL,
        },
        publisher: {
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
            name: siteName,
            url: SITE_URL,
        },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    };
}
