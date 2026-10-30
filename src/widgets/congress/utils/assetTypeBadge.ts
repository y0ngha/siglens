/** Maps FMP's free-form `assetType` strings onto the closed set of badge catalog keys. */

/**
 * Case-insensitive substring match instead of equality: FMP ships free-form
 * strings (e.g. "Stock", "Stock Option") and may tweak labels. "option" is
 * checked first because "Stock Option" contains both words.
 */
export function assetTypeBadgeKey(
    assetType: string
): 'option' | 'stock' | 'other' {
    const lower = assetType.toLowerCase();
    if (lower.includes('option')) return 'option';
    if (lower.includes('stock')) return 'stock';
    return 'other';
}
