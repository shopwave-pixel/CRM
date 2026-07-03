/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Utils.gs - Shared Utility Functions
 */

function validateAndFormatBDPhone(phoneStr) {
  if (!phoneStr) {
    return { isValid: false, error: "Phone number is required." };
  }
  var cleaned = phoneStr.replace(/[\s\-\(\)\+]/g, '');
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, error: "Phone number must contain only numbers, spaces, or hyphens." };
  }
  if (cleaned.length === 11 && cleaned.indexOf('01') === 0) {
    return { isValid: true, formatted: "+88" + cleaned };
  }
  if (cleaned.length === 13 && cleaned.indexOf('8801') === 0) {
    return { isValid: true, formatted: "+" + cleaned };
  }
  return {
    isValid: false,
    error: "Invalid Bangladeshi mobile number. Supported formats: 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX."
  };
}

function getBangladeshDateTimeString(dateInput) {
  var d = dateInput ? new Date(dateInput) : new Date();
  return Utilities.formatDate(d, "Asia/Dhaka", "dd/MM/yyyy hh:mm:ss a");
}

function getBangladeshDateString(dateInput) {
  if (!dateInput) return "";
  var d = new Date(dateInput);
  return Utilities.formatDate(d, "Asia/Dhaka", "dd/MM/yyyy");
}

function parseBDDate(dateStr) {
  if (!dateStr) return null;
  var parts = dateStr.split('/');
  if (parts.length === 3) {
    var day = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return null;
}
