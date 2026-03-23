import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Supabase paketlerini optimize et
  experimental: {
    optimizePackageImports: ["@supabase/ssr", "@supabase/supabase-js"],
  },

  // Statik dosyalar için agresif cache
  async headers() {
    return [
      {
        source: "/pax-logo.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*\\.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // API route'ları için cache control
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "s-maxage=30, stale-while-revalidate=59" }],
      },
    ];
  },

  // Image optimizasyonu
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
