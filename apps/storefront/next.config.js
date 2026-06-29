/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // En dev, l'optimiseur next/image tourne dans le conteneur et ne peut pas
    // joindre localhost:9000 (= le conteneur lui-même). On désactive donc
    // l'optimisation en dev : le navigateur charge l'URL presigned directement.
    // En prod, le domaine public du stockage est joignable des deux côtés.
    unoptimized: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      // MinIO (dev). En prod, ajouter le domaine public du stockage.
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
    ],
  },
};

module.exports = nextConfig;
