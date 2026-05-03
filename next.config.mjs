/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": [
      "./src/config/structure-tree/**/*",
      "./src/config/structure-tree.json",
      "./src/config/step-opening/**/*"
    ]
  }
};

export default nextConfig;
