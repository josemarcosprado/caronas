/**
 * Phone Number Utilities
 * Uses libphonenumber-js for robust international phone validation
 */

import {
    parsePhoneNumber,
    isValidPhoneNumber,
    formatIncompletePhoneNumber,
    getCountryCallingCode,
    AsYouType
} from 'libphonenumber-js';

/**
 * Default country for phone parsing when no country code is provided
 */
export const DEFAULT_COUNTRY = 'BR';

/**
 * Normalize phone number to E.164 format (e.g., +5579998223366)
 * @param {string} input - Raw phone input
 * @param {string} [defaultCountry='BR'] - Default country code
 * @returns {string|null} - Normalized phone or null if invalid
 */
export function normalizePhone(input, defaultCountry = DEFAULT_COUNTRY) {
    if (!input) return null;

    // Clean input but keep the + sign
    const cleaned = input.replace(/[^\d+]/g, '');

    try {
        const phoneNumber = parsePhoneNumber(cleaned, defaultCountry);
        if (phoneNumber && phoneNumber.isValid()) {
            return phoneNumber.format('E.164'); // +5579998223366
        }
    } catch (e) {
        // Invalid phone
    }

    return null;
}

/**
 * Format phone for display (e.g., +55 79 99822-3366)
 * @param {string} phone - Phone number (any format)
 * @param {string} [defaultCountry='BR'] - Default country
 * @returns {string} - Formatted phone or original input
 */
export function formatPhoneDisplay(phone, defaultCountry = DEFAULT_COUNTRY) {
    if (!phone) return '';

    try {
        const phoneNumber = parsePhoneNumber(phone, defaultCountry);
        if (phoneNumber) {
            return phoneNumber.formatInternational(); // +55 79 99822-3366
        }
    } catch (e) {
        // Return cleaned input
    }

    return phone;
}

/**
 * Format phone as user types (progressive formatting)
 * @param {string} input - Current input value
 * @param {string} [defaultCountry='BR'] - Default country
 * @returns {string} - Formatted input
 */
export function formatPhoneAsYouType(input, defaultCountry = DEFAULT_COUNTRY) {
    if (!input) return '';

    const formatter = new AsYouType(defaultCountry);
    return formatter.input(input);
}

/**
 * Validate phone number
 * @param {string} phone - Phone to validate
 * @param {string} [defaultCountry='BR'] - Default country
 * @returns {{ valid: boolean, error?: string, normalized?: string, country?: string }}
 */
export function validatePhone(phone, defaultCountry = DEFAULT_COUNTRY) {
    if (!phone) {
        return { valid: false, error: 'Número de telefone é obrigatório' };
    }

    // Clean input but keep +
    const cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.length < 8) {
        return { valid: false, error: 'Número muito curto' };
    }

    try {
        const phoneNumber = parsePhoneNumber(cleaned, defaultCountry);

        if (!phoneNumber) {
            return { valid: false, error: 'Formato de telefone inválido' };
        }

        if (!phoneNumber.isValid()) {
            return { valid: false, error: 'Número de telefone inválido' };
        }

        return {
            valid: true,
            normalized: phoneNumber.format('E.164'),
            country: phoneNumber.country,
            formatted: phoneNumber.formatInternational()
        };
    } catch (e) {
        return { valid: false, error: 'Formato de telefone inválido' };
    }
}

/**
 * Extract country code from phone number
 * @param {string} phone - Phone number
 * @returns {string|null} - Country code (e.g., 'BR', 'US')
 */
export function getPhoneCountry(phone) {
    try {
        const phoneNumber = parsePhoneNumber(phone);
        return phoneNumber?.country || null;
    } catch (e) {
        return null;
    }
}

/**
 * Get array of possible phone formats for lookup
 * Useful for matching phones stored in different formats
 * @param {string} phone - Phone number
 * @param {string} [defaultCountry='BR'] - Default country
 * @returns {string[]} - Array of possible formats
 */
export function getPhoneLookupFormats(phone, defaultCountry = DEFAULT_COUNTRY) {
    const formats = new Set();

    // Add original (cleaned)
    const cleaned = phone.replace(/\D/g, '');
    formats.add(cleaned);

    try {
        const phoneNumber = parsePhoneNumber(phone, defaultCountry);

        if (phoneNumber) {
            // E.164 without +
            const e164 = phoneNumber.format('E.164').replace('+', '');
            formats.add(e164);

            // National format (without country code)
            const national = phoneNumber.nationalNumber;
            formats.add(national);

            // With country code
            const countryCode = phoneNumber.countryCallingCode;
            formats.add(countryCode + national);
        }
    } catch (e) {
        // Just use cleaned version
    }

    // For Brazilian numbers, try with/without 55 prefix
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
        formats.add(cleaned.substring(2));
    } else if (!cleaned.startsWith('55') && cleaned.length >= 10) {
        formats.add('55' + cleaned);
    }

    // Brazilian 9th digit handling
    // Celulares brasileiros têm 9 dígitos, mas às vezes são salvos sem o 9 inicial
    // DDD (2 dígitos) + número (8 ou 9 dígitos)
    // Ex: 79998223366 (com 9) vs 7998223366 (sem 9)
    const brazilianVariants = [];

    for (const format of formats) {
        // Extract DDD and number for Brazilian format
        let ddd, numero, prefix = '';

        if (format.startsWith('55') && format.length >= 12) {
            prefix = '55';
            ddd = format.substring(2, 4);
            numero = format.substring(4);
        } else if (format.length >= 10 && format.length <= 11) {
            ddd = format.substring(0, 2);
            numero = format.substring(2);
        } else {
            continue;
        }

        // Celular com 9 dígitos (tem o 9 inicial)
        if (numero.length === 9 && numero.startsWith('9')) {
            // Tentar versão sem o 9 inicial
            const semNove = numero.substring(1);
            brazilianVariants.push(prefix + ddd + semNove);
            if (prefix) brazilianVariants.push(ddd + semNove);
        }

        // Celular com 8 dígitos (não tem o 9 inicial)
        if (numero.length === 8) {
            // Tentar versão com o 9 inicial
            const comNove = '9' + numero;
            brazilianVariants.push(prefix + ddd + comNove);
            if (prefix) brazilianVariants.push(ddd + comNove);
        }
    }

    // Add all variants
    brazilianVariants.forEach(v => formats.add(v));

    return Array.from(formats);
}
