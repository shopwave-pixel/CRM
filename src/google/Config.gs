/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Config.gs - Configuration and constants
 */

var SHEET_NAMES = {
  CLIENTS: "Clients",
  TICKETS: "Tickets",
  CONVERSATIONS: "Conversations",
  USERS: "Users",
  FOLLOWUPS: "FollowUps",
  CALLLOGS: "CallLogs",
  ACTIVITY_LOGS: "ActivityLogs",
  ARCHIVED_CLIENTS: "ArchivedClients",
  SETTINGS: "Settings",
  DASHBOARD: "Dashboard"
};

var HEADERS = {
  CLIENTS: ["Client ID", "Name", "Phone", "Company", "Status", "Total Tickets", "Next Follow Up", "Last Contact", "Created At", "Updated At", "District", "Is Pinned", "Is Archived", "Follow Up History"],
  TICKETS: ["Ticket ID", "Client ID", "Title", "Description", "Priority", "Status", "Created Date", "Last Updated", "Next Follow Up", "Total Conversations"],
  CONVERSATIONS: ["Conversation ID", "Ticket ID", "Date & Time", "Conversation Note", "Next Follow Up", "Created By", "User Email"],
  USERS: ["Email", "Name", "Photo URL", "Role", "Status", "Last Login", "Last Activity", "Created By", "Created Date", "Updated Date", "Notes", "Employee Code", "Login ID", "Password Hash", "Phone"],
  FOLLOWUPS: ["Follow Up ID", "Client ID", "Date", "Status", "Description", "Created By", "Created At"],
  CALLLOGS: ["Call ID", "Client ID", "Date", "Duration (s)", "Summary", "Disposition", "Agent Email", "Created At"],
  ACTIVITY_LOGS: ["Timestamp", "Email", "Action", "Details", "Employee Code"],
  ARCHIVED_CLIENTS: ["Client ID", "Name", "Phone", "Company", "Status", "Total Tickets", "Next Follow Up", "Last Contact", "Created At", "Updated At", "District", "Is Pinned", "Is Archived", "Follow Up History"],
  SETTINGS: ["Key", "Value", "Description", "Updated At"],
  DASHBOARD: ["Key", "Value", "Description"]
};
