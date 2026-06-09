import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Duoland Studio',
  description: 'Duoland content authoring and review dashboard'
}

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
