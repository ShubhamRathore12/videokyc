import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "sonner"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Video KYC - Face Verification",
  description: "Advanced face recognition for identity verification",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* MediaPipe CDN for face detection and hand tracking */}
        <script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js"
          crossOrigin="anonymous"
          async
        ></script>
        <script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"
          crossOrigin="anonymous"
          async
        ></script>
        {/* face-api.js */}
        <script
          src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js"
          crossOrigin="anonymous"
          async
        ></script>
      </head>
      <body className={`font-sans antialiased`}>
        <Toaster position="top-right" richColors /> {/* 👈 */}
        {children}
        <Analytics />
      </body>
    </html>
  )
}