import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Suganuma Ops Hub",
  description: "Centro de comando pessoal — tasks, finanças, saúde, calendário",
  manifest: "/manifest.webmanifest",
  themeColor: "#121212",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OpsHub",
  },
}

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
