import slugifyLib from 'slugify';

export function hotelSlug(name: string): string {
  return slugifyLib(name, { lower: true, strict: true, trim: true, replacement: '-' });
}
