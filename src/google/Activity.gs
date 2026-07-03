/**
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
}
