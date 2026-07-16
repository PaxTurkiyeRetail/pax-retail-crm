import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { cpus: 2 },
  reactStrictMode: true,

  poweredByHeader: false,
  compress: true,

  // Statik dosyalar agresif cache, API cevapları ise CRM verisi olduğu için no-store.
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
        // DB verisi anlık değiştiği için ara cache kapalı tutulur.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },

  // Image optimizasyonu
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
