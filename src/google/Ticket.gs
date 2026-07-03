/**
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
    var camelKey = h.replace(/\s+/g, "").charAt(0).toLowerCase() + h.replace(/\s+/g, "").slice(1);
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
}
