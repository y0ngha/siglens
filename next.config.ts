import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // React Compiler (Next.js 16 stable)
  reactCompiler: true,

  // Turbopack (Next.js 16 기본값이나 명시)
  turbopack: {},
};

export default nextConfig;