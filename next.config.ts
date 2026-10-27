import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // The screen records and photographs; nothing else on the device is touched.
        { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=()" },
      ],
    }];
  },
};

export default nextConfig;
