import { CatalogAttributeDatasetSchema } from '@hoteles/contracts/catalog';
import { getPayload } from 'payload';
import catalogAttributes from '../../../../../data/hotels/catalog-attributes.json';
import catalogDetails from '../../../../../data/hotels/catalog-details.json';
import catalogImages from '../../../../../data/hotels/catalog-images.json';
import config from '../../payload.config';
import { projectHotels } from './project-hotels';

const attributes = CatalogAttributeDatasetSchema.parse(catalogAttributes).hotels;

/** Deliberate public projection through Local API; collection REST access stays administrative. */
export async function loadCatalog() {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: 'hotels',
    overrideAccess: true,
    depth: 0,
    pagination: false,
    limit: 0,
    select: {
      externalHotelId: true,
      name: true,
      sourceName: true,
      sourceUrl: true,
      sourceDescription: true,
      sourceRevision: true,
      capturedAt: true,
      editorialDescription: true,
    },
  });
  return projectHotels(result.docs, catalogDetails.hotels, catalogImages.images, attributes);
}
