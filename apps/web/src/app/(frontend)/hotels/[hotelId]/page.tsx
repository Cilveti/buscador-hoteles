import { HotelDetailPage } from '@/features/catalog/adapters/hotel-detail-page';

export default async function Page({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  return <HotelDetailPage key={hotelId} hotelId={hotelId} />;
}
