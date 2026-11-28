import {
    ADSENSE_ENABLED,
    ADSENSE_PUBLISHER_ID,
    ADSENSE_SLOTS,
} from '@/shared/lib/adsense';

/**
 * 광고 자리. `symbol-bottom`은 `/[symbol]` 9개 탭 공통(관련 종목 칩 뒤), `fear-greed`는 게이지 다음,
 * `news`는 AI 뉴스 요약 다음, `guide`는 가이드 글 본문 앞부분 다음이다. 모두 첫 화면 아래나 끝 근처다.
 */
export type AdPlacement = 'symbol-bottom' | 'fear-greed' | 'news' | 'guide';

export interface AdSize {
    readonly width: number;
    readonly height: number;
}

export interface AdPlacementConfig {
    readonly slotId: string;
    /**
     * `eager`: 첫 화면 끝 근처라 사람 입력 직후 바로 요청한다.
     * `lazy`: 화면 한 개 높이 안으로 다가왔을 때 요청한다(보이지 않는 노출을 줄여 가시성을 지킨다).
     */
    readonly load: 'eager' | 'lazy';
    /** 768px 미만. */
    readonly mobile: AdSize;
    /** 768px 이상. 가이드는 본문 폭이 42rem이라 728을 못 쓴다. */
    readonly desktop: AdSize;
    /**
     * 예약 상자 높이. 위 두 크기와 같은 값을 Tailwind 리터럴로 둔다 — 서버 HTML에서 자리를 잡아야
     * 화면 밀림(CLS)이 없고, Tailwind는 런타임 값으로 클래스를 만들지 못한다.
     */
    readonly boxClassName: string;
}

const BANNER = {
    mobile: { width: 320, height: 100 },
    desktop: { width: 728, height: 90 },
    boxClassName: 'h-[100px] md:h-[90px]',
} as const;

export const AD_PLACEMENTS: Readonly<Record<AdPlacement, AdPlacementConfig>> = {
    'symbol-bottom': {
        ...BANNER,
        slotId: ADSENSE_SLOTS.SYMBOL_BOTTOM,
        load: 'lazy',
    },
    'fear-greed': {
        ...BANNER,
        slotId: ADSENSE_SLOTS.FEAR_GREED,
        load: 'eager',
    },
    news: { ...BANNER, slotId: ADSENSE_SLOTS.NEWS, load: 'eager' },
    guide: {
        slotId: ADSENSE_SLOTS.GUIDE,
        load: 'lazy',
        mobile: { width: 320, height: 100 },
        desktop: { width: 300, height: 250 },
        boxClassName: 'h-[100px] md:h-[250px]',
    },
};

/** 광고가 켜져 있고 퍼블리셔 ID와 그 자리의 슬롯 ID가 모두 있는가. 아니면 자리도 잡지 않는다. */
export function isAdPlacementConfigured(placement: AdPlacement): boolean {
    return (
        ADSENSE_ENABLED &&
        ADSENSE_PUBLISHER_ID.length > 0 &&
        AD_PLACEMENTS[placement].slotId.length > 0
    );
}
