import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Link from "next/link"
import { ClientWrapper } from "@/components/client-wrapper"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "GastoGuru",
  description: "Aplicación avanzada para gestión financiera personal con automatización inteligente, OCR de recibos e informes automáticos.",
  applicationName: "GastoGuru",
  authors: [{ name: "GastoGuru Team" }],
  keywords: ["gastos", "finanzas", "presupuesto", "dinero", "expense tracker", "OCR", "automatización"],
  icons: [
    { rel: "icon", url: "/favicon.ico", sizes: "32x32" },
    { rel: "icon", url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { rel: "icon", url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png", sizes: "180x180" },
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GastoGuru",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Android pinta con esto la barra de estado y la de navegación de la PWA
  // instalada (iOS lo ignora). Con el azul de marca salían dos franjas azules
  // arriba y abajo; debe FUNDIRSE con el fondo de la app, no contrastar.
  // El valor oscuro es el --background del tema oscuro (globals.css).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020817" },
  ],
  colorScheme: "light dark",
  // Sin esto, env(safe-area-inset-*) vale siempre 0 y la navegación inferior
  // queda pegada a la barra de gestos del iPhone.
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GastoGuru" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/icon-512.png" sizes="512x512" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
      </head>
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <ClientWrapper>
          {children}
        </ClientWrapper>
        <footer className="mt-auto py-4 px-6 border-t border-border bg-background">
          <div className="max-w-3xl mx-auto text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-2 transition-colors">
              Política de Privacidad
            </Link>
          </div>
        </footer>
      </body>
    </html>
  )
}

