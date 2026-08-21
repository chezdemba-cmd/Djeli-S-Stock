import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OfflineProvider } from "./providers/OfflineProvider";

export const metadata: Metadata = {
  title: "Comy Stock",
  description: "Gestion de stock simple pour grossistes et dépôts d'Afrique de l'Ouest",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173f35",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <OfflineProvider>
          {children}
        </OfflineProvider>
      </body>
    </html>
  );
}
