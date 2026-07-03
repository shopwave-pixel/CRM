export interface AppsScriptFile {
  name: string;
  language: 'javascript' | 'typescript';
  description: string;
  code: string;
  version: string;
  lastUpdated: string;
}

export const appsScriptFiles: AppsScriptFile[] = [
  {
    name: "Code.gs",
    language: "javascript",
    description: "Main routing logic and entry point for doGet/doPost REST API requests.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Code.gs - Router and Entry Point
 */

// =========================================================================
// SAFE GLOBAL FALLBACKS & RESILIENCE WRAPPERS
// Prevents fatal ReferenceErrors if API.gs is missing or load order is delayed.
// =========================================================================
var globalRef = this;

if (typeof globalRef.getSpreadsheet !== 'function') {
  globalRef.getSpreadsheet = function() {
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
    const action = e.parameter.action;
    if (action === "ping") {
      return globalRef.jsonResponse({ success: true, message: "pong" });
    }
    const sheet = globalRef.getSpreadsheet();
    if (!sheet) {
      return globalRef.jsonResponse({
        error: "Spreadsheet not found. Please ensure the Apps Script SPREADSHEET_ID script property is configured.",
        spreadsheetNotFound: true
      });
    }
    globalRef.initSheets(sheet);
    
    let result;
    
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
    let postData;
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter;
    }
    
    const action = postData ? postData.action : "";
    if (action === "ping") {
      return globalRef.jsonResponse({ success: true, message: "pong" });
    }
    
    const sheet = globalRef.getSpreadsheet();
    if (!sheet && action !== "initializeDatabase") {
      return globalRef.jsonResponse({
        error: "Spreadsheet not found. Please ensure the Apps Script SPREADSHEET_ID script property is configured.",
        spreadsheetNotFound: true
      });
    }
    
    if (sheet) {
      globalRef.initSheets(sheet);
    }
    
    let result;
    
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
}`
  },
  {
    name: "Config.gs",
    language: "javascript",
    description: "Defines constant parameters, sheet names, layout headers and static models.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Config.gs - Configuration and constants
 */

const SHEET_NAMES = {
  CLIENTS: "Clients",
  TICKETS: "Tickets",
  CONVERSATIONS: "Conversations",
  USERS: "Users",
  FOLLOWUPS: "FollowUps",
  CALLLOGS: "CallLogs",
  ACTIVITY_LOGS: "ActivityLogs",
  ARCHIVED_CLIENTS: "ArchivedClients",
  SETTINGS: "Settings",
  DASHBOARD: "Dashboard"
};

const HEADERS = {
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
};`
  },
  {
    name: "Auth.gs",
    language: "javascript",
    description: "Authenticates users, validates logins, and manages staff session controls.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Auth.gs - Verification and Login Services
 */

function verifyLogin(sheet, loginId, passwordHash) {
  var users = getSheetData(sheet, SHEET_NAMES.USERS);
  var foundUser = null;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var lId = u.loginId || u["Login ID"] || "";
    if (lId.toString().trim().toUpperCase() === loginId.toString().trim().toUpperCase()) {
      foundUser = u;
      break;
    }
  }
  
  if (!foundUser) {
    return { success: false, error: "Invalid Login ID or Password." };
  }
  
  var uPass = foundUser.passwordHash || foundUser["Password Hash"] || "";
  if (uPass !== passwordHash) {
    return { success: false, error: "Invalid Login ID or Password." };
  }
  
  var uStatus = foundUser.status || foundUser["Status"] || "";
  if (uStatus !== "Active") {
    return { success: false, error: "Access Suspended. Your account is currently inactive." };
  }
  
  var userProfile = {
    userId: foundUser.userId || foundUser["User ID"] || "",
    loginId: foundUser.loginId || foundUser["Login ID"] || "",
    fullName: foundUser.fullName || foundUser["Full Name"] || "",
    role: foundUser.role || foundUser["Role"] || "",
    status: foundUser.status || foundUser["Status"] || "",
    phone: foundUser.phone || foundUser["Phone"] || "",
    email: foundUser.email || foundUser["Email"] || "",
    createdDate: foundUser.createdDate || foundUser["Created Date"] || "",
    updatedDate: foundUser.updatedDate || foundUser["Updated Date"] || "",
    lastLogin: foundUser.lastLogin || foundUser["Last Login"] || "",
    lastActivity: foundUser.lastActivity || foundUser["Last Activity"] || "",
    notes: foundUser.notes || foundUser["Notes"] || ""
  };
  
  var now = getBangladeshDateTimeString();
  updateUserField(sheet, userProfile.loginId, "Last Login", now);
  userProfile.lastLogin = now;
  
  return { success: true, user: userProfile };
}

function checkUser(sheet, email, name) {
  var users = getSheetData(sheet, SHEET_NAMES.USERS);
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uEmail = u.email || u["Email"] || "";
    if (uEmail.toString().trim().toLowerCase() === email.trim().toLowerCase()) {
      return { authorized: true, user: {
        userId: u.userId || u["User ID"] || "",
        loginId: u.loginId || u["Login ID"] || "",
        fullName: u.fullName || u["Full Name"] || "",
        role: u.role || u["Role"] || "",
        status: u.status || u["Status"] || "",
        phone: u.phone || u["Phone"] || "",
        email: uEmail,
        createdDate: u.createdDate || u["Created Date"] || "",
        updatedDate: u.updatedDate || u["Updated Date"] || "",
        lastLogin: u.lastLogin || u["Last Login"] || "",
        lastActivity: u.lastActivity || u["Last Activity"] || "",
        notes: u.notes || u["Notes"] || ""
      }};
    }
  }
  return { authorized: false, error: "Access Denied." };
}`
  },
  {
    name: "Client.gs",
    language: "javascript",
    description: "Database queries and CRUD actions for client registries.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Client.gs - Client CRUD & status pipelines
 */

function getClients(sheet) {
  return getSheetData(sheet, SHEET_NAMES.CLIENTS);
}

function addClient(sheet, data) {
  var clientsSheet = sheet.getSheetByName(SHEET_NAMES.CLIENTS);
  var now = getBangladeshDateTimeString();
  var clientId = "CLI-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  
  var phoneVal = validateAndFormatBDPhone(data.phone);
  var formattedPhone = phoneVal.isValid ? phoneVal.formatted : data.phone;
  
  var newRow = [
    clientId,
    data.name || "Unnamed Client",
    formattedPhone,
    data.company || "",
    data.status || "New",
    0, // Total Tickets
    data.nextFollowUp || "",
    now, // Last Contact
    now, // Created At
    now, // Updated At
    data.district || "Dhaka",
    data.isPinned ? "TRUE" : "FALSE",
    data.isArchived ? "TRUE" : "FALSE",
    data.followUpHistory || ""
  ];
  
  clientsSheet.appendRow(newRow);
  
  var clientObj = {};
  HEADERS.CLIENTS.forEach(function(h, idx) {
    var camelKey = h.replace(/\\s+/g, "").charAt(0).toLowerCase() + h.replace(/\\s+/g, "").slice(1);
    clientObj[camelKey] = newRow[idx];
  });
  
  return { success: true, client: clientObj };
}

function updateClient(sheet, data) {
  var s = sheet.getSheetByName(SHEET_NAMES.CLIENTS);
  var values = s.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf("Client ID");
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === data.id) {
      var rowNum = i + 1;
      var now = getBangladeshDateTimeString();
      
      if (data.name !== undefined) s.getRange(rowNum, headers.indexOf("Name") + 1).setValue(data.name);
      if (data.phone !== undefined) {
        var phoneVal = validateAndFormatBDPhone(data.phone);
        s.getRange(rowNum, headers.indexOf("Phone") + 1).setValue(phoneVal.isValid ? phoneVal.formatted : data.phone);
      }
      if (data.company !== undefined) s.getRange(rowNum, headers.indexOf("Company") + 1).setValue(data.company);
      if (data.status !== undefined) s.getRange(rowNum, headers.indexOf("Status") + 1).setValue(data.status);
      if (data.nextFollowUp !== undefined) s.getRange(rowNum, headers.indexOf("Next Follow Up") + 1).setValue(data.nextFollowUp);
      if (data.district !== undefined) s.getRange(rowNum, headers.indexOf("District") + 1).setValue(data.district);
      if (data.isPinned !== undefined) s.getRange(rowNum, headers.indexOf("Is Pinned") + 1).setValue(data.isPinned ? "TRUE" : "FALSE");
      if (data.isArchived !== undefined) s.getRange(rowNum, headers.indexOf("Is Archived") + 1).setValue(data.isArchived ? "TRUE" : "FALSE");
      if (data.followUpHistory !== undefined) s.getRange(rowNum, headers.indexOf("Follow Up History") + 1).setValue(data.followUpHistory);
      if (data.lastContact !== undefined) s.getRange(rowNum, headers.indexOf("Last Contact") + 1).setValue(data.lastContact);
      
      s.getRange(rowNum, headers.indexOf("Updated At") + 1).setValue(now);
      return { success: true };
    }
  }
  return { success: false, error: "Client ID not found." };
}

function deleteClient(sheet, id) {
  var s = sheet.getSheetByName(SHEET_NAMES.CLIENTS);
  var values = s.getDataRange().getValues();
  var idCol = values[0].indexOf("Client ID");
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) {
      s.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Client not found." };
}

function updateClientTicketCount(sheet, clientId) {
  var s = sheet.getSheetByName(SHEET_NAMES.CLIENTS);
  var values = s.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf("Client ID");
  var ticketsCol = headers.indexOf("Total Tickets");
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === clientId) {
      var currentVal = Number(values[i][ticketsCol]) || 0;
      s.getRange(i + 1, ticketsCol + 1).setValue(currentVal + 1);
      break;
    }
  }
}`
  },
  {
    name: "Ticket.gs",
    language: "javascript",
    description: "Database queries and CRUD actions for support ticketing system.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Ticket.gs - Ticketing lifecycle
 */

function getTickets(sheet) {
  return getSheetData(sheet, SHEET_NAMES.TICKETS);
}

function addTicket(sheet, data) {
  var ticketsSheet = sheet.getSheetByName(SHEET_NAMES.TICKETS);
  var now = getBangladeshDateTimeString();
  var ticketId = "TCK-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  
  var newRow = [
    ticketId,
    data.clientId,
    data.title || "Untitled Support Request",
    data.description || "",
    data.priority || "Medium",
    data.status || "Open",
    now, // Created Date
    now, // Last Updated
    data.nextFollowUp || "",
    0  // Total Conversations
  ];
  
  ticketsSheet.appendRow(newRow);
  
  // Automatically increment total tickets for client
  updateClientTicketCount(sheet, data.clientId);
  
  var ticketObj = {};
  HEADERS.TICKETS.forEach(function(h, idx) {
    var camelKey = h.replace(/\\s+/g, "").charAt(0).toLowerCase() + h.replace(/\\s+/g, "").slice(1);
    ticketObj[camelKey] = newRow[idx];
  });
  
  return { success: true, ticket: ticketObj };
}

function updateTicket(sheet, data) {
  var s = sheet.getSheetByName(SHEET_NAMES.TICKETS);
  var values = s.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf("Ticket ID");
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === data.id) {
      var rowNum = i + 1;
      var now = getBangladeshDateTimeString();
      
      if (data.title !== undefined) s.getRange(rowNum, headers.indexOf("Title") + 1).setValue(data.title);
      if (data.description !== undefined) s.getRange(rowNum, headers.indexOf("Description") + 1).setValue(data.description);
      if (data.priority !== undefined) s.getRange(rowNum, headers.indexOf("Priority") + 1).setValue(data.priority);
      if (data.status !== undefined) s.getRange(rowNum, headers.indexOf("Status") + 1).setValue(data.status);
      if (data.nextFollowUp !== undefined) s.getRange(rowNum, headers.indexOf("Next Follow Up") + 1).setValue(data.nextFollowUp);
      
      s.getRange(rowNum, headers.indexOf("Last Updated") + 1).setValue(now);
      return { success: true };
    }
  }
  return { success: false, error: "Ticket ID not found." };
}

function updateTicketFromConversation(sheet, ticketId, nextFollowUp) {
  var s = sheet.getSheetByName(SHEET_NAMES.TICKETS);
  var values = s.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf("Ticket ID");
  var convCol = headers.indexOf("Total Conversations");
  var followCol = headers.indexOf("Next Follow Up");
  var lastUpdatedCol = headers.indexOf("Last Updated");
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === ticketId) {
      var rowNum = i + 1;
      var currentVal = Number(values[i][convCol]) || 0;
      s.getRange(rowNum, convCol + 1).setValue(currentVal + 1);
      s.getRange(rowNum, lastUpdatedCol + 1).setValue(getBangladeshDateTimeString());
      if (nextFollowUp) {
        s.getRange(rowNum, followCol + 1).setValue(nextFollowUp);
      }
      break;
    }
  }
}`
  },
  {
    name: "Conversation.gs",
    language: "javascript",
    description: "Database queries and CRUD actions for logging user interactions and timeline notes.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Conversation.gs - Timeline notes & communications
 */

function getConversations(sheet) {
  return getSheetData(sheet, SHEET_NAMES.CONVERSATIONS);
}

function addConversation(sheet, data) {
  var conversationsSheet = sheet.getSheetByName(SHEET_NAMES.CONVERSATIONS);
  var now = getBangladeshDateTimeString();
  var convId = "CONV-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  
  var newRow = [
    convId,
    data.ticketId,
    now,
    data.conversationNote || "",
    data.nextFollowUp || "",
    data.createdBy || "Agent",
    data.userEmail || ""
  ];
  
  conversationsSheet.appendRow(newRow);
  
  // Increment conversation counter on Ticket
  updateTicketFromConversation(sheet, data.ticketId, data.nextFollowUp);
  
  // Propagate next follow up directly to associated Client/Ticket
  propagateFollowUp(sheet, data.ticketId, data.nextFollowUp);
  
  var convObj = {};
  HEADERS.CONVERSATIONS.forEach(function(h, idx) {
    var key = h.replace(/\\s+/g, "").replace("&", "And");
    var camelKey = key.charAt(0).toLowerCase() + key.slice(1);
    convObj[camelKey] = newRow[idx];
  });
  
  return { success: true, conversation: convObj };
}`
  },
  {
    name: "FollowUp.gs",
    language: "javascript",
    description: "Orchestrates follow-up propagations across Clients and Tickets.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: FollowUp.gs - Follow up coordination
 */

function propagateFollowUp(sheet, ticketId, nextFollowUpDate) {
  if (!nextFollowUpDate) return;
  
  // Step 1: Update Ticket's Next Follow Up
  var ticketSheet = sheet.getSheetByName(SHEET_NAMES.TICKETS);
  var ticketValues = ticketSheet.getDataRange().getValues();
  var ticketHeaders = ticketValues[0];
  var ticketIdCol = ticketHeaders.indexOf("Ticket ID");
  var clientIdCol = ticketHeaders.indexOf("Client ID");
  
  var clientId = "";
  for (var i = 1; i < ticketValues.length; i++) {
    if (ticketValues[i][ticketIdCol] === ticketId) {
      ticketSheet.getRange(i + 1, ticketHeaders.indexOf("Next Follow Up") + 1).setValue(nextFollowUpDate);
      clientId = ticketValues[i][clientIdCol];
      break;
    }
  }
  
  // Step 2: Update Client's Next Follow Up and Follow Up History
  if (clientId) {
    var clientSheet = sheet.getSheetByName(SHEET_NAMES.CLIENTS);
    var clientValues = clientSheet.getDataRange().getValues();
    var clientHeaders = clientValues[0];
    var clientIdColInClients = clientHeaders.indexOf("Client ID");
    
    for (var j = 1; j < clientValues.length; j++) {
      if (clientValues[j][clientIdColInClients] === clientId) {
        // Set new direct follow up date
        clientSheet.getRange(j + 1, clientHeaders.indexOf("Next Follow Up") + 1).setValue(nextFollowUpDate);
        
        // Append date to historical list
        var currentHistory = clientValues[j][clientHeaders.indexOf("Follow Up History")] || "";
        var appendStr = "[" + getBangladeshDateString(new Date()) + " Schedule]: " + nextFollowUpDate;
        var newHistory = currentHistory ? currentHistory + "\\n" + appendStr : appendStr;
        clientSheet.getRange(j + 1, clientHeaders.indexOf("Follow Up History") + 1).setValue(newHistory);
        
        // Update contact timestamp
        clientSheet.getRange(j + 1, clientHeaders.indexOf("Last Contact") + 1).setValue(getBangladeshDateTimeString());
        break;
      }
    }
  }
}`
  },
  {
    name: "CallLog.gs",
    language: "javascript",
    description: "Database queries and CRUD actions for call logs and summaries.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: CallLog.gs - Call Logs Management
 */

function getCallLogs(sheet) {
  return getSheetData(sheet, "CallLogs");
}

function addCallLog(sheet, data) {
  var s = sheet.getSheetByName("CallLogs");
  var now = getBangladeshDateTimeString();
  var newRow = [
    data.callId || "CALL_" + new Date().getTime(),
    data.clientId || "",
    data.date || now,
    data.duration || 0,
    data.summary || "",
    data.disposition || "",
    data.agentEmail || "",
    now
  ];
  s.appendRow(newRow);
  return { success: true };
}`
  },
  {
    name: "Dashboard.gs",
    language: "javascript",
    description: "Computes system performance metrics and aggregates database statuses.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Dashboard.gs - Analytics Engine
 */

function getDashboardStats(sheet) {
  var clients = getClients(sheet);
  var tickets = getTickets(sheet);
  
  var totalClients = clients.length;
  var activeClients = clients.filter(function(c) { return c.isArchived !== true && c.isArchived !== "TRUE"; }).length;
  
  var totalTickets = tickets.length;
  var openTickets = tickets.filter(function(t) { return t.status === "Open" || t.status === "In-Progress"; }).length;
  var resolvedTickets = tickets.filter(function(t) { return t.status === "Closed" || t.status === "Resolved"; }).length;
  
  // Compute conversion rate or follow ups pending
  var now = new Date();
  var pendingFollowUps = clients.filter(function(c) {
    if (!c.nextFollowUp) return false;
    var followDate = parseBDDate(c.nextFollowUp);
    return followDate && followDate >= now;
  }).length;
  
  return {
    totalClients: totalClients,
    activeClients: activeClients,
    totalTickets: totalTickets,
    openTickets: openTickets,
    resolvedTickets: resolvedTickets,
    pendingFollowUps: pendingFollowUps,
    generatedAt: getBangladeshDateTimeString()
  };
}`
  },
  {
    name: "Search.gs",
    language: "javascript",
    description: "Global CRM database crawler supporting multi-column queries.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Search.gs - Database Crawlers
 */

function searchCRM(sheet, query) {
  if (!query) return { clients: [], tickets: [] };
  
  var q = query.trim().toLowerCase();
  
  var clients = getClients(sheet);
  var tickets = getTickets(sheet);
  
  var filteredClients = clients.filter(function(c) {
    return (c.name && c.name.toLowerCase().indexOf(q) !== -1) ||
           (c.phone && c.phone.toLowerCase().indexOf(q) !== -1) ||
           (c.company && c.company.toLowerCase().indexOf(q) !== -1) ||
           (c.district && c.district.toLowerCase().indexOf(q) !== -1);
  });
  
  var filteredTickets = tickets.filter(function(t) {
    return (t.title && t.title.toLowerCase().indexOf(q) !== -1) ||
           (t.description && t.description.toLowerCase().indexOf(q) !== -1) ||
           (t.ticketId && t.ticketId.toLowerCase().indexOf(q) !== -1);
  });
  
  return {
    clients: filteredClients,
    tickets: filteredTickets
  };
}`
  },
  {
    name: "User.gs",
    language: "javascript",
    description: "User profile queries, staff directory CRUD, and Owner account security rules.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: User.gs - User Database CRUD & Constraints
 */

function getUsers(sheet) {
  var users = getSheetData(sheet, SHEET_NAMES.USERS);
  return users.map(function(u) {
    return {
      userId: u.userId || u["User ID"] || "",
      loginId: u.loginId || u["Login ID"] || "",
      fullName: u.fullName || u["Full Name"] || "",
      role: u.role || u["Role"] || "User",
      status: u.status || u["Status"] || "Active",
      phone: u.phone || u["Phone"] || "",
      email: u.email || u["Email"] || "",
      employeeCode: u.employeeCode || u["Employee Code"] || "",
      createdDate: u.createdDate || u["Created Date"] || "",
      updatedDate: u.updatedDate || u["Updated Date"] || "",
      lastLogin: u.lastLogin || u["Last Login"] || "",
      lastActivity: u.lastActivity || u["Last Activity"] || "",
      notes: u.notes || u["Notes"] || ""
    };
  });
}

function addUser(sheet, data) {
  var s = sheet.getSheetByName(SHEET_NAMES.USERS);
  var values = s.getDataRange().getValues();
  var headers = values[0];
  var loginIdCol = headers.indexOf("Login ID");
  
  var loginIdUpper = data.loginId.toString().trim().toUpperCase();
  var now = getBangladeshDateTimeString();

  // Owner protection check if attempting to modify ADM001 status or role
  if (loginIdUpper === "ADM001") {
    if (data.status !== undefined && data.status !== "Active") {
      return { success: false, error: "Owner Protection: The system owner ADM001 cannot be disabled or deactivated." };
    }
    if (data.role !== undefined && data.role !== "Owner") {
      return { success: false, error: "Owner Protection: The system owner ADM001 role cannot be changed." };
    }
  }
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][loginIdCol].toString().trim().toUpperCase() === loginIdUpper) {
      var rowNum = i + 1;
      if (data.fullName !== undefined) s.getRange(rowNum, headers.indexOf("Full Name") + 1).setValue(data.fullName);
      if (data.passwordHash !== undefined && data.passwordHash !== "") s.getRange(rowNum, headers.indexOf("Password Hash") + 1).setValue(data.passwordHash);
      if (data.role !== undefined) s.getRange(rowNum, headers.indexOf("Role") + 1).setValue(data.role);
      if (data.status !== undefined) s.getRange(rowNum, headers.indexOf("Status") + 1).setValue(data.status);
      if (data.phone !== undefined) s.getRange(rowNum, headers.indexOf("Phone") + 1).setValue(data.phone);
      if (data.email !== undefined) s.getRange(rowNum, headers.indexOf("Email") + 1).setValue(data.email);
      if (data.notes !== undefined) s.getRange(rowNum, headers.indexOf("Notes") + 1).setValue(data.notes);
      if (data.lastActivity !== undefined) s.getRange(rowNum, headers.indexOf("Last Activity") + 1).setValue(data.lastActivity);
      if (data.employeeCode !== undefined) s.getRange(rowNum, headers.indexOf("Employee Code") + 1).setValue(data.employeeCode);
      
      s.getRange(rowNum, headers.indexOf("Updated Date") + 1).setValue(now);
      return { success: true, updated: true };
    }
  }
  
  // Add new user row
  var newRow = [
    data.userId || "USR" + (values.length).toString().padStart(3, '0'),
    loginIdUpper,
    data.passwordHash || "",
    data.fullName || "New Staff",
    data.role || "User",
    data.status || "Active",
    data.phone || "",
    data.email || "",
    now,
    now,
    "",
    now,
    data.notes || "",
    data.employeeCode || ""
  ];
  
  s.appendRow(newRow);
  return { success: true, added: true };
}

function deleteUser(sheet, loginId) {
  var s = sheet.getSheetByName(SHEET_NAMES.USERS);
  var values = s.getDataRange().getValues();
  var loginIdCol = values[0].indexOf("Login ID");
  
  var targetLoginId = loginId.toString().trim().toUpperCase();
  
  if (targetLoginId === "ADM001") {
    return { success: false, error: "Owner Protection: The system owner account ADM001 cannot be deleted." };
  }
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][loginIdCol].toString().trim().toUpperCase() === targetLoginId) {
      s.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "User not found." };
}

function updateUserField(sheet, loginId, fieldName, value) {
  var s = sheet.getSheetByName(SHEET_NAMES.USERS);
  var values = s.getDataRange().getValues();
  var headers = values[0];
  var loginIdCol = headers.indexOf("Login ID");
  var fieldCol = headers.indexOf(fieldName);
  
  if (loginIdCol === -1 || fieldCol === -1) return;
  
  var targetLoginId = loginId.toString().trim().toUpperCase();
  for (var i = 1; i < values.length; i++) {
    if (values[i][loginIdCol].toString().trim().toUpperCase() === targetLoginId) {
      s.getRange(i + 1, fieldCol + 1).setValue(value);
      break;
    }
  }
}`
  },
  {
    name: "Activity.gs",
    language: "javascript",
    description: "Database queries and CRUD actions for logging admin audits.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Activity.gs - Audit logs
 */

function getActivityLogs(sheet) {
  return getSheetData(sheet, SHEET_NAMES.ACTIVITY_LOGS);
}

function logActivity(sheet, email, action, details, employeeCode) {
  try {
    var logsSheet = sheet.getSheetByName(SHEET_NAMES.ACTIVITY_LOGS);
    var now = getBangladeshDateTimeString();
    var empCode = employeeCode || "";
    
    // Attempt to lookup employee code if missing
    if (!empCode && email && email !== "System" && email !== "Anonymous") {
      try {
        var users = getSheetData(sheet, SHEET_NAMES.USERS);
        var found = users.find(function(u) {
          var uEmail = u.email || u.Email || "";
          var uLogin = u.loginId || u.LoginId || "";
          return uEmail.trim().toLowerCase() === email.trim().toLowerCase() ||
                 uLogin.trim().toLowerCase() === email.trim().toLowerCase();
        });
        if (found) {
          empCode = found.employeeCode || found.EmployeeCode || found["Employee Code"] || "";
        }
      } catch (e) {}
    }

    logsSheet.appendRow([
      now,
      email || "Anonymous",
      action || "Unknown Action",
      details || "",
      empCode
    ]);
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}`
  },
  {
    name: "Backup.gs",
    language: "javascript",
    description: "Durable database backup export, snapshotting, and restoration mechanism.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Backup.gs - Database Backups and Restores
 */

function backupDatabase(sheet) {
  var dbBackup = {
    backupTimestamp: getBangladeshDateTimeString(),
    clients: getClients(sheet),
    tickets: getTickets(sheet),
    conversations: getConversations(sheet),
    users: getUsers(sheet),
    activityLogs: getActivityLogs(sheet)
  };
  
  return dbBackup;
}

function restoreDatabase(sheet, backupData) {
  if (!backupData) {
    return { success: false, error: "Empty backup data provided." };
  }
  
  // Wipe out existing data first
  Object.keys(SHEET_NAMES).forEach(function(key) {
    var sheetName = SHEET_NAMES[key];
    var s = sheet.getSheetByName(sheetName);
    if (s) {
      var rows = s.getLastRow();
      if (rows > 1) {
        s.deleteRows(2, rows - 1);
      }
    }
  });
  
  // Re-verify layouts
  if (typeof initSheets === 'function') {
    initSheets(sheet);
  }
  
  // 1. Clients Table Restoration
  if (backupData.clients && backupData.clients.length > 0) {
    var clientsSheet = sheet.getSheetByName(SHEET_NAMES.CLIENTS);
    backupData.clients.forEach(function(c) {
      clientsSheet.appendRow([
        c.clientId || c.id,
        c.name || "",
        c.phone || "",
        c.company || "",
        c.status || "New",
        Number(c.totalTickets || 0),
        c.nextFollowUp || "",
        c.lastContact || "",
        c.createdAt || "",
        c.updatedAt || "",
        c.district || "Dhaka",
        c.isPinned ? "TRUE" : "FALSE",
        c.isArchived ? "TRUE" : "FALSE",
        c.followUpHistory || ""
      ]);
    });
  }
  
  // 2. Tickets Table Restoration
  if (backupData.tickets && backupData.tickets.length > 0) {
    var ticketsSheet = sheet.getSheetByName(SHEET_NAMES.TICKETS);
    backupData.tickets.forEach(function(t) {
      ticketsSheet.appendRow([
        t.ticketId || t.id,
        t.clientId || "",
        t.title || "",
        t.description || "",
        t.priority || "Medium",
        t.status || "Open",
        t.createdDate || "",
        t.lastUpdated || "",
        t.nextFollowUp || "",
        Number(t.totalConversations || 0)
      ]);
    });
  }
  
  // 3. Conversations Table Restoration
  if (backupData.conversations && backupData.conversations.length > 0) {
    var convSheet = sheet.getSheetByName(SHEET_NAMES.CONVERSATIONS);
    backupData.conversations.forEach(function(c) {
      convSheet.appendRow([
        c.conversationId || c.id,
        c.ticketId || "",
        c.dateTime || "",
        c.conversationNote || "",
        c.nextFollowUp || "",
        c.createdBy || "",
        c.userEmail || ""
      ]);
    });
  }
  
  // 4. Users Table Restoration
  if (backupData.users && backupData.users.length > 0) {
    var userSheet = sheet.getSheetByName(SHEET_NAMES.USERS);
    backupData.users.forEach(function(u) {
      userSheet.appendRow([
        u.email || "",
        u.name || "",
        u.photoUrl || "",
        u.role || "Agent",
        u.status || "Active",
        u.lastLogin || "",
        u.lastActivity || "",
        u.createdBy || "",
        u.createdDate || "",
        u.updatedDate || "",
        u.notes || "",
        u.employeeCode || "",
        u.loginId || "",
        u.passwordHash || "",
        u.phone || ""
      ]);
    });
  }
  
  // 5. Activity Logs Table Restoration
  if (backupData.activityLogs && backupData.activityLogs.length > 0) {
    var logsSheet = sheet.getSheetByName(SHEET_NAMES.ACTIVITY_LOGS);
    backupData.activityLogs.forEach(function(l) {
      logsSheet.appendRow([
        l.timestamp || "",
        l.email || "",
        l.action || "",
        l.details || "",
        l.employeeCode || ""
      ]);
    });
  }
  
  return { success: true, message: "Database tables completely restored from backup snapshot." };
}`
  },
  {
    name: "Utils.gs",
    language: "javascript",
    description: "Bangladesh phone validations, timezone conversions, string manipulation.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Utils.gs - Localized Converters
 */

function validateAndFormatBDPhone(phoneStr) {
  if (!phoneStr) {
    return { isValid: false, error: "Phone number is required." };
  }
  var cleaned = phoneStr.replace(/[\\s\\-\\(\\)\\+]/g, '');
  if (!/^\\d+$/.test(cleaned)) {
    return { isValid: false, error: "Phone number must contain digits only." };
  }
  if (cleaned.length === 11 && cleaned.indexOf('01') === 0) {
    return { isValid: true, formatted: "+88" + cleaned };
  }
  if (cleaned.length === 13 && cleaned.indexOf('8801') === 0) {
    return { isValid: true, formatted: "+" + cleaned };
  }
  return {
    isValid: false,
    error: "Invalid BD mobile format."
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
}`
  },
  {
    name: "API.gs",
    language: "javascript",
    description: "CORS handlers, response wrappers, structural normalizers.",
    version: "v3.5.0-Enterprise",
    lastUpdated: "02/07/2026",
    code: `/**
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
      var key = headerName.replace(/\\s+/g, "").replace("&", "And");
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
      ss = SpreadsheetApp.create("Enterprise CRM Database");
      try {
        PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
      } catch (e) {}
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
}`
  }
];
