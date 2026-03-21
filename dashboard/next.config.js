const withNextIntl = require("next-intl/plugin")("./src/i18n/config.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = withNextIntl(nextConfig);
