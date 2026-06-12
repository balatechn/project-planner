/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Self-contained server bundle for Docker/Coolify (small runtime image)
  output: "standalone",

  // ── Image optimisation ─────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "graph.microsoft.com" },
      { protocol: "https", hostname: "*.sharepoint.com" },
      { protocol: "https", hostname: "nationalgroupindia.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24 h browser cache for optimised images
  },

  // ── Compile-time package import optimisation ───────────────────────────────
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-icons",
    ],
  },

  // ── HTTP response headers ──────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Immutable static assets — 1-year cache, no revalidation
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Self-hosted fonts
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Public images — 7-day cache with stale-while-revalidate
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // API routes — no browser cache to prevent stale data
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Security headers for all rendered pages
        source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // Conservative CSP: blocks plugin embeds, clickjacking and
            // base-tag hijacks without restricting Next.js inline chunks
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },

  // ── Webpack bundle optimisations (production only) ─────────────────────────
  webpack(config, { isServer, dev }) {
    if (!isServer && !dev) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks?.cacheGroups ?? {}),
          // Heavy chart / visualisation libraries in their own chunk
          charts: {
            name: "charts",
            test: /[\\/]node_modules[\\/](recharts|d3-|victory)[\\/]/,
            chunks: "all",
            priority: 25,
          },
          // Radix UI primitives separated from app logic
          radix: {
            name: "radix",
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            chunks: "all",
            priority: 20,
          },
          // date-fns locale data is large — isolate it
          datefns: {
            name: "datefns",
            test: /[\\/]node_modules[\\/]date-fns[\\/]/,
            chunks: "all",
            priority: 15,
          },
          // Everything else in node_modules
          vendors: {
            name: "vendors",
            test: /[\\/]node_modules[\\/]/,
            chunks: "all",
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
