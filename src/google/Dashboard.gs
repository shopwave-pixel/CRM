/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Dashboard.gs - Analytics Engine
 */

function getDashboardStats(sheet) {
  var clients = getClients(sheet);
  var tickets = getTickets(sheet);
  
  var totalClients = clients.length;
  var activeClients = clients.filter(function(c) { return c.isArchived !== true && c.isArchived !== "TRUE"; }).length;
  
  var totalTickets = tickets.length;
  var openTickets = tickets.filter(function(t) { return t.status === "Open" || t.status === "In-Progress"; }).length;
  var resolvedTickets = tickets.filter(function(t) { return t.status === "Closed" || t.status === "Resolved"; }).length;
  
  // Compute conversion rate or follow ups pending
  var now = new Date();
  var pendingFollowUps = clients.filter(function(c) {
    if (!c.nextFollowUp) return false;
    var followDate = parseBDDate(c.nextFollowUp);
    return followDate && followDate >= now;
  }).length;
  
  return {
    totalClients: totalClients,
    activeClients: activeClients,
    totalTickets: totalTickets,
    openTickets: openTickets,
    resolvedTickets: resolvedTickets,
    pendingFollowUps: pendingFollowUps,
    generatedAt: getBangladeshDateTimeString()
  };
}
