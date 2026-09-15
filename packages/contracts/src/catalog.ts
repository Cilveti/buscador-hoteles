import { z } from 'zod';
import { CatalogAttributesSchema, CatalogBrandSchema, PetFilterSchema } from './catalog-attributes';

const BrandSchema = CatalogBrandSchema;
const numericInput = z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number());
const selectedValues = z
  .union([z.array(z.string()), z.string().transform((value) => value.split(','))])
  .pipe(z.array(z.string().trim().min(1).max(160)).max(20))
  .transform((values) => [...new Set(values)]);

export const CatalogQuerySchema = z
  .object({
    q: z.string().trim().max(500).default(''),
    country: z.string().trim().min(1).max(100).optional(),
    brand: BrandSchema.optional(),
    minRating: numericInput.pipe(z.number().min(0).max(5)).optional(),
    destination: z.string().trim().min(1).max(160).optional(),
    stars: numericInput.pipe(z.number().int().min(1).max(5)).optional(),
    services: selectedValues.optional(),
    themes: selectedValues.optional(),
    pets: PetFilterSchema.optional(),
    sort: z.enum(['name', 'rating']).default('name'),
    page: numericInput.pipe(z.number().int().positive()).default(1),
    pageSize: numericInput.pipe(z.number().int().min(1).max(24)).default(12),
  })
  .strict();

export const CatalogHotelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  descriptionSource: z
    .object({
      kind: z.enum(['editorial', 'synthetic']),
      sourceUrl: z.httpUrl().nullable(),
      sourceRevision: z.string().min(1),
      capturedAt: z.iso.datetime().optional(),
    })
    .optional(),
  sourceUrl: z.httpUrl().nullable(),
  location: z.string().nullable(),
  country: z.string().nullable(),
  brand: BrandSchema.nullable(),
  guestRating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  highlights: z.array(z.string()).nullable(),
  labels: z.array(z.string()).nullable(),
  image: z
    .object({
      url: z.union([z.httpUrl(), z.string().regex(/^\/images\/[a-z0-9-]+\.svg$/u)]),
      alt: z.string().nullable(),
    })
    .nullable(),
  attributes: CatalogAttributesSchema.optional(),
});

// Local public-route identifier, allowing both observed IDs and named synthetic fixtures.
export const CatalogHotelIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/u);
export const CatalogHotelDetailResponseSchema = z.object({
  hotel: CatalogHotelSchema,
  countryLabel: z.string().nullable(),
});

const FacetSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int().positive(),
});
export const CatalogResponseSchema = z.object({
  hotels: z.array(CatalogHotelSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(24),
  totalPages: z.number().int().nonnegative(),
  facets: z.object({
    countries: z.array(FacetSchema),
    brands: z.array(FacetSchema),
    destinations: z.array(FacetSchema).optional(),
    stars: z.array(FacetSchema).optional(),
    services: z.array(FacetSchema).optional(),
    themes: z.array(FacetSchema).optional(),
    pets: z.array(FacetSchema).optional(),
  }),
});

export const CatalogCapabilitiesSchema = z.object({
  scope: z.literal('hotel-catalog'),
  facets: CatalogResponseSchema.shape.facets,
  querySchema: z.record(z.string(), z.unknown()),
  coverage: z.object({
    hotels: z.number().int(),
    stars: z.number().int(),
    services: z.number().int(),
    themes: z.number().int(),
    destinations: z.number().int(),
    petPolicies: z.number().int(),
    petSourceConflicts: z.number().int(),
  }),
  notVerified: z.array(
    z.object({ field: z.string(), status: z.literal('not-verified'), reason: z.string() }),
  ),
  semantics: z.object({
    services: z.literal('all-required-available'),
    themes: z.literal('all-required'),
    pets: z.literal('exact-status-unless-explicitly-combined'),
  }),
});

export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;
export type CatalogHotel = z.infer<typeof CatalogHotelSchema>;
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;
export type CatalogHotelDetailResponse = z.infer<typeof CatalogHotelDetailResponseSchema>;
export type CatalogCapabilities = z.infer<typeof CatalogCapabilitiesSchema>;
export type { CatalogAttributes } from './catalog-attributes';
export {
  CatalogAttributeDatasetSchema,
  CatalogAttributesSchema,
  CatalogBrandSchema,
  PetFilterSchema,
  PetStatusSchema,
} from './catalog-attributes';
