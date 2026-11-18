import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Lets a phone on the same Wi-Fi open the dev server by the computer's
  // address (for example http://10.0.0.5:3000). Development only.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
