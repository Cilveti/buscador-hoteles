import type { CatalogHotel } from '@hoteles/contracts/catalog';
import { Building2, Star } from 'lucide-react';
import { useState } from 'react';

export const brandLabels = {
  aurora: 'Aurora',
  brisa: 'Brisa',
  mirador: 'Mirador',
  natura: 'Natura',
  urbana: 'Urbana',
};
const numbers = new Intl.NumberFormat('es-ES');

export function displayLocation(hotel: CatalogHotel, countryLabel: string | undefined) {
  if (!hotel.location) return 'Destino por confirmar';
  if (hotel.country && countryLabel && hotel.location.endsWith(hotel.country)) {
    return hotel.location.slice(0, -hotel.country.length) + countryLabel;
  }
  return hotel.location;
}

export function HotelImage({
  image,
  name,
  className = '',
  width = 720,
  eager = false,
}: {
  image: CatalogHotel['image'];
  name: string;
  className?: string;
  width?: number;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return image && !failed ? (
    <img
      src={image.url}
      width={width}
      alt={name}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`hotel-photo ${className}`}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-secondary text-secondary-foreground ${className}`}
    >
      <Building2 className="size-7 opacity-50" aria-hidden="true" />
      <span className="text-xs">Imagen no disponible</span>
    </div>
  );
}

export function GuestRating({ hotel }: { hotel: CatalogHotel }) {
  const observed = hotel.attributes?.provenance.kind === 'observed-public';
  return hotel.guestRating !== null ? (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-medium">
        <Star className="size-3 fill-foreground text-foreground" aria-hidden="true" />
        {numbers.format(hotel.guestRating)}
        <span className="font-normal">/ 5</span>
      </span>
      <span className="rounded-md bg-white/95 px-1.5 py-1 text-muted-foreground">
        {hotel.reviewCount !== null
          ? `${numbers.format(hotel.reviewCount)} ${observed ? 'valoraciones en la captura' : 'valoraciones simuladas'}`
          : observed
            ? 'Valoración de la captura'
            : 'Valoración simulada'}
      </span>
    </div>
  ) : (
    <p className="text-xs text-muted-foreground">Sin valoración disponible</p>
  );
}
