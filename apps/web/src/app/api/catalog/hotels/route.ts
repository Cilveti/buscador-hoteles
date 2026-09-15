import { createCatalogHandler } from './handler';

export const dynamic = 'force-dynamic';
export const GET = createCatalogHandler(async () => {
  const { loadCatalog } = await import('../../../../composition/catalog/load-catalog');
  return loadCatalog();
});
