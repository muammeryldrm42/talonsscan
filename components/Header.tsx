import Link from "next/link";
export default function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2 no-underline"><span className="text-lg font-semibold tracking-tight">Talons Scan</span><span className="text-xs text-mist">Arc mainnet</span></Link>
        <div className="ml-auto flex items-center gap-4">{children}</div>
      </div>
    </header>
  );
}
