/** 종목 레이더(외부 사이트)의 기점 URL. 색인 대상이 아닌 한국어 전용 대시보드다. */
export const RADAR_SITE_URL = 'https://dashboard.siglens.io';

/** 레이더 대시보드 한 건. 칩 한 개로 노출된다. */
interface RadarDashboard {
    /** 대시보드 경로 조각(`RADAR_SITE_URL/<slug>`). */
    readonly slug: string;
    /** 칩에 보이는 이름. */
    readonly label: string;
    /** 칩에 `$TICKER`로 보이는 티커. */
    readonly ticker: string;
}

/**
 * 레이더에 열려 있는 대시보드 목록.
 *
 * sealsq-radar 레포의 `src/dashboards/registry.ts`를 그대로 옮긴 사본이다. 그쪽에
 * 대시보드를 추가하거나 빼면 여기도 같이 고쳐야 한다 — 두 레포를 잇는 코드가 없다.
 */
export const RADAR_DASHBOARDS: readonly RadarDashboard[] = [
    { slug: 'sealsq', label: 'SEALSQ', ticker: 'LAES' },
    { slug: 'nvidia', label: 'NVIDIA', ticker: 'NVDA' },
    { slug: 'tesla', label: 'Tesla', ticker: 'TSLA' },
];

/** 대시보드 한 건의 절대 URL. */
export function radarDashboardUrl(slug: string): string {
    return `${RADAR_SITE_URL}/${slug}`;
}

/** 종목 요청 폼의 종목 입력 최대 길이. 폼 검증과 입력 UI가 공유한다. */
export const RADAR_REQUEST_SYMBOL_MAX_LENGTH = 50;
