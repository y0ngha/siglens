export function formatUsdPrice(price: number): string {
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// "$123.45" 형식 (Intl currency style, 소수점 2자리 고정).
const USD_CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatUsdCurrency(price: number): string {
    return USD_CURRENCY_FORMATTER.format(price);
}
