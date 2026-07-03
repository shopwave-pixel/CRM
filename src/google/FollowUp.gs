/**
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
        var newHistory = currentHistory ? currentHistory + "\n" + appendStr : appendStr;
        clientSheet.getRange(j + 1, clientHeaders.indexOf("Follow Up History") + 1).setValue(newHistory);
        
        // Update contact timestamp
        clientSheet.getRange(j + 1, clientHeaders.indexOf("Last Contact") + 1).setValue(getBangladeshDateTimeString());
        break;
      }
    }
  }
}
