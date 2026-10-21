import type { Metadata } from "next"
import localFont from "next/font/local"
import { ThemeProvider } from "next-themes"
import "./globals.css"

// Inter auto-hospedada (subset latin, fonte variável 100-900).
// Antes vinha do next/font/google, que BAIXA a fonte no build — ou seja,
// o build dependia da rede e quebrava quando ela faltava (no Mac, por causa
// do SSL_CERT_FILE apontando para o CA da rede doméstica).
const inter = localFont({
  src: "./fonts/Inter-latin-variable.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
})

export const metadata: Metadata = {
  title: "Suganuma Ops Hub",
  description: "Centro de comando pessoal — tasks, finanças, saúde, calendário",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OpsHub",
    startupImage: [
      { url: "/apple-touch-icon.png", media: "(device-width: 390px)" },
    ],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
    { media: "(prefers-color-scheme: light)", color: "#F2F4F5" },
  ],
} as const

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
