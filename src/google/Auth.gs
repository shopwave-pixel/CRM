/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Auth.gs - Verification and Login Services
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
    userId: foundUser.userId || foundUser["User ID"] || "",
    loginId: foundUser.loginId || foundUser["Login ID"] || "",
    fullName: foundUser.fullName || foundUser["Full Name"] || "",
    role: foundUser.role || foundUser["Role"] || "",
    status: foundUser.status || foundUser["Status"] || "",
    phone: foundUser.phone || foundUser["Phone"] || "",
    email: foundUser.email || foundUser["Email"] || "",
    createdDate: foundUser.createdDate || foundUser["Created Date"] || "",
    updatedDate: foundUser.updatedDate || foundUser["Updated Date"] || "",
    lastLogin: foundUser.lastLogin || foundUser["Last Login"] || "",
    lastActivity: foundUser.lastActivity || foundUser["Last Activity"] || "",
    notes: foundUser.notes || foundUser["Notes"] || ""
  };
  
  var now = getBangladeshDateTimeString();
  updateUserField(sheet, userProfile.loginId, "Last Login", now);
  userProfile.lastLogin = now;
  
  return { success: true, user: userProfile };
}

function checkUser(sheet, email, name) {
  var users = getSheetData(sheet, SHEET_NAMES.USERS);
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uEmail = u.email || u["Email"] || "";
    if (uEmail.toString().trim().toLowerCase() === email.trim().toLowerCase()) {
      return { authorized: true, user: {
        userId: u.userId || u["User ID"] || "",
        loginId: u.loginId || u["Login ID"] || "",
        fullName: u.fullName || u["Full Name"] || "",
        role: u.role || u["Role"] || "",
        status: u.status || u["Status"] || "",
        phone: u.phone || u["Phone"] || "",
        email: uEmail,
        createdDate: u.createdDate || u["Created Date"] || "",
        updatedDate: u.updatedDate || u["Updated Date"] || "",
        lastLogin: u.lastLogin || u["Last Login"] || "",
        lastActivity: u.lastActivity || u["Last Activity"] || "",
        notes: u.notes || u["Notes"] || ""
      }};
    }
  }
  return { authorized: false, error: "Access Denied." };
}
