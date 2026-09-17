import { Search } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export function CatalogEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <section
      aria-labelledby="catalog-empty-title"
      className="flex min-h-[340px] flex-col items-center justify-center rounded-md border border-[#c7dadd] bg-white p-8 text-center"
    >
      <span
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-full bg-[#e8f3f5]"
      >
        <Search className="size-7 text-[#176a79]" />
      </span>
      <h3 id="catalog-empty-title" className="text-xl font-semibold text-[#172f35] sm:text-2xl">
        Todavía no hemos encontrado tu hotel
      </h3>
      <p className="mb-7 mt-3.5 text-sm leading-6 text-[#52666b]">
        Prueba otro destino o amplía los filtros para descubrir más opciones.
      </p>
      <Button
        onClick={onReset}
        className="h-11 w-52 max-w-full rounded-sm bg-[#176a79] px-4 text-white hover:bg-[#176a79]/90"
      >
        Ver todos los hoteles
      </Button>
    </section>
  );
}
