/**
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
}
