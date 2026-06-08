import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SEL Quest Platform',
  description: '儿童 SEL 游戏化课程运行时 MVP'
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
