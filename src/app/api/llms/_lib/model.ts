import type { BenchmarkRelease } from '@/entities/benchmark/types';
import type { AiIndexablePath } from '@/shared/config/aiHost';

export type LlmsHost = 'main' | 'ai';

/**
 * 링크가 어떻게 풀리는지. 링크 존재 가드가 종류마다 실제 라우트 표에 대조하므로, llms.txt의 URL은 이 중
 * 하나로만 만들 수 있다(자유 문자열 금지).
 */
export type LlmsLinkTarget =
    /** 정적 sitemap에 실린 메인 페이지. */
    | { readonly kind: 'mainPage'; readonly path: string }
    | {
          readonly kind: 'mainPageFragment';
          readonly path: string;
          readonly fragment: string;
      }
    /** 프리웜 유니버스 안의 종목 페이지. */
    | { readonly kind: 'symbolPage'; readonly symbol: string }
    /** `next.config.ts` rewrite의 source. */
    | {
          readonly kind: 'rewrite';
          readonly host: LlmsHost;
          readonly path: string;
      }
    | {
          readonly kind: 'publicFile';
          readonly host: LlmsHost;
          readonly path: string;
      }
    | { readonly kind: 'aiPage'; readonly path: AiIndexablePath }
    /** 레포 master의 raw 파일. */
    | { readonly kind: 'repoFile'; readonly repoPath: string }
    /** 번들 데이터에서 가져온 외부 URL. */
    | { readonly kind: 'external'; readonly url: string };

export interface LlmsLink {
    readonly title: string;
    /** 절대 URL. 항상 `llmsTargetUrl`이 `target`에서 만든다. */
    readonly url: string;
    readonly note?: string;
    readonly target: LlmsLinkTarget;
}

export interface LlmsSection {
    readonly heading: string;
    readonly links: readonly LlmsLink[];
}

export interface LlmsDocument {
    /** H1. */
    readonly title: string;
    /** 인용문(`>`). */
    readonly summary: string;
    readonly paragraphs: readonly string[];
    readonly sections: readonly LlmsSection[];
}

export interface LlmsInputs {
    readonly siteUrl: string;
    readonly aiSiteUrl: string;
    readonly benchmark: BenchmarkRelease | null;
    readonly backtestRunId: string;
    readonly publicApiEnabled: boolean;
}
