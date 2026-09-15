import { createCatalogHotelHandler } from './handler';

export const dynamic = 'force-dynamic';
export const GET = createCatalogHotelHandler(async () => {
  const { loadCatalog } = await import('../../../../../composition/catalog/load-catalog');
  return loadCatalog();
});
