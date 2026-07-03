/**
 * Google Apps Script Backend for Enterprise CRM
 * File: Search.gs - Database Crawlers
 */

function searchCRM(sheet, query) {
  if (!query) return { clients: [], tickets: [] };
  
  var q = query.trim().toLowerCase();
  
  var clients = getClients(sheet);
  var tickets = getTickets(sheet);
  
  var filteredClients = clients.filter(function(c) {
    return (c.name && c.name.toLowerCase().indexOf(q) !== -1) ||
           (c.phone && c.phone.toLowerCase().indexOf(q) !== -1) ||
           (c.company && c.company.toLowerCase().indexOf(q) !== -1) ||
           (c.district && c.district.toLowerCase().indexOf(q) !== -1);
  });
  
  var filteredTickets = tickets.filter(function(t) {
    return (t.title && t.title.toLowerCase().indexOf(q) !== -1) ||
           (t.description && t.description.toLowerCase().indexOf(q) !== -1) ||
           (t.ticketId && t.ticketId.toLowerCase().indexOf(q) !== -1);
  });
  
  return {
    clients: filteredClients,
    tickets: filteredTickets
  };
}
