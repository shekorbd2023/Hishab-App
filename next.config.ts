import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // libSQL ships native/optional bindings — keep it out of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
