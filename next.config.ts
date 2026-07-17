import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prisma client (driver adapter pg) jalan di Node runtime, jangan di-bundle
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
