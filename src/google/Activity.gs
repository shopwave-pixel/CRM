/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Activity.gs - Audit logs
 */

function getActivityLogs(sheet) {
  return getSheetData(sheet, SHEET_NAMES.ACTIVITY_LOGS);
}

function logActivity(sheet, email, action, details, employeeCode) {
  try {
    if (!sheet) return { success: false, error: "Spreadsheet database is not configured/found." };
    var logsSheet = sheet.getSheetByName(SHEET_NAMES.ACTIVITY_LOGS);
    var now = getBangladeshDateTimeString();
    var empCode = employeeCode || "";
    
    // Attempt to lookup employee code if missing
    if (!empCode && email && email !== "System" && email !== "Anonymous") {
      try {
        var users = getSheetData(sheet, SHEET_NAMES.USERS);
        var found = null;
        for (var k = 0; k < users.length; k++) {
          var u = users[k];
          var uEmail = u.email || u.Email || "";
          var uLogin = u.loginId || u.LoginId || "";
          if (uEmail.trim().toLowerCase() === email.trim().toLowerCase() ||
              uLogin.trim().toLowerCase() === email.trim().toLowerCase()) {
            found = u;
            break;
          }
        }
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
