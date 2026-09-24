import { z } from 'zod';

export const CatalogBrandSchema = z.enum(['aurora', 'brisa', 'mirador', 'natura', 'urbana']);
export const PetStatusSchema = z.enum(['unknown', 'allowed', 'conditional', 'not-allowed']);
export const PetFilterSchema = z.enum([
  'unknown',
  'allowed',
  'conditional',
  'not-allowed',
  'allowed-or-conditional',
]);
const OptionSchema = z.object({ value: z.string(), label: z.string() });
export const CatalogAttributesSchema = z.object({
  stars: z.number().int().min(1).max(5).nullable(),
  destinations: z
    .array(
      OptionSchema.extend({ level: z.enum(['city', 'province', 'state', 'country', 'continent']) }),
    )
    .nullable(),
  themes: z.array(OptionSchema).nullable(),
  services: z
    .array(OptionSchema.extend({ availability: z.enum(['available', 'conditional']) }))
    .nullable(),
  pets: z.object({
    status: PetStatusSchema,
    policyText: z.string().nullable(),
    sourceUrl: z.httpUrl().nullable(),
    sourceConflict: z.boolean(),
  }),
  adultsOnly: z.boolean().nullable(),
  provenance: z.object({
    kind: z.enum(['synthetic', 'observed-public']),
    sourceUrl: z.httpUrl(),
    capturedAt: z.iso.datetime(),
  }),
});
export type CatalogAttributes = z.infer<typeof CatalogAttributesSchema>;
export const CatalogAttributeDatasetSchema = z.object({
  hotels: z.array(
    z.object({
      hotelId: z.string(),
      brand: CatalogBrandSchema.nullable().catch(null),
      attributes: CatalogAttributesSchema,
    }),
  ),
});
