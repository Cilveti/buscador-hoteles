import type { CatalogHotel } from '@hoteles/contracts/catalog';
import { ArrowUpRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { brandLabels, displayLocation, GuestRating, HotelImage } from './hotel-visuals';

export function HotelCard({
  hotel,
  countryLabel,
  href,
}: {
  hotel: CatalogHotel;
  countryLabel?: string;
  href: string;
}) {
  return (
    <Card
      className="hotel-card gap-0 overflow-hidden rounded-lg border-0 p-0 shadow-[0_4px_24px_#091d2008]"
      data-testid="hotel-card"
    >
      <div className="relative m-3 mb-0">
        <div className="aspect-[1.65] overflow-hidden rounded-md bg-secondary">
          <HotelImage key={hotel.image?.url} image={hotel.image} name={hotel.name} />
        </div>
        <div className="absolute -bottom-3 left-2 right-1">
          <GuestRating hotel={hotel} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 pt-6">
        <p className="text-[11px] text-muted-foreground">
          {hotel.brand ? brandLabels[hotel.brand] : 'Hoteles independientes'}
        </p>
        <h3 className="min-h-12 text-[17px] font-medium leading-snug">{hotel.name}</h3>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{displayLocation(hotel, countryLabel)}</span>
        </p>
        <p className="line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
          {hotel.highlights?.slice(0, 2).join(' · ') ||
            hotel.description ||
            'Descubre los detalles de este hotel.'}
        </p>
        <Button asChild className="mt-auto h-11 w-full font-medium">
          <Link href={href} aria-label={`Ver hotel ${hotel.name}`}>
            Ver hotel <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
