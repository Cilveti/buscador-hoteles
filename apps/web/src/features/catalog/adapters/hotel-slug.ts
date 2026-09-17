import slugify from 'slugify';

export function hotelSlug(name: string): string {
  if (name.trim() === '') {
    return '';
  }
  return slugify(name.replace(/&/g, ' and '), { lower: true, strict: true });
}
