/** @type {import('next').NextConfig} */
const nextConfig = {
  // clean, shareable URLs for the static demo dashboards
  async rewrites() {
    return [
      { source: "/demos/agent-observability", destination: "/demos/agent-observability/index.html" },
      { source: "/teardown", destination: "/teardown.html" },
    ];
  },
};

export default nextConfig;
