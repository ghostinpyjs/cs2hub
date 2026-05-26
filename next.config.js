/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'avatars.steamstatic.com',
      'community.cloudflare.steamstatic.com',
      'steamcdn-a.akamaihd.net',
      'community.akamai.steamstatic.com'
    ],
  },
}
module.exports = nextConfig
