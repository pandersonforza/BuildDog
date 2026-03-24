import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better dev experience
  reactStrictMode: true,

  // Optimize package imports to reduce bundle size
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "@tanstack/react-table"],
  },

  // Cache static assets aggressively
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
      ],
    },
  ],
};

export default nextConfig;
