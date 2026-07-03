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
      try {
        var ss = SpreadsheetApp.openById(prop);
        if (ss) return ss;
      } catch (openErr) {}
    }
  } catch (e) {}
  
  // Self Healing: Automatically create a new spreadsheet if we cannot find one
  try {
    var newSS = SpreadsheetApp.create("Enterprise CRM Database");
    PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", newSS.getId());
    return SpreadsheetApp.openById(newSS.getId());
  } catch (createErr) {}
  
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
        var values = sheet.getDataRange().getValues();
        var currentHeaders = values[0] || [];
        var expectedHeaders = HEADERS[key];
        
        // Find missing headers
        var missingHeaders = [];
        for (var h = 0; h < expectedHeaders.length; h++) {
          var expected = expectedHeaders[h];
          if (currentHeaders.indexOf(expected) === -1) {
            missingHeaders.push(expected);
          }
        }
        
        if (missingHeaders.length > 0) {
          var lastColumn = sheet.getLastColumn();
          if (lastColumn === 0) {
            sheet.appendRow(expectedHeaders);
          } else {
            sheet.getRange(1, lastColumn + 1, 1, missingHeaders.length).setValues([missingHeaders]);
          }
        }
      }
    }
  }
}

// Initialize CRM Database (Stand-alone or Bound)
function initializeDatabase(ss, postData) {
  try {
    var now = getBangladeshDateTimeString();
    var ownerEmail = (postData && postData.ownerEmail || "mrinal2192@gmail.com").toString().trim().toLowerCase();
    var ownerName = (postData && postData.ownerName) || "System Owner";
    
    // Save Spreadsheet ID into Script Properties as SPREADSHEET_ID.
    // If spreadsheet does not exist or cannot be opened, automatically create one.
    if (!ss) {
      var prop = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
      if (prop) {
        try {
          ss = SpreadsheetApp.openById(prop);
        } catch (openErr) {
          ss = null;
        }
      }
    }
    
    if (!ss) {
      try {
        ss = SpreadsheetApp.create("Enterprise CRM Database");
        PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
        ss = SpreadsheetApp.openById(ss.getId());
      } catch (e) {
        return { success: false, error: "Failed to automatically create spreadsheet. Please check your Apps Script execution permissions: " + e.toString() };
      }
    }
    
    // Re-verify spreadsheet exists and is open
    if (!ss) {
      return { success: false, error: "Spreadsheet creation failed or is unavailable." };
    }
    
    // Ensure all 10 sheets and headers are created and verified
    initSheets(ss);
    
    // Create default settings in Settings sheet if it is empty
    var settingsSheet = ss.getSheetByName("Settings");
    if (settingsSheet) {
      var values = settingsSheet.getDataRange().getValues();
      var keys = {};
      for (var r = 1; r < values.length; r++) {
        var k = values[r][0];
        if (k) keys[k] = true;
      }
      if (!keys["timezone"]) {
        settingsSheet.appendRow(["timezone", "Asia/Dhaka", "System Timezone", now]);
      }
      if (!keys["system_name"]) {
        settingsSheet.appendRow(["system_name", "Enterprise CRM", "Name of the application", now]);
      }
      if (!keys["owner_email"]) {
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
  var diag = {
    appsScript: "Healthy",
    spreadsheet: "Disconnected",
    scriptProperties: "Missing",
    usersSheet: "Missing",
    clientsSheet: "Missing",
    ticketsSheet: "Missing",
    conversationsSheet: "Missing",
    followUpsSheet: "Missing",
    callLogsSheet: "Missing",
    dashboardSheet: "Missing",
    settingsSheet: "Missing",
    archivedClientsSheet: "Missing",
    ownerAccount: "Missing"
  };
  
  try {
    var prop = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (prop) {
      diag.scriptProperties = "Configured";
    }
  } catch (e) {}
  
  if (sheet) {
    diag.spreadsheet = "Connected";
    
    // Map of sheet names configuration keys to diagnostics response keys
    var sheetsList = {
      USERS: "usersSheet",
      CLIENTS: "clientsSheet",
      TICKETS: "ticketsSheet",
      CONVERSATIONS: "conversationsSheet",
      FOLLOWUPS: "followUpsSheet",
      CALLLOGS: "callLogsSheet",
      DASHBOARD: "dashboardSheet",
      SETTINGS: "settingsSheet",
      ARCHIVED_CLIENTS: "archivedClientsSheet"
    };
    
    for (var key in SHEET_NAMES) {
      if (SHEET_NAMES.hasOwnProperty(key)) {
        var name = SHEET_NAMES[key];
        var s = sheet.getSheetByName(name);
        var diagKey = sheetsList[key];
        if (s && diagKey) {
          diag[diagKey] = "Active";
        }
      }
    }
    
    // Check Owner Account ADM001
    try {
      var users = getSheetData(sheet, SHEET_NAMES.USERS);
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        var uId = u.loginId || u["Login ID"] || "";
        if (uId.toString().toUpperCase() === "ADM001") {
          diag.ownerAccount = "Created";
          break;
        }
      }
    } catch (e) {}
  }
  
  return {
    status: "Healthy",
    spreadsheetName: sheet ? sheet.getName() : "N/A",
    spreadsheetId: sheet ? sheet.getId() : "N/A",
    totalSheets: sheet ? sheet.getSheets().length : 0,
    lastSync: getBangladeshDateTimeString(new Date()),
    deploymentVersion: "v3.5.0-Enterprise",
    lastDeployment: getBangladeshDateTimeString(new Date()),
    diagnostics: diag
  };
}
