/**
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
    var camelKey = h.replace(/\s+/g, "").charAt(0).toLowerCase() + h.replace(/\s+/g, "").slice(1);
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
}
