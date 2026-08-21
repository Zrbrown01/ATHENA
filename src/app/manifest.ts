import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Athena — Workers’ Compensation Defense Case Management",
    short_name: "Athena",
    description:
      "Matter-centered case management for workers’ compensation defense firms.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8fc",
    theme_color: "#181f21",
    icons: [
      {
        src: "/brand/athena-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
