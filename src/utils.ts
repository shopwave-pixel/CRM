/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import toast from 'react-hot-toast';

/**
 * Validates a Bangladeshi mobile phone number and formats it.
 * Supports:
 * - 01XXXXXXXXX (11 digits)
 * - +8801XXXXXXXXX (14 chars)
 * - 8801XXXXXXXXX (13 digits)
 *
 * Automatically formats and stores every phone number as: +8801XXXXXXXXX
 */
export function validateAndFormatBDPhone(phoneStr: string): { isValid: boolean; formatted: string; error?: string } {
  // Remove all spaces, hyphens, dashes, parentheses
  const cleaned = phoneStr.replace(/[\s\-\(\)\+]/g, '');

  // Must contain only digits now
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      formatted: '',
      error: 'Phone number must contain only numbers, spaces, or hyphens.'
    };
  }

  // Check 11 digits starting with 01
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    return { isValid: true, formatted: `+88${cleaned}` };
  }

  // Check 13 digits starting with 8801
  if (cleaned.length === 13 && cleaned.startsWith('8801')) {
    return { isValid: true, formatted: `+${cleaned}` };
  }

  return {
    isValid: false,
    formatted: '',
    error: 'Invalid Bangladeshi mobile number. Supported formats: 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX.'
  };
}

/**
 * Formats a normalized phone number (+8801XXXXXXXXX) into Bangladeshi format: +880 1712-345678
 */
export function formatBDPhoneForDisplay(phoneStr: string): string {
  if (!phoneStr) return '';
  const cleaned = phoneStr.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('880')) {
    return `+880 ${cleaned.substring(3, 7)}-${cleaned.substring(7)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    return `+880 ${cleaned.substring(1, 5)}-${cleaned.substring(5)}`;
  }
  // If it's already +8801...
  if (phoneStr.startsWith('+880') && phoneStr.length === 14) {
    const digits = phoneStr.substring(4);
    return `+880 ${digits.substring(0, 4)}-${digits.substring(4)}`;
  }
  return phoneStr;
}

/**
 * Formats date/time in Asia/Dhaka timezone with DD/MM/YYYY format and 12-hour time with AM/PM.
 */
export function getBangladeshDateTimeString(dateInput?: string | Date | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    
    // Format is "MM/DD/YYYY, hh:mm:ss AM/PM"
    const formatted = formatter.format(d);
    const [datePart, timePart] = formatted.split(', ');
    const [month, day, year] = datePart.split('/');
    
    return `${day}/${month}/${year} ${timePart}`;
  } catch (e) {
    // Fallback if Intl fails
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${day}/${month}/${year} ${pad(hours)}:${minutes}:${seconds} ${ampm}`;
  }
}

/**
 * Formats date only as DD/MM/YYYY in Asia/Dhaka timezone.
 */
export function getBangladeshDateString(dateInput?: string | Date | number): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    
    // Format is "MM/DD/YYYY"
    const formatted = formatter.format(d);
    const [month, day, year] = formatted.split('/');
    return `${day}/${month}/${year}`;
  } catch (e) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
}

/**
 * Converts YYYY-MM-DD input date (from HTML date input) to DD/MM/YYYY format for storing.
 */
export function inputDateToBD(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr; // already formatted
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Converts DD/MM/YYYY stored date to YYYY-MM-DD format for HTML date input.
 */
export function bdDateToInput(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('-')) return dateStr; // already YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

/**
 * Normalizes phone number for search indexing/matching by ignoring +880, 880, spaces, hyphens.
 */
export function cleanPhoneForSearch(phone: string): string {
  // Remove all non-digits (spaces, hyphens, plus signs, etc.)
  let cleaned = phone.replace(/\D/g, '');
  
  // Strip 880 or 88 prefixes
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  
  // Strip leading 0 if present (so 017... matches 17...)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
}

/**
 * Parses a stored Bangladeshi date/time format (DD/MM/YYYY hh:mm:ss AM/PM or DD/MM/YYYY) into a JS Date object.
 */
export function parseBDDate(bdStr?: string): Date | null {
  if (!bdStr) return null;
  try {
    const trimmed = bdStr.trim();
    // Check if it's already an ISO string or standard date
    if (trimmed.includes('T') || (!trimmed.includes('/') && trimmed.includes('-'))) {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }

    // Standard format is: "DD/MM/YYYY hh:mm:ss AM/PM" or "DD/MM/YYYY"
    const [datePart, ...timeParts] = trimmed.split(/\s+/);
    const [day, month, year] = datePart.split('/').map(Number);
    
    if (!day || !month || !year) return null;

    let hour = 0;
    let minute = 0;
    let second = 0;

    if (timeParts.length > 0) {
      // timeParts is e.g. ["hh:mm:ss", "AM/PM"]
      const hms = timeParts[0];
      const ampm = timeParts[1];
      const parts = hms.split(':').map(Number);
      hour = parts[0] || 0;
      minute = parts[1] || 0;
      second = parts[2] || 0;

      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour < 12) {
          hour += 12;
        } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
          hour = 0;
        }
      }
    }

    // Month in Date constructor is 0-indexed
    const d = new Date(year, month - 1, day, hour, minute, second);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

/**
 * Initiates a phone call via tel protocol, showing appropriate toasts and warning for desktop users.
 */
export function handlePhoneCall(phoneNumber: string, client?: any): void {
  if (!phoneNumber) {
    toast.error('No phone number available.');
    return;
  }
  const cleanNum = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  const telUrl = `tel:+${cleanNum}`;
  
  toast.success('Opening phone dialer...');
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isMobile) {
    setTimeout(() => {
      toast('Calling is only available on supported devices.', {
        icon: 'ℹ️',
        duration: 4000
      });
    }, 500);
  }
  
  // Dispatch custom event to trigger Call Log Result modal on frontend
  window.dispatchEvent(new CustomEvent('crm-phone-call', { 
    detail: { phoneNumber, client } 
  }));

  window.location.href = telUrl;
}

/**
 * Opens WhatsApp chat with a given phone number.
 */
export function handleWhatsAppMessage(phoneNumber: string): void {
  if (!phoneNumber) {
    toast.error('No phone number available.');
    return;
  }
  const cleanNum = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  const waUrl = `https://wa.me/${cleanNum}`;
  
  toast.success('Opening WhatsApp...');
  window.open(waUrl, '_blank', 'noreferrer');
}

/**
 * Copies text to clipboard and shows a toast message.
 */
export function copyToClipboard(text: string, successMessage: string): void {
  if (!text) return;
  navigator.clipboard.writeText(text)
    .then(() => {
      toast.success(successMessage);
    })
    .catch((err) => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy to clipboard.');
    });
}

