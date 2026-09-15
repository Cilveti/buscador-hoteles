'use client';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Compass, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { textFragments } from '@/components/text-fragments';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { resultsHref } from '../application/hotel-navigation';
import { CatalogFooter, CatalogHeader } from './catalog-shell';
import { brandLabels, displayLocation, GuestRating, HotelImage } from './hotel-visuals';
import { httpHotelDetail } from './http-hotel-detail';
import { useHotelDetail } from './use-hotel-detail';

export function HotelDetailPage({ hotelId }: { hotelId: string }) {
  const { state, retry } = useHotelDetail(hotelId, httpHotelDetail);
  const [backHref, setBackHref] = useState('/');
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-read the return URL when navigating to another hotel within the same component.
  useEffect(() => {
    setBackHref(resultsHref(new URLSearchParams(window.location.search)));
  }, [hotelId]);

  return (
    <>
      <a
        href="#hotel-detail"
        className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:p-3"
      >
        Saltar al detalle del hotel
      </a>
      <CatalogHeader resultsHref={backHref} />
      <main
        id="hotel-detail"
        className="page-width min-h-[calc(100dvh-190px)] pb-14 pt-7 sm:pb-20 sm:pt-9"
      >
        <Link
          href={backHref}
          className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a resultados
        </Link>

        {state.status === 'loading' && (
          <div
            role="status"
            aria-label="Cargando detalle del hotel"
            aria-busy="true"
            className="space-y-6"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="aspect-[3/2] w-full rounded-lg sm:aspect-auto sm:h-[440px]" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {state.status === 'error' && (
          <div role="alert" className="rounded-lg border bg-white px-6 py-16 text-center">
            <h1 className="text-2xl font-medium">No hemos podido cargar este hotel</h1>
            <p className="mb-6 mt-3 text-sm text-muted-foreground">
              Puedes intentarlo de nuevo o regresar a tu búsqueda.
            </p>
            <Button onClick={retry}>Reintentar</Button>
          </div>
        )}

        {state.status === 'not-found' && (
          <div className="flex flex-col items-center rounded-lg border bg-white px-6 py-16 text-center">
            <Compass className="mb-5 size-9 text-muted-foreground" />
            <h1 className="text-2xl font-medium">No encontramos este hotel</h1>
            <p className="mb-6 mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              La ficha no está disponible en nuestro catálogo. Puedes volver a tu búsqueda o
              descubrir otros hoteles.
            </p>
            <Button asChild>
              <Link href="/">Ver todos los hoteles</Link>
            </Button>
          </div>
        )}

        {state.status === 'ready' && (
          <article>
            <header className="mb-7 space-y-4 sm:mb-8">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.12em] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-coral" />
                {state.data.hotel.brand
                  ? brandLabels[state.data.hotel.brand]
                  : 'Hoteles independientes'}
              </p>
              <h1 className="max-w-5xl break-words text-[30px] font-medium leading-[1.2] tracking-[-.7px] sm:text-[40px]">
                {state.data.hotel.name}
              </h1>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {displayLocation(state.data.hotel, state.data.countryLabel ?? undefined)}
                </p>
                <GuestRating hotel={state.data.hotel} />
              </div>
            </header>

            <figure
              data-testid="hotel-detail-image"
              className="m-0 aspect-[3/2] w-full overflow-hidden rounded-lg bg-secondary sm:aspect-auto sm:h-[440px]"
            >
              <HotelImage
                key={state.data.hotel.id}
                image={state.data.hotel.image}
                name={state.data.hotel.name}
                width={1600}
                eager
              />
            </figure>

            <div className="mt-9 grid items-start gap-8 sm:mt-10 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)] lg:gap-14">
              <section aria-labelledby="hotel-description-title" className="min-w-0">
                <h2
                  id="hotel-description-title"
                  className="mb-5 text-2xl font-medium tracking-[-.4px]"
                >
                  Sobre el hotel
                </h2>
                <HotelDescription description={state.data.hotel.description} />
              </section>
              <aside
                className="min-w-0 space-y-6 rounded-lg border bg-white p-6 sm:p-7"
                aria-label="Información destacada del hotel"
              >
                {state.data.hotel.highlights && state.data.hotel.highlights.length > 0 && (
                  <section aria-labelledby="hotel-highlights-title">
                    <h2 id="hotel-highlights-title" className="mb-5 text-lg font-medium">
                      Lo que encontrarás
                    </h2>
                    <ul className="space-y-4">
                      {state.data.hotel.highlights.map((text) => (
                        <li key={text} className="flex items-start gap-3 text-sm leading-6">
                          <span className="mt-0.5 rounded-full bg-secondary p-1">
                            <Check className="size-3.5 shrink-0" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 break-words">{text}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {state.data.hotel.sourceUrl && (
                  <div className={state.data.hotel.highlights?.length ? 'border-t pt-6' : ''}>
                    <p className="mb-4 text-sm leading-6 text-muted-foreground">
                      Amplía la información del hotel en su página oficial.
                    </p>
                    <Button asChild className="h-12 w-full">
                      <a
                        href={state.data.hotel.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver ficha oficial <ArrowUpRight className="size-4" />
                      </a>
                    </Button>
                  </div>
                )}
              </aside>
            </div>
          </article>
        )}
      </main>
      <CatalogFooter />
    </>
  );
}

function HotelDescription({ description }: { description: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const paragraphs = (
    description || 'Consulta la ficha oficial para conocer todos los detalles del hotel.'
  )
    .split(/\n\s*\n/)
    .filter((text) => text.trim());
  return (
    <>
      <div
        id="hotel-description"
        className="space-y-5 break-words text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8"
      >
        {textFragments(
          (expanded ? paragraphs : paragraphs.slice(0, 2)).map((text) => ({ text })),
        ).map(({ text, start }) => (
          <p key={start} className="whitespace-pre-line">
            {text}
          </p>
        ))}
      </div>
      {paragraphs.length > 2 && (
        <Button
          variant="outline"
          aria-expanded={expanded}
          aria-controls="hotel-description"
          onClick={() => setExpanded((value) => !value)}
          className="mt-6 h-11 max-w-full bg-white"
        >
          {expanded ? 'Mostrar menos' : 'Leer descripción completa'}
          <ChevronDown
            className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </Button>
      )}
    </>
  );
}
