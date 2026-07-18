import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/chat': ['./referensi/**/*'],
  },
};

export default nextConfig;
