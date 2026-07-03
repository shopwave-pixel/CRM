/**
 * Google Apps Script Backend for Enterprise CRM
 * File: API.gs - Google REST API Adapters and Sheet Operations
 */

function getSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  
  try {
    var prop = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (prop) {
      return SpreadsheetApp.openById(prop);
    }
  } catch (e) {}
  
  return null;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(ss, sheetName) {
  if (!ss) return [];
  var s = ss.getSheetByName(sheetName);
  if (!s) return [];
  
  var values = s.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  var headers = values[0];
  var data = [];
  
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var headerName = headers[j];
      var key = headerName.replace(/\s+/g, "").replace("&", "And");
      var camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      
      var val = row[j];
      if (val === "TRUE" || val === true) val = true;
      else if (val === "FALSE" || val === false) val = false;
      
      obj[camelKey] = val;
    }
    data.push(obj);
  }
  
  return data;
}

function initSheets(ss) {
  if (!ss) return;
  for (var key in SHEET_NAMES) {
    if (SHEET_NAMES.hasOwnProperty(key)) {
      var name = SHEET_NAMES[key];
      var sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(HEADERS[key]);
        
        // Auto-format header row
        var headerRange = sheet.getRange(1, 1, 1, HEADERS[key].length);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#f1f5f9");
        sheet.setFrozenRows(1);
      } else {
        // Ensure columns match headers (migration/extension of sheets and auto-repair)
        var lastColumn = sheet.getLastColumn();
        var expectedHeaders = HEADERS[key];
        if (lastColumn < expectedHeaders.length) {
          var missingHeaders = expectedHeaders.slice(lastColumn);
          sheet.getRange(1, lastColumn + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        }
      }
    }
  }
}

// Initialize CRM Database (Stand-alone or Bound)
function initializeDatabase(ss, postData) {
  try {
    var now = getBangladeshDateTimeString();
    var ownerEmail = (postData.ownerEmail || "mrinal2192@gmail.com").toString().trim().toLowerCase();
    var ownerName = postData.ownerName || "System Owner";
    
    // If spreadsheet is not found, automatically create a new one in the owner's Google Drive
    if (!ss) {
      try {
        ss = SpreadsheetApp.create("Enterprise CRM Database");
        PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
      } catch (e) {
        return { success: false, error: "Failed to automatically create spreadsheet. Please check your Apps Script execution permissions: " + e.toString() };
      }
    }
    
    // Ensure all 10 sheets and headers are created
    initSheets(ss);
    
    // Create default settings in Settings sheet if it is empty
    var settingsSheet = ss.getSheetByName("Settings");
    if (settingsSheet) {
      var values = settingsSheet.getDataRange().getValues();
      if (values.length <= 1) {
        settingsSheet.appendRow(["timezone", "Asia/Dhaka", "System Timezone", now]);
        settingsSheet.appendRow(["system_name", "Enterprise CRM", "Name of the application", now]);
        settingsSheet.appendRow(["owner_email", ownerEmail, "Primary Owner Email", now]);
      }
    }
    
    // Create default Owner account ADM001 in Users tab if it doesn't exist
    var usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
    var users = getSheetData(ss, SHEET_NAMES.USERS);
    var foundOwner = false;
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var uId = u.loginId || u["Login ID"] || "";
      var uEmail = u.email || u["Email"] || "";
      if (uId.toString().toUpperCase() === "ADM001" || uEmail.toString().toLowerCase() === ownerEmail) {
        foundOwner = true;
        break;
      }
    }
    
    if (!foundOwner) {
      var row = [
        ownerEmail,
        ownerName,
        "", // Photo URL
        "Owner",
        "Active",
        now, // Last Login
        now, // Last Activity
        "System", // Created By
        now, // Created Date
        now, // Updated Date
        "FORCE_CHANGE", // Notes
        "CRM-2026-0001", // Employee Code
        "ADM001", // Login ID
        "e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7", // Default Password Hash (Admin@123)
        "" // Phone
      ];
      usersSheet.appendRow(row);
    }
    
    return {
      success: true,
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      message: "Database initialized successfully with 10 tables and ADM001 owner account."
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getSystemInfo(sheet) {
  return {
    status: "Healthy",
    spreadsheetName: sheet ? sheet.getName() : "N/A",
    spreadsheetId: sheet ? sheet.getId() : "N/A",
    totalSheets: sheet ? sheet.getSheets().length : 0,
    lastSync: getBangladeshDateTimeString(new Date()),
    deploymentVersion: "v3.5.0-Enterprise",
    lastDeployment: getBangladeshDateTimeString(new Date())
  };
}
