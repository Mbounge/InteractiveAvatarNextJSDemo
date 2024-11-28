/** @type {import('next').NextConfig} */
module.exports = {
    reactStrictMode: true,
    experimental: {
      appDir: true,
      serverActions: true
      
    },
    eslint: {
        ignoreDuringBuilds: true, // Ignore ESLint for production builds
      },
  };
  
