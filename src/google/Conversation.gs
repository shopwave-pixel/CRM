/**
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
    var key = h.replace(/\s+/g, "").replace("&", "And");
    var camelKey = key.charAt(0).toLowerCase() + key.slice(1);
    convObj[camelKey] = newRow[idx];
  });
  
  return { success: true, conversation: convObj };
}
