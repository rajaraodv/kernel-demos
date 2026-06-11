/** @type {import('next').NextConfig} */
const nextConfig = {
  // load these at runtime in the node server instead of bundling them
  // (playwright-core has optional deps the bundler can't resolve)
  experimental: { serverComponentsExternalPackages: ["playwright-core", "stripe"] },
  // clean, shareable URLs for the static demo dashboards
  async rewrites() {
    return [
      { source: "/demos/agent-observability", destination: "/demos/agent-observability/index.html" },
      { source: "/teardown", destination: "/teardown.html" },
    ];
  },
};

export default nextConfig;
