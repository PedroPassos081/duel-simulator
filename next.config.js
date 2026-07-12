/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // ajuste os domínios reais de onde as imagens de carta virão
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
