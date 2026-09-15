import type { CatalogQuery, CatalogResponse } from '@hoteles/contracts/catalog';
import { SlidersHorizontal } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';

type Props = {
  query: CatalogQuery;
  facets: CatalogResponse['facets'] | undefined;
  onChange: (patch: Partial<CatalogQuery>) => void;
};

export function CatalogFilters({ query, facets, onChange }: Props) {
  const id = useId();
  const hasFilters = Boolean(query.country || query.brand || query.minRating !== undefined);
  const countries = facets?.countries ?? [];
  const brands = facets?.brands ?? [];
  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <SlidersHorizontal className="size-4" /> Afinar búsqueda
        </h2>
      </div>
      <div className="filter-field space-y-2.5">
        <label htmlFor={`${id}-country`} className="block text-sm font-medium">
          País
        </label>
        <NativeSelect
          id={`${id}-country`}
          value={query.country ?? ''}
          onChange={(event) => onChange({ country: event.target.value || undefined })}
        >
          <NativeSelectOption value="">Todos los países</NativeSelectOption>
          {query.country && !countries.some((country) => country.value === query.country) && (
            <NativeSelectOption value={query.country}>{query.country}</NativeSelectOption>
          )}
          {countries.map((country) => (
            <NativeSelectOption key={country.value} value={country.value}>
              {country.label} ({country.count})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="filter-field space-y-2.5">
        <label htmlFor={`${id}-brand`} className="block text-sm font-medium">
          Marca
        </label>
        <NativeSelect
          id={`${id}-brand`}
          value={query.brand ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onChange({
              brand:
                value === 'aurora' || value === 'brisa' || value === 'mirador' || value === 'natura'
                  ? value
                  : undefined,
            });
          }}
        >
          <NativeSelectOption value="">Todas las marcas</NativeSelectOption>
          {query.brand && !brands.some((brand) => brand.value === query.brand) && (
            <NativeSelectOption value={query.brand}>{query.brand}</NativeSelectOption>
          )}
          {brands.map((brand) => (
            <NativeSelectOption key={brand.value} value={brand.value}>
              {brand.label} ({brand.count})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Separator />
      <div className="filter-field space-y-2.5">
        <label htmlFor={`${id}-rating`} className="block text-sm font-medium">
          Valoración mínima
        </label>
        <NativeSelect
          id={`${id}-rating`}
          value={query.minRating ?? ''}
          onChange={(event) =>
            onChange({ minRating: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <NativeSelectOption value="">Sin mínimo</NativeSelectOption>
          {query.minRating !== undefined && ![4, 4.5, 5].includes(query.minRating) && (
            <NativeSelectOption value={query.minRating}>
              {query.minRating.toLocaleString('es-ES')} o más
            </NativeSelectOption>
          )}
          <NativeSelectOption value="4">4 o más</NativeSelectOption>
          <NativeSelectOption value="4.5">4,5 o más</NativeSelectOption>
          <NativeSelectOption value="5">5 de 5</NativeSelectOption>
        </NativeSelect>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Opiniones de huéspedes, sobre 5.
        </p>
      </div>
      <Button
        variant="outline"
        className="h-11 w-full bg-transparent"
        disabled={!hasFilters}
        onClick={() => onChange({ country: undefined, brand: undefined, minRating: undefined })}
      >
        Limpiar filtros
      </Button>
    </div>
  );
}
