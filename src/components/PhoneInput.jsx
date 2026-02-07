/**
 * Phone Input Component
 * Auto-formats international phone numbers as user types
 */

import { useState, useCallback, useEffect } from 'react';
import { formatPhoneAsYouType, validatePhone, DEFAULT_COUNTRY } from '../lib/phoneUtils.js';

/**
 * Phone input with auto-formatting and validation
 * @param {Object} props
 * @param {string} props.value - Current phone value
 * @param {function} props.onChange - Called with normalized phone value
 * @param {string} [props.placeholder] - Input placeholder
 * @param {string} [props.className] - Additional CSS class
 * @param {boolean} [props.required] - Whether field is required
 * @param {string} [props.defaultCountry='BR'] - Default country code
 */
export default function PhoneInput({
    value = '',
    onChange,
    placeholder = '+55 79 99999-9999',
    className = '',
    required = false,
    defaultCountry = DEFAULT_COUNTRY
}) {
    const [displayValue, setDisplayValue] = useState('');
    const [validation, setValidation] = useState({ valid: false });
    const [touched, setTouched] = useState(false);

    // Sync display value when external value changes
    useEffect(() => {
        if (value && !displayValue) {
            const formatted = formatPhoneAsYouType(value, defaultCountry);
            setDisplayValue(formatted);
        }
    }, [value, displayValue, defaultCountry]);

    const handleChange = useCallback((e) => {
        let input = e.target.value;

        // Auto-add + if first character is a digit
        if (input.length === 1 && /\d/.test(input)) {
            input = '+' + input;
        }

        // Format as user types
        const formatted = formatPhoneAsYouType(input, defaultCountry);
        setDisplayValue(formatted || input);

        // Validate and notify parent with normalized value
        const result = validatePhone(formatted || input, defaultCountry);
        setValidation(result);

        // Pass normalized value (E.164 format) or raw input if invalid
        const valueToPass = result.valid ? result.normalized : (formatted || input).replace(/\D/g, '');
        onChange?.(valueToPass);
    }, [onChange, defaultCountry]);

    const handleBlur = useCallback(() => {
        setTouched(true);
        // Re-validate on blur
        const result = validatePhone(displayValue, defaultCountry);
        setValidation(result);
    }, [displayValue, defaultCountry]);

    const showError = touched && !validation.valid && displayValue.length > 0;
    const showSuccess = validation.valid;

    return (
        <div className="phone-input-wrapper" style={{ position: 'relative' }}>
            <input
                type="tel"
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                className={`form-input ${className} ${showError ? 'input-error' : ''} ${showSuccess ? 'input-success' : ''}`}
                required={required}
                style={{
                    paddingRight: 'var(--space-8)',
                    borderColor: showError ? 'var(--error)' : showSuccess ? 'var(--success)' : undefined
                }}
            />

            {/* Validation icon */}
            <span style={{
                position: 'absolute',
                right: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 'var(--font-size-lg)',
                pointerEvents: 'none'
            }}>
                {showSuccess && '✓'}
                {showError && '✗'}
            </span>

            {/* Error message */}
            {showError && validation.error && (
                <small style={{
                    display: 'block',
                    color: 'var(--error)',
                    fontSize: 'var(--font-size-xs)',
                    marginTop: 'var(--space-1)'
                }}>
                    {validation.error}
                </small>
            )}

            {/* Success info */}
            {showSuccess && validation.country && (
                <small style={{
                    display: 'block',
                    color: 'var(--success)',
                    fontSize: 'var(--font-size-xs)',
                    marginTop: 'var(--space-1)'
                }}>
                    📍 {getCountryName(validation.country)}
                </small>
            )}
        </div>
    );
}

/**
 * Get country name from code
 * @param {string} code - Country code (e.g., 'BR')
 * @returns {string} - Country name
 */
function getCountryName(code) {
    const countries = {
        BR: 'Brasil',
        US: 'Estados Unidos',
        PT: 'Portugal',
        AR: 'Argentina',
        UY: 'Uruguai',
        PY: 'Paraguai',
        CL: 'Chile',
        CO: 'Colômbia',
        MX: 'México',
        ES: 'Espanha',
        FR: 'França',
        DE: 'Alemanha',
        IT: 'Itália',
        GB: 'Reino Unido',
        CA: 'Canadá',
        JP: 'Japão',
        CN: 'China'
    };
    return countries[code] || code;
}
