import type { Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Remark plugins shared by every `ReactMarkdown` that renders Korean prose.
 *
 * `singleTilde: false`: Korean text writes ranges as `5~30분봉` or
 * `266,500~270,666원`, and GFM's default reads two single tildes on one line
 * as ~strikethrough~. Only `~~double~~` strikes now.
 */
export const KOREAN_SAFE_REMARK_PLUGINS: NonNullable<Options['remarkPlugins']> =
    [[remarkGfm, { singleTilde: false }]];
