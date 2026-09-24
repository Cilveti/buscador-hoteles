import type { CatalogQuery, CatalogResponse } from '@hoteles/contracts/catalog';
import { SlidersHorizontal } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';

import { clearedFilters, countFilters } from '../application/query';

// CatalogQuerySchema admite hasta 20 valores en cada selección múltiple.
const maxSelectedValues = 20;

type Props = {
  query: CatalogQuery;
  facets: CatalogResponse['facets'] | undefined;
  onChange: (patch: Partial<CatalogQuery>) => void;
};

export function CatalogFilters({ query, facets, onChange }: Props) {
  const id = useId();
  const hasFilters = countFilters(query) > 0;
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
      <div className="filter-field space-y-2.5">
        <label htmlFor={`${id}-destination`} className="block text-sm font-medium">
          Destino
        </label>
        <NativeSelect
          id={`${id}-destination`}
          value={query.destination ?? ''}
          onChange={(event) => onChange({ destination: event.target.value || undefined })}
        >
          <NativeSelectOption value="">Todos los destinos</NativeSelectOption>
          {query.destination &&
            !facets?.destinations?.some((item) => item.value === query.destination) && (
              <NativeSelectOption value={query.destination}>{query.destination}</NativeSelectOption>
            )}
          {facets?.destinations?.map((item) => (
            <NativeSelectOption key={item.value} value={item.value}>
              {item.label} ({item.count})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="filter-field space-y-2.5">
        <label htmlFor={`${id}-stars`} className="block text-sm font-medium">
          Estrellas
        </label>
        <NativeSelect
          id={`${id}-stars`}
          value={query.stars ?? ''}
          onChange={(event) =>
            onChange({ stars: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <NativeSelectOption value="">Todas las categorías</NativeSelectOption>
          {[1, 2, 3, 4, 5].map((stars) => (
            <NativeSelectOption key={stars} value={stars}>
              {stars} estrellas
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {(['services', 'themes'] as const).map((field) => (
        <fieldset key={field} className="space-y-2.5">
          <legend className="mb-2 text-sm font-medium">
            {field === 'services' ? 'Servicios' : 'Tipo de estancia'}
          </legend>
          {(query[field]?.length ?? 0) >= maxSelectedValues && (
            <p id={`${id}-${field}-limit`} className="text-xs text-muted-foreground" role="status">
              Has seleccionado el máximo de 20 opciones. Quita una para elegir otra.
            </p>
          )}
          {facets?.[field]?.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={item.label}
                checked={query[field]?.includes(item.value) ?? false}
                disabled={
                  (query[field]?.length ?? 0) >= maxSelectedValues &&
                  !query[field]?.includes(item.value)
                }
                aria-describedby={
                  (query[field]?.length ?? 0) >= maxSelectedValues
                    ? `${id}-${field}-limit`
                    : undefined
                }
                onChange={(event) => {
                  const values = event.target.checked
                    ? [...(query[field] ?? []), item.value]
                    : query[field]?.filter((value) => value !== item.value);
                  onChange({ [field]: values?.length ? values : undefined });
                }}
              />
              <span>
                {item.label} <span aria-hidden="true">({item.count})</span>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={query.pets === 'allowed-or-conditional'}
            aria-describedby={`${id}-pets-help`}
            onChange={(event) =>
              onChange({ pets: event.target.checked ? 'allowed-or-conditional' : undefined })
            }
          />
          Admite mascotas
        </label>
        <p id={`${id}-pets-help`} className="text-xs leading-relaxed text-muted-foreground">
          Incluye las que las admiten con condiciones.
        </p>
      </div>
      <Button
        variant="outline"
        className="h-11 w-full bg-transparent"
        disabled={!hasFilters}
        onClick={() => onChange(clearedFilters)}
      >
        Limpiar filtros
      </Button>
    </div>
  );
}
