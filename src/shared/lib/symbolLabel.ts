/** 이름을 아는 종목은 `자산명 (티커)`, 모르면(또는 이름이 티커 그대로면) 티커만. */
export function symbolLabel(
    symbol: string,
    name: string | null | undefined
): string {
    return !name || name === symbol ? symbol : `${name} (${symbol})`;
}
