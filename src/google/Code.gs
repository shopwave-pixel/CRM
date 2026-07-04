/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Code.gs - Router and Entry Point
 */

// =========================================================================
// SAFE GLOBAL FALLBACKS & RESILIENCE WRAPPERS
// Prevents fatal ReferenceErrors if API.gs is missing or load order is delayed.
// =========================================================================
var globalRef = this;

if (typeof globalRef.getSpreadsheet !== 'function') {
  globalRef.getSpreadsheet = function(id) {
    if (id) {
      try {
        var ss = SpreadsheetApp.openById(id);
        if (ss) return ss;
      } catch (openIdErr) {}
    }
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
    try {
      var newSS = SpreadsheetApp.create("Enterprise CRM Database");
      PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", newSS.getId());
      return SpreadsheetApp.openById(newSS.getId());
    } catch (createErr) {}
    return null;
  };
}

if (typeof globalRef.jsonResponse !== 'function') {
  globalRef.jsonResponse = function(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  };
}

if (typeof globalRef.initSheets !== 'function') {
  globalRef.initSheets = function(ss) {
    try {
      var sheetNames = typeof SHEET_NAMES !== 'undefined' ? SHEET_NAMES : {
        CLIENTS: "Clients", TICKETS: "Tickets", CONVERSATIONS: "Conversations", USERS: "Users",
        FOLLOWUPS: "FollowUps", CALLLOGS: "CallLogs", ACTIVITY_LOGS: "ActivityLogs",
        ARCHIVED_CLIENTS: "ArchivedClients", SETTINGS: "Settings", DASHBOARD: "Dashboard"
      };
      var headers = typeof HEADERS !== 'undefined' ? HEADERS : {
        CLIENTS: ["Client ID", "Name", "Phone", "Company", "Status", "Total Tickets", "Next Follow Up", "Last Contact", "Created At", "Updated At", "District", "Is Pinned", "Is Archived", "Follow Up History"],
        TICKETS: ["Ticket ID", "Client ID", "Title", "Description", "Priority", "Status", "Created Date", "Last Updated", "Next Follow Up", "Total Conversations"],
        CONVERSATIONS: ["Conversation ID", "Ticket ID", "Date & Time", "Conversation Note", "Next Follow Up", "Created By", "User Email"],
        USERS: ["Email", "Name", "Photo URL", "Role", "Status", "Last Login", "Last Activity", "Created By", "Created Date", "Updated Date", "Notes", "Employee Code", "Login ID", "Password Hash", "Phone"],
        FOLLOWUPS: ["Follow Up ID", "Client ID", "Date", "Status", "Description", "Created By", "Created At"],
        CALLLOGS: ["Call ID", "Client ID", "Date", "Duration (s)", "Summary", "Disposition", "Agent Email", "Created At"],
        ACTIVITY_LOGS: ["Timestamp", "Email", "Action", "Details", "Employee Code"],
        ARCHIVED_CLIENTS: ["Client ID", "Name", "Phone", "Company", "Status", "Total Tickets", "Next Follow Up", "Last Contact", "Created At", "Updated At", "District", "Is Pinned", "Is Archived", "Follow Up History"],
        SETTINGS: ["Key", "Value", "Description", "Updated At"],
        DASHBOARD: ["Key", "Value", "Description"]
      };
      for (var key in sheetNames) {
        if (sheetNames.hasOwnProperty(key)) {
          var name = sheetNames[key];
          var sheet = ss.getSheetByName(name);
          if (!sheet) {
            sheet = ss.insertSheet(name);
            sheet.appendRow(headers[key]);
            var headerRange = sheet.getRange(1, 1, 1, headers[key].length);
            headerRange.setFontWeight("bold");
            headerRange.setBackground("#f1f5f9");
            sheet.setFrozenRows(1);
          }
        }
      }
    } catch (err) {
      Logger.log("Fallback initSheets error: " + err);
    }
  };
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === "ping") {
      return globalRef.jsonResponse({ success: true, message: "pong" });
    }
    var spreadsheetId = e.parameter.spreadsheetId || e.parameter.spreadsheet_id || e.parameter.id;
    var sheet = globalRef.getSpreadsheet(spreadsheetId);
    if (!sheet) {
      return globalRef.jsonResponse({
        error: "Spreadsheet not found. Please ensure the Apps Script SPREADSHEET_ID script property is configured.",
        spreadsheetNotFound: true
      });
    }
    globalRef.initSheets(sheet);
    
    var result;
    
    switch (action) {
      case "getClients":
        result = getClients(sheet);
        break;
      case "getTickets":
        result = getTickets(sheet);
        break;
      case "getConversations":
        result = getConversations(sheet);
        break;
      case "getUsers":
        result = getUsers(sheet);
        break;
      case "getActivityLogs":
        result = getActivityLogs(sheet);
        break;
      case "getStats":
        result = getDashboardStats(sheet);
        break;
      case "checkUser":
        result = checkUser(sheet, e.parameter.email, e.parameter.name);
        break;
      case "search":
        result = searchCRM(sheet, e.parameter.query);
        break;
      case "getSystemInfo":
        result = getSystemInfo(sheet);
        break;
      case "ping":
        result = { success: true, message: "pong" };
        break;
      default:
        result = { error: "Action '" + action + "' not found on Server." };
    }
    
    return globalRef.jsonResponse(result);
  } catch (err) {
    return globalRef.jsonResponse({ error: err.toString(), stack: err.stack });
  }
}

function doPost(e) {
  try {
    var postData;
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter;
    }
    
    var action = postData ? postData.action : "";
    if (action === "ping") {
      return globalRef.jsonResponse({ success: true, message: "pong" });
    }
    
    var spreadsheetId = (postData && (postData.spreadsheetId || postData.spreadsheet_id || postData.id)) || e.parameter.spreadsheetId;
    var sheet = globalRef.getSpreadsheet(spreadsheetId);
    if (!sheet && action !== "initializeDatabase") {
      return globalRef.jsonResponse({
        error: "Spreadsheet not found. Please ensure the Apps Script SPREADSHEET_ID script property is configured.",
        spreadsheetNotFound: true
      });
    }
    
    if (sheet) {
      globalRef.initSheets(sheet);
    }
    
    var result;
    
    switch (action) {
      case "initializeDatabase":
        result = initializeDatabase(sheet, postData);
        break;
      case "login":
        result = verifyLogin(sheet, postData.loginId, postData.passwordHash);
        break;
      case "addClient":
        result = addClient(sheet, postData);
        break;
      case "updateClient":
        result = updateClient(sheet, postData);
        break;
      case "deleteClient":
        result = deleteClient(sheet, postData.id);
        break;
      case "addTicket":
        result = addTicket(sheet, postData);
        break;
      case "updateTicket":
        result = updateTicket(sheet, postData);
        break;
      case "addConversation":
        result = addConversation(sheet, postData);
        break;
      case "addUser":
        result = addUser(sheet, postData);
        break;
      case "deleteUser":
        result = deleteUser(sheet, postData.email);
        break;
      case "logActivity":
        result = logActivity(sheet, postData.email, postData.activityAction, postData.details);
        break;
      case "backupDatabase":
        result = backupDatabase(sheet);
        break;
      case "restoreDatabase":
        result = restoreDatabase(sheet, postData.data);
        break;
      case "ping":
        result = { success: true, message: "pong" };
        break;
      default:
        result = { error: "POST action '" + action + "' not recognized." };
    }
    
    return globalRef.jsonResponse(result);
  } catch (err) {
    return globalRef.jsonResponse({ error: err.toString(), stack: err.stack });
  }
}
