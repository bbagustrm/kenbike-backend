// src/common/constants/countries.ts
// Shared country codes for all DTOs

export const SUPPORTED_COUNTRIES = [
    // Domestic
    'ID', // Indonesia

    // Zone 1 - Southeast Asia
    'SG', // Singapore
    'MY', // Malaysia
    'TH', // Thailand
    'PH', // Philippines
    'VN', // Vietnam
    'BN', // Brunei
    'KH', // Cambodia
    'LA', // Laos
    'MM', // Myanmar
    'TL', // Timor-Leste

    // Zone 2 - East Asia
    'CN', // China
    'HK', // Hong Kong
    'TW', // Taiwan
    'KR', // South Korea
    'JP', // Japan
    'MO', // Macau

    // Zone 3 - South Asia & Middle East
    'IN', // India
    'PK', // Pakistan
    'BD', // Bangladesh
    'LK', // Sri Lanka
    'NP', // Nepal
    'BT', // Bhutan
    'MV', // Maldives
    'AE', // United Arab Emirates
    'SA', // Saudi Arabia
    'KW', // Kuwait
    'QA', // Qatar
    'BH', // Bahrain
    'OM', // Oman
    'JO', // Jordan
    'IL', // Israel
    'LB', // Lebanon

    // Zone 4 - Oceania
    'AU', // Australia
    'NZ', // New Zealand
    'PG', // Papua New Guinea
    'FJ', // Fiji
    'NC', // New Caledonia
    'PF', // French Polynesia
    'WS', // Samoa
    'TO', // Tonga
    'VU', // Vanuatu

    // Zone 5 - Europe
    'GB', // United Kingdom
    'FR', // France
    'DE', // Germany
    'IT', // Italy
    'ES', // Spain
    'NL', // Netherlands
    'BE', // Belgium
    'CH', // Switzerland
    'AT', // Austria
    'SE', // Sweden
    'NO', // Norway
    'DK', // Denmark
    'FI', // Finland
    'PL', // Poland
    'CZ', // Czech Republic
    'PT', // Portugal
    'GR', // Greece
    'IE', // Ireland
    'RO', // Romania
    'HU', // Hungary

    // Zone 6 - Americas
    'US', // United States
    'CA', // Canada
    'MX', // Mexico
    'BR', // Brazil
    'AR', // Argentina
    'CL', // Chile
    'CO', // Colombia
    'PE', // Peru
    'VE', // Venezuela
    'CR', // Costa Rica
    'PA', // Panama

    // Zone 7 - Africa
    'ZA', // South Africa
    'EG', // Egypt
    'NG', // Nigeria
    'KE', // Kenya
    'MA', // Morocco
    'GH', // Ghana
    'TZ', // Tanzania
    'UG', // Uganda
    'ET', // Ethiopia
    'DZ', // Algeria
] as const;

export type CountryCode = typeof SUPPORTED_COUNTRIES[number];

// Country code to name mapping
export const COUNTRY_NAMES: Record<CountryCode, string> = {
    // Domestic
    'ID': 'Indonesia',

    // Zone 1 - Southeast Asia
    'SG': 'Singapore',
    'MY': 'Malaysia',
    'TH': 'Thailand',
    'PH': 'Philippines',
    'VN': 'Vietnam',
    'BN': 'Brunei',
    'KH': 'Cambodia',
    'LA': 'Laos',
    'MM': 'Myanmar',
    'TL': 'Timor-Leste',

    // Zone 2 - East Asia
    'CN': 'China',
    'HK': 'Hong Kong',
    'TW': 'Taiwan',
    'KR': 'South Korea',
    'JP': 'Japan',
    'MO': 'Macau',

    // Zone 3 - South Asia & Middle East
    'IN': 'India',
    'PK': 'Pakistan',
    'BD': 'Bangladesh',
    'LK': 'Sri Lanka',
    'NP': 'Nepal',
    'BT': 'Bhutan',
    'MV': 'Maldives',
    'AE': 'United Arab Emirates',
    'SA': 'Saudi Arabia',
    'KW': 'Kuwait',
    'QA': 'Qatar',
    'BH': 'Bahrain',
    'OM': 'Oman',
    'JO': 'Jordan',
    'IL': 'Israel',
    'LB': 'Lebanon',

    // Zone 4 - Oceania
    'AU': 'Australia',
    'NZ': 'New Zealand',
    'PG': 'Papua New Guinea',
    'FJ': 'Fiji',
    'NC': 'New Caledonia',
    'PF': 'French Polynesia',
    'WS': 'Samoa',
    'TO': 'Tonga',
    'VU': 'Vanuatu',

    // Zone 5 - Europe
    'GB': 'United Kingdom',
    'FR': 'France',
    'DE': 'Germany',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark',
    'FI': 'Finland',
    'PL': 'Poland',
    'CZ': 'Czech Republic',
    'PT': 'Portugal',
    'GR': 'Greece',
    'IE': 'Ireland',
    'RO': 'Romania',
    'HU': 'Hungary',

    // Zone 6 - Americas
    'US': 'United States',
    'CA': 'Canada',
    'MX': 'Mexico',
    'BR': 'Brazil',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colombia',
    'PE': 'Peru',
    'VE': 'Venezuela',
    'CR': 'Costa Rica',
    'PA': 'Panama',

    // Zone 7 - Africa
    'ZA': 'South Africa',
    'EG': 'Egypt',
    'NG': 'Nigeria',
    'KE': 'Kenya',
    'MA': 'Morocco',
    'GH': 'Ghana',
    'TZ': 'Tanzania',
    'UG': 'Uganda',
    'ET': 'Ethiopia',
    'DZ': 'Algeria',
};

export function getCountryName(code: string): string {
    return COUNTRY_NAMES[code as CountryCode] || code;
}

export function isValidCountryCode(code: string): code is CountryCode {
    return SUPPORTED_COUNTRIES.includes(code as CountryCode);
}