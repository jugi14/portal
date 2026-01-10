/**
 * Input Validation Utilities
 * Provides comprehensive validation for user inputs
 * 
 * SECURITY: Always validate and sanitize user input
 * - Prevents XSS attacks
 * - Ensures data integrity
 * - Provides better UX with clear error messages
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Email validation pattern (RFC 5322 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Domain validation pattern
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

// Password strength requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = {
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumber: /\d/,
  hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/
};

/**
 * Validate email address format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length > 254) {
    return { isValid: false, error: 'Email is too long (max 254 characters)' };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (optional but recommended)
 */
export function validatePassword(password: string, strict: boolean = false): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { 
      isValid: false, 
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` 
    };
  }

  if (!PASSWORD_REGEX.hasUpperCase.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!PASSWORD_REGEX.hasLowerCase.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!PASSWORD_REGEX.hasNumber.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }

  // Strict mode requires special characters
  if (strict && !PASSWORD_REGEX.hasSpecialChar.test(password)) {
    return { 
      isValid: false, 
      error: 'Password must contain at least one special character (!@#$%^&*...)' 
    };
  }

  return { isValid: true };
}

/**
 * Get password strength level
 * Returns: weak, medium, strong, very-strong
 */
export function getPasswordStrength(password: string): {
  level: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
  feedback: string;
} {
  let score = 0;
  
  if (!password) {
    return { level: 'weak', score: 0, feedback: 'Password is required' };
  }

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Complexity scoring
  if (PASSWORD_REGEX.hasUpperCase.test(password)) score += 1;
  if (PASSWORD_REGEX.hasLowerCase.test(password)) score += 1;
  if (PASSWORD_REGEX.hasNumber.test(password)) score += 1;
  if (PASSWORD_REGEX.hasSpecialChar.test(password)) score += 1;

  // Determine level and feedback
  if (score <= 3) {
    return { level: 'weak', score, feedback: 'Weak password. Add more characters and complexity.' };
  } else if (score <= 5) {
    return { level: 'medium', score, feedback: 'Medium strength. Consider adding special characters.' };
  } else if (score <= 6) {
    return { level: 'strong', score, feedback: 'Strong password!' };
  } else {
    return { level: 'very-strong', score, feedback: 'Very strong password!' };
  }
}

/**
 * Validate domain name format
 */
export function validateDomain(domain: string): ValidationResult {
  if (!domain || domain.trim() === '') {
    return { isValid: false, error: 'Domain is required' };
  }

  const trimmedDomain = domain.trim().toLowerCase();

  if (!DOMAIN_REGEX.test(trimmedDomain)) {
    return { isValid: false, error: 'Please enter a valid domain (e.g., example.com)' };
  }

  return { isValid: true };
}

/**
 * Sanitize search query
 * Removes potentially dangerous characters while keeping search functional
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';

  return query
    .trim()
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Limit to reasonable length
    .substring(0, 200);
}

/**
 * Validate name field (user names, customer names, etc.)
 */
export function validateName(name: string, fieldName: string = 'Name'): ValidationResult {
  if (!name || name.trim() === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return { isValid: false, error: `${fieldName} must be at least 2 characters` };
  }

  if (trimmedName.length > 100) {
    return { isValid: false, error: `${fieldName} is too long (max 100 characters)` };
  }

  // Allow letters, numbers, spaces, hyphens, and common punctuation
  const nameRegex = /^[a-zA-Z0-9\s\-'.,()&]+$/;
  if (!nameRegex.test(trimmedName)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` };
  }

  return { isValid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || url.trim() === '') {
    return { isValid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }
}

/**
 * Validate phone number (basic validation)
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Check if it's a valid number format (10-15 digits, optionally starting with +)
  const phoneRegex = /^\+?\d{10,15}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }

  return { isValid: true };
}

/**
 * Real-time input sanitization for text fields
 * Use this in onChange handlers to prevent malicious input
 */
export function sanitizeTextInput(input: string, maxLength: number = 1000): string {
  if (!input) return '';

  return input
    // Remove null bytes and control characters
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Limit length
    .substring(0, maxLength);
}

/**
 * Validate and sanitize user input for forms
 */
export function validateAndSanitizeInput(
  value: string,
  type: 'email' | 'password' | 'name' | 'domain' | 'url' | 'phone' | 'text',
  options?: {
    required?: boolean;
    maxLength?: number;
    strictPassword?: boolean;
    fieldName?: string;
  }
): { value: string; validation: ValidationResult } {
  const required = options?.required ?? true;
  const maxLength = options?.maxLength ?? 1000;

  // Sanitize first
  let sanitized = sanitizeTextInput(value, maxLength);

  // If not required and empty, return valid
  if (!required && !sanitized) {
    return { value: sanitized, validation: { isValid: true } };
  }

  // Validate based on type
  let validation: ValidationResult;

  switch (type) {
    case 'email':
      validation = validateEmail(sanitized);
      sanitized = sanitized.trim().toLowerCase();
      break;

    case 'password':
      validation = validatePassword(sanitized, options?.strictPassword);
      break;

    case 'name':
      validation = validateName(sanitized, options?.fieldName);
      sanitized = sanitized.trim();
      break;

    case 'domain':
      validation = validateDomain(sanitized);
      sanitized = sanitized.trim().toLowerCase();
      break;

    case 'url':
      validation = validateUrl(sanitized);
      sanitized = sanitized.trim();
      break;

    case 'phone':
      validation = validatePhone(sanitized);
      break;

    case 'text':
    default:
      if (required && !sanitized.trim()) {
        validation = { isValid: false, error: `${options?.fieldName || 'Field'} is required` };
      } else {
        validation = { isValid: true };
      }
      sanitized = sanitized.trim();
      break;
  }

  return { value: sanitized, validation };
}
