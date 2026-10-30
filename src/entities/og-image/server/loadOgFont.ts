import 'server-only';
import http from 'node:http';
import https from 'node:https';
import type { Locale } from '@/shared/i18n/locales';
import { OG_FONT_BY_LOCALE, type OgFontSource } from '../lib/ogFontSources';

/** `ImageResponse`의 `fonts` 항목 하나 — `loadOgFont`가 돌려주고 OG 라우트가 `fonts`에 싣는다. */
export interface OgFont {
    name: string;
    data: ArrayBuffer;
    style: 'normal';
    weight: 700;
}

const FONT_DOWNLOAD_TIMEOUT_MS = 10_000;

/**
 * 폰트 바이트를 **전역 `fetch`를 거치지 않고** 받는다.
 *
 * `fetch(url, { next: { revalidate } })`로 Next 데이터 캐시에 맡기면 커스텀 ISR 캐시
 * 핸들러(S3) 아래에서 OG 렌더마다 ~2MB S3 GET이 된다 — 데이터 캐시 항목도 핸들러가
 * S3에서 읽기 때문이다. 캐시 키가 빌드별 prefix라 배포마다 CDN에서 다시 받아 2MB씩
 * S3에 써 넣기도 하고, 그 fetch의 7일 revalidate가 OG 라우트 자신의 30일
 * revalidate를 7일로 끌어내린다(Next는 렌더 중 fetch의 최솟값을 페이지 revalidate로
 * 삼는다).
 *
 * `cache: 'no-store'`로 바꾸면 안 된다 — 패치된 fetch가 그것을 "이 렌더는 동적"으로
 * 기록한다. `shared/cache/upstashRenderSafeCommand.ts`와 같은 이유로 `node:http(s)`를
 * 직접 쓴다. timeout은 소켓을 destroy해 error로 이어지므로 promise는 반드시 settle된다.
 */
function downloadFont(url: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const transport = target.protocol === 'http:' ? http : https;
        const request = transport.get(
            target,
            { timeout: FONT_DOWNLOAD_TIMEOUT_MS },
            response => {
                if (response.statusCode !== 200) {
                    response.resume();
                    reject(new Error(`og font http ${response.statusCode}`));
                    return;
                }
                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('error', reject);
                response.on('end', () => {
                    const bytes = Buffer.concat(chunks);
                    resolve(
                        bytes.buffer.slice(
                            bytes.byteOffset,
                            bytes.byteOffset + bytes.byteLength
                        ) as ArrayBuffer
                    );
                });
            }
        );
        request.on('timeout', () =>
            request.destroy(
                new Error(`og font timeout after ${FONT_DOWNLOAD_TIMEOUT_MS}ms`)
            )
        );
        request.on('error', reject);
    });
}

/**
 * 로케일 → OG 폰트 로더를 만든다. 폰트는 URL별로 **모듈 스코프(= 프로세스 수명)에서
 * 한 번만** 받는다 — 동시 렌더는 진행 중인 같은 promise를 공유한다.
 *
 * 실패(네트워크·비 200)는 기억하지 않는다. 다음 렌더가 다시 시도하고, 그동안 이미지는
 * Latin 폴백으로 그려진다.
 *
 * 테스트가 소스와 메모를 격리할 수 있게 팩토리로 둔다. 운영 코드는 {@link loadOgFont}만 쓴다.
 */
export function createOgFontLoader(
    fontByLocale: Record<Locale, OgFontSource>
): (locale: Locale) => Promise<OgFont | null> {
    const bytesByUrl = new Map<string, Promise<ArrayBuffer>>();

    function fontBytes(url: string): Promise<ArrayBuffer> {
        const pending = bytesByUrl.get(url);
        if (pending) return pending;
        const download = downloadFont(url);
        bytesByUrl.set(url, download);
        download.catch(() => bytesByUrl.delete(url));
        return download;
    }

    return async locale => {
        const { name, url } = fontByLocale[locale];
        try {
            return {
                name,
                data: await fontBytes(url),
                style: 'normal',
                weight: 700,
            };
        } catch {
            return null;
        }
    };
}

/** 로케일 OG 폰트. 실패는 `null` — 이미지는 Latin 폴백으로 그려진다. */
export const loadOgFont = createOgFontLoader(OG_FONT_BY_LOCALE);
