export const dynamic = 'force-dynamic';
export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ink min-h-screen">
      {children}
    </div>
  );
}
