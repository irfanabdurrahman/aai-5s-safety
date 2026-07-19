import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AAI 5S & Safety",
    short_name: "AAI 5S",
    description:
      "Lapor temuan safety & audit 5S — PT Akebono Brake Astra Indonesia",
    start_url: "/",
    display: "standalone",
    background_color: "#0b3c8c",
    theme_color: "#0b3c8c",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
