import { createCapabilitiesHandler } from './handler';

export const dynamic = 'force-dynamic';
export const GET = createCapabilitiesHandler(async () => {
  const { loadCatalog } = await import('../../../../composition/catalog/load-catalog');
  return loadCatalog();
});
