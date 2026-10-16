import type { Bar } from '@y0ngha/siglens-core';

/** 결정적 일봉 시계열(시드 고정 LCG) — 지표가 의미 있는 값을 내도록 추세와 잡음을 섞는다. */
export function makeDailyBars(count: number, startPrice = 150): Bar[] {
    let seed = 20_261_016;
    const random = (): number => {
        seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
        return seed / 4_294_967_296;
    };
    const start = 1_700_000_000;
    let price = startPrice;
    return Array.from({ length: count }, (_, i) => {
        const open = price;
        price = price * (1 + Math.sin(i / 9) * 0.01 + (random() - 0.5) * 0.02);
        return {
            time: start + i * 86_400,
            open: Number(open.toFixed(2)),
            high: Number((Math.max(open, price) * 1.005).toFixed(2)),
            low: Number((Math.min(open, price) * 0.995).toFixed(2)),
            close: Number(price.toFixed(2)),
            volume: Math.floor(1_000_000 + random() * 50_000_000),
        };
    });
}
