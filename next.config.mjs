/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/opportunities",
        destination: "/funding-opportunities",
        permanent: false,
      },
      {
        source: "/opportunities/:path*",
        destination: "/funding-opportunities",
        permanent: false,
      },
      {
        source: "/watched-pis",
        destination: "/investigators",
        permanent: false,
      },
      {
        source: "/watched-pis/:path*",
        destination: "/investigators",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
