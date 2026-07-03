/**
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
}
