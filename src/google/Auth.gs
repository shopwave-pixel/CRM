/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Auth.gs - Verification and Login Services
 */

/**
 * Verifies a user login against stored Login ID and Password Hash.
 * Returns a complete user profile upon successful validation.
 */
function verifyLogin(sheet, loginId, passwordHash) {
  var users = getSheetData(sheet, SHEET_NAMES.USERS);
  var foundUser = null;
  
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var lId = u.loginId || u["Login ID"] || "";
    if (lId.toString().trim().toUpperCase() === loginId.toString().trim().toUpperCase()) {
      foundUser = u;
      break;
    }
  }
  
  if (!foundUser) {
    return { success: false, error: "Invalid Login ID or Password." };
  }
  
  var uPass = foundUser.passwordHash || foundUser["Password Hash"] || "";
  if (uPass !== passwordHash) {
    return { success: false, error: "Invalid Login ID or Password." };
  }
  
  var uStatus = foundUser.status || foundUser["Status"] || "";
  if (uStatus !== "Active") {
    return { success: false, error: "Access Suspended. Your account is currently inactive." };
  }
  
  var userProfile = {
    email: foundUser.email || foundUser["Email"] || "",
    fullName: foundUser.name || foundUser.fullName || foundUser["Name"] || "",
    photoUrl: foundUser.photoUrl || foundUser["Photo URL"] || "",
    role: foundUser.role || foundUser["Role"] || "",
    status: foundUser.status || foundUser["Status"] || "",
    phone: foundUser.phone || foundUser["Phone"] || "",
    createdDate: foundUser.createdDate || foundUser["Created Date"] || "",
    updatedDate: foundUser.updatedDate || foundUser["Updated Date"] || "",
    lastLogin: foundUser.lastLogin || foundUser["Last Login"] || "",
    lastActivity: foundUser.lastActivity || foundUser["Last Activity"] || "",
    notes: foundUser.notes || foundUser["Notes"] || "",
    employeeCode: foundUser.employeeCode || foundUser["Employee Code"] || "",
    loginId: foundUser.loginId || foundUser["Login ID"] || "",
    passwordHash: foundUser.passwordHash || foundUser["Password Hash"] || ""
  };
  
  var now = getBangladeshDateTimeString();
  updateUserField(sheet, userProfile.loginId, "Last Login", now);
  userProfile.lastLogin = now;
  
  return { success: true, user: userProfile };
}

/**
 * Checks if a user email exists and returns the authorized user's details.
 */
function checkUser(sheet, email, name) {
  var users = getSheetData(sheet, SHEET_NAMES.USERS);
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uEmail = u.email || u["Email"] || "";
    if (uEmail.toString().trim().toLowerCase() === email.trim().toLowerCase()) {
      return { authorized: true, user: {
        email: uEmail,
        fullName: u.name || u.fullName || u["Name"] || "",
        photoUrl: u.photoUrl || u["Photo URL"] || "",
        role: u.role || u["Role"] || "",
        status: u.status || u["Status"] || "",
        phone: u.phone || u["Phone"] || "",
        createdDate: u.createdDate || u["Created Date"] || "",
        updatedDate: u.updatedDate || u["Updated Date"] || "",
        lastLogin: u.lastLogin || u["Last Login"] || "",
        lastActivity: u.lastActivity || u["Last Activity"] || "",
        notes: u.notes || u["Notes"] || "",
        employeeCode: u.employeeCode || u["Employee Code"] || "",
        loginId: u.loginId || u["Login ID"] || "",
        passwordHash: u.passwordHash || u["Password Hash"] || ""
      }};
    }
  }
  return { authorized: false, error: "Access Denied." };
}
