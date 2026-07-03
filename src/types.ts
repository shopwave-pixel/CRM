/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClientStatus = 'New' | 'Interested' | 'Customer' | 'Lost';
export type TicketStatus = 'Open' | 'Pending' | 'Follow Up' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High';
export type UserRole = 'Owner' | 'User';
export type UserStatus = 'Active' | 'Disabled';

export interface Client {
  id: string; // e.g. CLI-1001
  name: string;
  phone: string;
  company: string;
  status: ClientStatus;
  totalTickets: number;
  nextFollowUp: string; // YYYY-MM-DD
  lastContact: string; // ISO date or empty
  createdAt: string;
  updatedAt: string;
  district?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  followUpHistory?: string;
}

export interface Ticket {
  id: string; // e.g. TKT-1001
  clientId: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdDate: string; // ISO date
  lastUpdated: string; // ISO date
  nextFollowUp: string; // YYYY-MM-DD
  totalConversations: number;
}

export interface Conversation {
  id: string; // e.g. CONV-1001
  ticketId: string;
  dateTime: string; // ISO date
  conversationNote: string;
  nextFollowUp: string; // YYYY-MM-DD
  createdBy: string; // User's Name
  userEmail: string; // User's Email
}

export interface UserProfile {
  userId: string;
  loginId: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  email?: string;
  employeeCode?: string;
  createdDate?: string;
  updatedDate?: string;
  lastLogin?: string;
  lastActivity?: string;
  notes?: string;
  passwordHash?: string;
}

export interface CRMStats {
  totalClients: number;
  openTickets: number;
  todayFollowUps: number;
  overdueTickets: number;
  closedTickets: number;
}
