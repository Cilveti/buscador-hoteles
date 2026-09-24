import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export function CatalogHeader({
  resultsHref = '/',
  isListing = false,
}: {
  resultsHref?: string;
  isListing?: boolean;
}) {
  return (
    <header className="border-b bg-white">
      <div className="page-width flex h-20 items-center justify-between gap-3 sm:gap-4">
        <Link
          href="/"
          aria-label="Buscador de hoteles, inicio"
          className="shrink-0 whitespace-nowrap text-lg sm:text-[27px] font-medium tracking-[-1.5px]"
        >
          Buscador de hoteles
          <span className="ml-1 inline-block size-1.5 rounded-full bg-coral align-top" />
        </Link>
        <nav
          aria-label="Navegación principal"
          className="flex items-center gap-3 text-[11px] sm:gap-10 sm:text-sm"
        >
          <Link
            href={isListing ? '#hoteles' : resultsHref}
            className="hidden font-medium sm:block"
            aria-current={isListing ? 'page' : undefined}
          >
            Hoteles
          </Link>
          <a
            href="/admin"
            className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            Administración <ArrowUpRight className="size-3.5" />
          </a>
        </nav>
      </div>
    </header>
  );
}

export function CatalogFooter() {
  return (
    <footer className="border-t py-6">
      <div className="page-width flex flex-col justify-between gap-3 text-[11px] text-muted-foreground sm:flex-row">
        <p>Catálogo de demostración · Nombres ficticios</p>
        <p>Sin reservas ni disponibilidad en tiempo real</p>
      </div>
    </footer>
  );
}
