/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We render album art with plain <img> straight from Spotify's CDN, so the
  // Next image optimizer is disabled deliberately — it adds no value here and
  // removes a whole class of optimizer-related advisories / attack surface.
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
