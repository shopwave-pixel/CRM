/**
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
}
