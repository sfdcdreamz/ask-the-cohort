import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ask the Cohort',
  description: 'A Q&A board with upvoting for your cohort',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 antialiased">{children}</body>
    </html>
  )
}
