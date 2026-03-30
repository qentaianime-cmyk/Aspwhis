export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col items-center min-h-screen bg-background">
      <div className="w-full max-w-4xl">
        {children}
      </div>
    </main>
  )
}
