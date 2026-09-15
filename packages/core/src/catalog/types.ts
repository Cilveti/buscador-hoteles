export type HotelBrand = 'aurora' | 'brisa' | 'mirador' | 'natura' | 'urbana';
export type PetStatus = 'unknown' | 'allowed' | 'conditional' | 'not-allowed';
export type CatalogAttributes = {
  stars: number | null;
  destinations:
    | {
        value: string;
        label: string;
        level: 'city' | 'province' | 'state' | 'country' | 'continent';
      }[]
    | null;
  themes: { value: string; label: string }[] | null;
  services: { value: string; label: string; availability: 'available' | 'conditional' }[] | null;
  pets: {
    status: PetStatus;
    policyText: string | null;
    sourceUrl: string | null;
    sourceConflict: boolean;
  };
  adultsOnly: boolean | null;
  provenance: { kind: 'synthetic'; sourceUrl: string; capturedAt: string };
};

/** Public hotel facts, without operational availability or administrative state. */
export type CatalogHotel = {
  id: string;
  name: string;
  description: string | null;
  descriptionSource?: {
    kind: 'editorial' | 'synthetic';
    sourceUrl: string | null;
    sourceRevision: string;
    capturedAt?: string;
  };
  sourceUrl: string | null;
  location: string | null;
  country: string | null;
  brand: HotelBrand | null;
  guestRating: number | null;
  reviewCount: number | null;
  highlights: string[] | null;
  labels: string[] | null;
  image: { url: string; alt: string | null } | null;
  attributes?: CatalogAttributes;
};

export type CatalogQuery = {
  q: string;
  country?: string;
  brand?: HotelBrand;
  minRating?: number;
  destination?: string;
  stars?: number;
  services?: string[];
  themes?: string[];
  pets?: PetStatus | 'allowed-or-conditional';
  sort: 'name' | 'rating';
  page: number;
  pageSize: number;
};

export type CatalogFacet = { value: string; label: string; count: number };
export type CatalogResponse = {
  hotels: CatalogHotel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    countries: CatalogFacet[];
    brands: CatalogFacet[];
    destinations?: CatalogFacet[];
    stars?: CatalogFacet[];
    services?: CatalogFacet[];
    themes?: CatalogFacet[];
    pets?: CatalogFacet[];
  };
};

export type LoadCatalog = () => Promise<readonly CatalogHotel[]>;
