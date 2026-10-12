/** @type {import('next').NextConfig} */
const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");
const nextConfig = {
  experimental: { instrumentationHook: true },
  images: {
    remotePatterns: [
      // ajuste os domínios reais de onde as imagens de carta virão
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = (phase) => ({
  ...nextConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
});
