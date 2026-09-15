// Exact country spellings observed in catalog-details.json. New values remain visible.
const countryCodes: Readonly<Record<string, string>> = {
  Spain: 'ES',
  Thailand: 'TH',
  'United Arab Emirates': 'AE',
  Turkiye: 'TR',
  'Dominican Republic': 'DO',
  Mexico: 'MX',
  Aruba: 'AW',
  Italy: 'IT',
  Hungary: 'HU',
  Germany: 'DE',
  'Cape Verde': 'CV',
  'Czech Republic': 'CZ',
  Morocco: 'MA',
  France: 'FR',
  Portugal: 'PT',
  Poland: 'PL',
  'El Salvador': 'SV',
  'Costa Rica': 'CR',
  Nicaragua: 'NI',
  Guatemala: 'GT',
  Slovenia: 'SI',
  Malta: 'MT',
  Egypt: 'EG',
  Maldives: 'MV',
  Indonesia: 'ID',
  Bulgaria: 'BG',
  Tunisia: 'TN',
  'Saudi Arabia': 'SA',
  Bahrain: 'BH',
  Oman: 'OM',
};
const displayNames = new Intl.DisplayNames(['es'], { type: 'region' });

export function countryLabel(country: string): string {
  const code = countryCodes[country];
  return code ? (displayNames.of(code) ?? country) : country;
}
