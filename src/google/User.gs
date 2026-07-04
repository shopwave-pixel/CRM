/**
 * Google Apps Script Backend for Enterprise CRM
 * File: User.gs - User Database CRUD & Constraints
 */

/**
 * Returns a list of users mapped correctly to CRM user profile fields.
 */
function getUsers(sheet) {
  var users = getSheetData(sheet, SHEET_NAMES.USERS);
  return users.map(function(u) {
    return {
      email: u.email || "",
      fullName: u.name || u.fullName || "",
      photoUrl: u.photoUrl || "",
      role: u.role || "User",
      status: u.status || "Active",
      lastLogin: u.lastLogin || "",
      lastActivity: u.lastActivity || "",
      createdBy: u.createdBy || "",
      createdDate: u.createdDate || "",
      updatedDate: u.updatedDate || "",
      notes: u.notes || "",
      employeeCode: u.employeeCode || "",
      loginId: u.loginId || "",
      passwordHash: u.passwordHash || "",
      phone: u.phone || ""
    };
  });
}

/**
 * Adds or updates a user in the Users sheet based on the exact column headers.
 */
function addUser(sheet, data) {
  if (!sheet) return { success: false, error: "Spreadsheet database is not configured/found." };
  var s = sheet.getSheetByName(SHEET_NAMES.USERS);
  if (!s) return { success: false, error: "Users sheet was not found in the spreadsheet database." };
  
  var values = s.getDataRange().getValues();
  var headers = values[0];
  
  var loginIdCol = headers.indexOf("Login ID");
  var emailCol = headers.indexOf("Email");
  
  if (loginIdCol === -1 || emailCol === -1) {
    return { success: false, error: "Users sheet structure is invalid or missing columns." };
  }
  
  var loginIdUpper = (data.loginId || "").toString().trim().toUpperCase();
  var emailLower = (data.email || "").toString().trim().toLowerCase();
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
  
  var existingRowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    var rowLoginId = (values[i][loginIdCol] || "").toString().trim().toUpperCase();
    var rowEmail = (values[i][emailCol] || "").toString().trim().toLowerCase();
    
    if ((loginIdUpper && rowLoginId === loginIdUpper) || (emailLower && rowEmail === emailLower)) {
      existingRowIndex = i + 1;
      break;
    }
  }
  
  if (existingRowIndex !== -1) {
    // Update existing user with exact column indices to preserve column order
    if (data.email !== undefined) s.getRange(existingRowIndex, headers.indexOf("Email") + 1).setValue(data.email);
    if (data.fullName !== undefined || data.name !== undefined) {
      s.getRange(existingRowIndex, headers.indexOf("Name") + 1).setValue(data.fullName || data.name);
    }
    if (data.photoUrl !== undefined) s.getRange(existingRowIndex, headers.indexOf("Photo URL") + 1).setValue(data.photoUrl);
    if (data.role !== undefined) s.getRange(existingRowIndex, headers.indexOf("Role") + 1).setValue(data.role);
    if (data.status !== undefined) s.getRange(existingRowIndex, headers.indexOf("Status") + 1).setValue(data.status);
    if (data.lastLogin !== undefined) s.getRange(existingRowIndex, headers.indexOf("Last Login") + 1).setValue(data.lastLogin);
    if (data.lastActivity !== undefined) s.getRange(existingRowIndex, headers.indexOf("Last Activity") + 1).setValue(data.lastActivity);
    if (data.createdBy !== undefined) s.getRange(existingRowIndex, headers.indexOf("Created By") + 1).setValue(data.createdBy);
    if (data.createdDate !== undefined) s.getRange(existingRowIndex, headers.indexOf("Created Date") + 1).setValue(data.createdDate);
    if (data.notes !== undefined) s.getRange(existingRowIndex, headers.indexOf("Notes") + 1).setValue(data.notes);
    if (data.employeeCode !== undefined) s.getRange(existingRowIndex, headers.indexOf("Employee Code") + 1).setValue(data.employeeCode);
    if (data.passwordHash !== undefined && data.passwordHash !== "") {
      s.getRange(existingRowIndex, headers.indexOf("Password Hash") + 1).setValue(data.passwordHash);
    }
    if (data.phone !== undefined) s.getRange(existingRowIndex, headers.indexOf("Phone") + 1).setValue(data.phone);
    
    s.getRange(existingRowIndex, headers.indexOf("Updated Date") + 1).setValue(now);
    return { success: true, updated: true };
  } else {
    // Append new user with values in the EXACT header order
    var newRow = new Array(headers.length);
    newRow[headers.indexOf("Email")] = data.email || "";
    newRow[headers.indexOf("Name")] = data.fullName || data.name || "New Staff";
    newRow[headers.indexOf("Photo URL")] = data.photoUrl || "";
    newRow[headers.indexOf("Role")] = data.role || "User";
    newRow[headers.indexOf("Status")] = data.status || "Active";
    newRow[headers.indexOf("Last Login")] = data.lastLogin || "";
    newRow[headers.indexOf("Last Activity")] = data.lastActivity || "";
    newRow[headers.indexOf("Created By")] = data.createdBy || "System";
    newRow[headers.indexOf("Created Date")] = data.createdDate || now;
    newRow[headers.indexOf("Updated Date")] = now;
    newRow[headers.indexOf("Notes")] = data.notes || "";
    newRow[headers.indexOf("Employee Code")] = data.employeeCode || ("CRM-" + Math.floor(1000 + Math.random() * 9000));
    newRow[headers.indexOf("Login ID")] = data.loginId || ("USR" + ("000" + values.length).slice(-3));
    newRow[headers.indexOf("Password Hash")] = data.passwordHash || "";
    newRow[headers.indexOf("Phone")] = data.phone || "";
    
    s.appendRow(newRow);
    return { success: true, added: true };
  }
}

/**
 * Updates an existing user (wrapper for addUser).
 */
function updateUser(sheet, data) {
  return addUser(sheet, data);
}

/**
 * Deletes a user by Login ID or Email.
 */
function deleteUser(sheet, identifier) {
  if (!sheet) return { success: false, error: "Spreadsheet database is not configured/found." };
  var s = sheet.getSheetByName(SHEET_NAMES.USERS);
  if (!s) return { success: false, error: "Users sheet was not found in the spreadsheet database." };
  
  var values = s.getDataRange().getValues();
  var headers = values[0];
  var loginIdCol = headers.indexOf("Login ID");
  var emailCol = headers.indexOf("Email");
  
  if (loginIdCol === -1 || emailCol === -1) {
    return { success: false, error: "Users sheet structure is invalid." };
  }
  
  var target = (identifier || "").toString().trim().toUpperCase();
  if (target === "ADM001") {
    return { success: false, error: "Owner Protection: The system owner account ADM001 cannot be deleted." };
  }
  
  for (var i = 1; i < values.length; i++) {
    var rowLoginId = (values[i][loginIdCol] || "").toString().trim().toUpperCase();
    var rowEmail = (values[i][emailCol] || "").toString().trim().toUpperCase();
    if (rowLoginId === target || rowEmail === target) {
      s.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "User not found." };
}

/**
 * Updates a single field for a user.
 */
function updateUserField(sheet, loginId, fieldName, value) {
  if (!sheet) return;
  var s = sheet.getSheetByName(SHEET_NAMES.USERS);
  if (!s) return;
  
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
