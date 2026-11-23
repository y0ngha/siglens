import 'server-only';
import http from 'node:http';
import https from 'node:https';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
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
/** 첫 시도가 실패한 뒤 한 번 더 시도하기 전에 기다리는 시간. */
const FONT_RETRY_DELAY_MS = 500;

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
function downloadOnce(url: string): Promise<ArrayBuffer> {
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
 * 한 번 재시도한 뒤에야 실패로 친다 — CDN의 일시적 오류 한 번이 60초 실패 기억으로 번져
 * 그 분에 프리렌더되는 모든 OG 라우트를 실패시키지 않게 한다.
 */
async function downloadFont(url: string): Promise<ArrayBuffer> {
    try {
        return await downloadOnce(url);
    } catch {
        await new Promise(resolve => setTimeout(resolve, FONT_RETRY_DELAY_MS));
        return downloadOnce(url);
    }
}

/** 실패한 URL을 다시 받기 전에 기다리는 시간 — CDN 장애 중 렌더마다 다운로드·로그가 쌓이지 않게 한다. */
const FAILURE_BACKOFF_MS = 60_000;

/** Latin 폴백으로 그려도 깨지지 않는 로케일 — 그 밖의 로케일은 자기 문자 폰트가 필수다. */
const LATIN_ONLY_LOCALES: readonly Locale[] = ['en'];

/**
 * 한글·일본어·중국어 OG 이미지에 문자 폰트를 받지 못했을 때 던진다.
 *
 * Latin 폴백으로 그리면 빈 네모(tofu)가 든 이미지가 30일 ISR 캐시에 박힌다. 던지면
 * 재생성 중에는 이전의 정상 이미지가 유지되고, 빌드 중 CDN 장애는 프리렌더를 크게
 * 실패시킨다(깨진 이미지를 배포하는 것보다 낫다고 판단했다).
 */
export class OgFontUnavailableError extends Error {
    constructor(locale: Locale) {
        super(`og font unavailable for locale ${locale}`);
        this.name = 'OgFontUnavailableError';
    }
}

/**
 * 로케일 → OG 폰트 로더를 만든다. 폰트는 URL별로 **모듈 스코프(= 프로세스 수명)에서
 * 한 번만** 받는다 — 동시 렌더는 진행 중인 같은 promise를 공유한다.
 *
 * 실패는 {@link FAILURE_BACKOFF_MS} 동안만 기억한다. 그 안의 호출은 다운로드도 로그도 없이
 * 바로 실패하고, 이후 호출이 다시 시도한다. 실패 로그는 다운로드 시도당 한 줄이다.
 * 문자 폰트가 필수인 로케일(en 외)은 실패 시 {@link OgFontUnavailableError}를 던지고,
 * en은 `null`을 돌려줘 Latin 폴백으로 그린다.
 *
 * 테스트가 소스와 메모를 격리할 수 있게 팩토리로 둔다. 운영 코드는 {@link loadOgFont}만 쓴다.
 */
export function createOgFontLoader(
    fontByLocale: Record<Locale, OgFontSource>
): (locale: Locale) => Promise<OgFont | null> {
    const bytesByUrl = new Map<string, Promise<ArrayBuffer>>();
    const failedAtByUrl = new Map<string, number>();

    function fontBytes(url: string): Promise<ArrayBuffer> | null {
        const pending = bytesByUrl.get(url);
        if (pending) return pending;
        const failedAt = failedAtByUrl.get(url);
        if (failedAt !== undefined) {
            if (Date.now() - failedAt < FAILURE_BACKOFF_MS) return null;
            failedAtByUrl.delete(url);
        }
        const download = downloadFont(url);
        bytesByUrl.set(url, download);
        download.catch(error => {
            bytesByUrl.delete(url);
            failedAtByUrl.set(url, Date.now());
            // 다운로드 시도당 한 줄 — 이 promise를 기다리던 렌더마다 찍지 않는다.
            console.error(
                `[og-font] download failed url=${url}:`,
                redactDbErrorForLog(error)
            );
        });
        return download;
    }

    return async locale => {
        const { name, url } = fontByLocale[locale];
        try {
            const bytes = fontBytes(url);
            if (bytes) {
                return {
                    name,
                    data: await bytes,
                    style: 'normal',
                    weight: 700,
                };
            }
        } catch {
            // 로그는 다운로드 catch에서 이미 남겼다.
        }
        if (LATIN_ONLY_LOCALES.includes(locale)) return null;
        throw new OgFontUnavailableError(locale);
    };
}

/** 로케일 OG 폰트. en은 실패 시 `null`(Latin 폴백), 그 외 로케일은 던진다. */
export const loadOgFont = createOgFontLoader(OG_FONT_BY_LOCALE);
