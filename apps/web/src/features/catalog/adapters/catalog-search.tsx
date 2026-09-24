'use client';
import { ArrowLeft, ArrowRight, Compass, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { hotelHref } from '../application/hotel-navigation';
import { clearedFilters, countFilters, initialQuery } from '../application/query';
import { CatalogFilters } from './catalog-filters';
import { CatalogFooter, CatalogHeader } from './catalog-shell';
import { HotelCard } from './hotel-card';
import { httpCatalog } from './http-catalog';
import { useCatalog } from './use-catalog';

export function CatalogSearch() {
  const { query, state, facets, update, retry } = useCatalog(httpCatalog);
  const [text, setText] = useState(query.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => setText(query.q), [query.q]);
  const data = state.data;
  const filterCount = countFilters(query);
  const countryLabel =
    facets?.countries.find((item) => item.value === query.country)?.label ?? query.country;
  const brandLabel =
    facets?.brands.find((item) => item.value === query.brand)?.label ?? query.brand;
  const reset = () => {
    setText('');
    update({ ...initialQuery, ...clearedFilters });
  };

  return (
    <>
      <a
        href="#hoteles"
        className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:p-3"
      >
        Saltar a los hoteles
      </a>
      <CatalogHeader isListing />
      <main className="page-width pb-12">
        <section aria-labelledby="catalog-title" className="pb-9 pt-9 sm:pb-10 sm:pt-11">
          <p className="mb-4 flex items-center gap-2 text-[10px] font-medium tracking-[.13em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-coral" /> HOTELES PARA CADA FORMA DE VIAJAR
          </p>
          <h1
            id="catalog-title"
            className="text-[31px] font-medium leading-[1.22] tracking-[-1px] sm:text-[40px]"
          >
            Tu próximo destino empieza aquí.
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
            Explora nuestros hoteles y encuentra el que va contigo.
          </p>
          <search>
            <form
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                update({ q: text });
              }}
            >
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Nombre del hotel o destino"
                  placeholder="Nombre del hotel o destino"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={500}
                  className="h-[52px] rounded-md bg-white pl-11 pr-11 text-sm shadow-none"
                />
                {text && (
                  <button
                    type="button"
                    aria-label="Borrar texto de búsqueda"
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setText('');
                      update({ q: '' });
                    }}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                className="h-[52px] gap-2 rounded-md px-8 sm:min-w-40"
                aria-label="Buscar hoteles"
              >
                Buscar <ArrowRight className="size-4" />
              </Button>
            </form>
          </search>
        </section>

        <section
          id="hoteles"
          aria-label="Resultados de hoteles"
          className="grid scroll-mt-5 gap-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8"
        >
          <aside className="hidden self-start rounded-lg border bg-white p-5 lg:block">
            <CatalogFilters query={query} facets={facets} onChange={update} />
          </aside>
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div aria-live="polite" role="status">
                <h2 className="text-lg font-medium sm:text-xl">
                  {state.status === 'loading'
                    ? 'Buscando hoteles…'
                    : state.status === 'error'
                      ? 'Tu búsqueda'
                      : `${data?.total ?? 0} ${(data?.total ?? 0) === 1 ? 'hotel' : 'hoteles'} para descubrir`}
                </h2>
                {query.q && (
                  <p className="mt-1 text-xs text-muted-foreground">Resultados para «{query.q}»</p>
                )}
              </div>
              <div className="flex w-full items-end gap-3 sm:w-auto">
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="h-11 bg-white lg:hidden">
                      <SlidersHorizontal className="size-4" />
                      Filtros
                      {filterCount > 0 && (
                        <span className="rounded-full bg-secondary px-1.5 text-xs">
                          {filterCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[min(360px,90vw)] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Filtros de hoteles</SheetTitle>
                      <SheetDescription>Encuentra el hotel que va contigo.</SheetDescription>
                    </SheetHeader>
                    <div className="px-6 py-4">
                      <CatalogFilters query={query} facets={facets} onChange={update} />
                      <Button className="mt-8 h-12 w-full" onClick={() => setFiltersOpen(false)}>
                        Ver resultados
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
                <div className="filter-field ml-auto min-w-0 flex-1 space-y-1.5 sm:w-48">
                  <label htmlFor="catalog-sort" className="block text-[11px] font-medium">
                    Ordenar por
                  </label>
                  <NativeSelect
                    id="catalog-sort"
                    value={query.sort}
                    onChange={(event) =>
                      update({ sort: event.target.value === 'rating' ? 'rating' : 'name' })
                    }
                  >
                    <NativeSelectOption value="name">Nombre: A–Z</NativeSelectOption>
                    <NativeSelectOption value="rating">Mejor valoración</NativeSelectOption>
                  </NativeSelect>
                </div>
              </div>
            </div>

            {(filterCount > 0 || query.q) && (
              <fieldset className="mb-5 flex flex-wrap gap-2" aria-label="Filtros activos">
                {query.q && (
                  <FilterChip label={`Búsqueda: ${query.q}`} onRemove={() => update({ q: '' })} />
                )}
                {query.country && (
                  <FilterChip
                    label={countryLabel ?? query.country}
                    onRemove={() => update({ country: undefined })}
                  />
                )}
                {query.brand && (
                  <FilterChip
                    label={brandLabel ?? query.brand}
                    onRemove={() => update({ brand: undefined })}
                  />
                )}
                {query.minRating !== undefined && (
                  <FilterChip
                    label={`${query.minRating.toLocaleString('es-ES')} o más`}
                    onRemove={() => update({ minRating: undefined })}
                  />
                )}
                {query.destination && (
                  <FilterChip
                    label={
                      facets?.destinations?.find((item) => item.value === query.destination)
                        ?.label ?? query.destination
                    }
                    onRemove={() => update({ destination: undefined })}
                  />
                )}
                {query.stars !== undefined && (
                  <FilterChip
                    label={`${query.stars} estrellas`}
                    onRemove={() => update({ stars: undefined })}
                  />
                )}
                {(['services', 'themes'] as const).flatMap((field) =>
                  (query[field] ?? []).map((value) => (
                    <FilterChip
                      key={`${field}-${value}`}
                      label={facets?.[field]?.find((item) => item.value === value)?.label ?? value}
                      onRemove={() => {
                        const remaining = query[field]?.filter((item) => item !== value);
                        update({ [field]: remaining?.length ? remaining : undefined });
                      }}
                    />
                  )),
                )}
                {query.pets && (
                  <FilterChip
                    label={query.pets === 'allowed-or-conditional' ? 'Admite mascotas' : query.pets}
                    onRemove={() => update({ pets: undefined })}
                  />
                )}
              </fieldset>
            )}

            {state.status === 'loading' ? (
              <div
                className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
                role="status"
                aria-label="Cargando hoteles"
                aria-busy="true"
              >
                {['first', 'second', 'third', 'fourth', 'fifth', 'sixth'].map((slot) => (
                  <div key={slot} className="space-y-4 rounded-lg bg-white p-3">
                    <Skeleton className="aspect-[1.65] rounded-md" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="mb-3 h-11 w-full" />
                  </div>
                ))}
              </div>
            ) : state.status === 'error' ? (
              <div role="alert" className="rounded-lg border bg-white px-6 py-14 text-center">
                <p className="text-lg font-medium">No hemos podido cargar los hoteles</p>
                <p className="mb-6 mt-2 text-sm text-muted-foreground">
                  Tu búsqueda se ha conservado. Puedes intentarlo de nuevo.
                </p>
                <Button onClick={retry}>Reintentar</Button>
              </div>
            ) : state.data.total === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed bg-white p-8 text-center">
                <span className="mb-5 rounded-full bg-secondary p-4">
                  <Compass className="size-7 text-[#398d9d]" />
                </span>
                <h3 className="text-xl font-medium">Todavía no hemos encontrado tu hotel</h3>
                <p className="mb-6 mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  Prueba otro destino o amplía los filtros para descubrir más opciones.
                </p>
                <Button onClick={reset}>Ver todos los hoteles</Button>
              </div>
            ) : state.data.hotels.length === 0 ? (
              <div className="rounded-lg border bg-white p-10 text-center">
                <h3 className="text-lg font-medium">Esta página ya no tiene resultados</h3>
                <p className="mb-5 mt-2 text-sm text-muted-foreground">
                  Puedes volver al principio conservando tus filtros.
                </p>
                <Button onClick={() => update({ page: 1 })}>Volver a la primera página</Button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {state.data.hotels.map((hotel) => (
                  <HotelCard
                    key={hotel.id}
                    hotel={hotel}
                    countryLabel={
                      state.data.facets.countries.find((country) => country.value === hotel.country)
                        ?.label
                    }
                    href={hotelHref(hotel.id, query)}
                  />
                ))}
              </div>
            )}

            {state.status === 'ready' && state.data.totalPages > 1 && (
              <nav
                aria-label="Paginación de hoteles"
                className="mt-8 flex items-center justify-between gap-3"
              >
                <span className="text-xs text-muted-foreground">
                  Página {state.data.page} de {state.data.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Página anterior"
                    disabled={query.page <= 1}
                    onClick={() => update({ page: query.page - 1 })}
                  >
                    <ArrowLeft />
                  </Button>
                  <span
                    aria-current="page"
                    className="flex size-9 items-center justify-center rounded-md bg-foreground text-xs text-white"
                  >
                    {query.page}
                  </span>
                  <Button
                    variant="ghost"
                    aria-label="Página siguiente"
                    disabled={query.page >= state.data.totalPages}
                    onClick={() => update({ page: query.page + 1 })}
                  >
                    Siguiente <ArrowRight />
                  </Button>
                </div>
              </nav>
            )}
          </div>
        </section>
      </main>
      <CatalogFooter />
    </>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 font-normal">
      {label}
      <button
        type="button"
        aria-label={`Quitar filtro ${label}`}
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-primary/30"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}
