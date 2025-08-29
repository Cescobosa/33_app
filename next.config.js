/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'murbolcgxvsfjmqeucds.supabase.co' },
    ],
  },
  reactStrictMode: true,
}
module.exports = nextConfig
