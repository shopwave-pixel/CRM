export const appsScriptDocs = {
  appsScript: `# Enterprise CRM Google Apps Script Documentation
Version: v3.5.0-Enterprise
Author: Google AI CRM Architect
License: Apache-2.0

## Overview
This Google Apps Script (GAS) acts as the high-availability REST API backend for the Enterprise CRM. It converts a standard Google Sheet into a robust relational database with table constraints, auto-incrementing ID generators, localized Bangladesh/Asia timezone date-stamps, and strict security assertions.

## Database Tables (Google Sheet Tabs)
The system automatically bootstraps the following worksheets if they do not exist:
1. **Clients**: Registry of CRM client leads and customer contact information.
2. **Tickets**: Support requests, task tracking, and priority scoring.
3. **Conversations**: Notes, user comments, and touchpoints mapped to support tickets.
4. **Users**: Team members list, role flags, access tokens, and activity log tracking.
5. **ActivityLogs**: High-compliance system log auditing for database operations.

## Core Services
- **Code.gs**: Intercepts HTTP GET and POST requests and dispatches them to respective modules.
- **Config.gs**: Central declarations of structures, schema arrays, and tables.
- **Auth.gs**: Validates user access privileges. First user to login is auto-promoted as CRM Owner.
- **Client.gs / Ticket.gs / Conversation.gs**: CRUD functions enforcing relational mapping.
- **FollowUp.gs**: Automatically bubbles next follow-up dates and historical logs up to clients.
- **Backup.gs**: Snapshotting and full JSON data restoration logic.
- **Search.gs**: Performance-optimized cross-sheet multi-column text querying.
- **Utils.gs**: Localized utilities including BD phone formatters and Asia/Dhaka time.`,

  api: `# REST API Gateway Reference Manual
Protocol: HTTP / JSON
Base URL: [Your Google Apps Script Web App URL]

## 1. Authentication
All secure endpoints require the following headers passed from the CRM:
- \`x-user-email\`: Email address of the requesting authenticated user.
- \`x-user-name\`: Human name of the requesting user.
- \`x-apps-script-url\`: Self-referential Web App URL for routing proxy commands.

---

## 2. GET API Endpoints

### getClients
- **Action**: \`getClients\`
- **Response**: Array of Client Objects.
\`\`\`json
[
  {
    "clientId": "CLI-8C4D9F0E",
    "name": "Rahim Ahmed",
    "phone": "+8801712345678",
    "company": "Dhaka Tech Ltd",
    "status": "New",
    "totalTickets": 1,
    "nextFollowUp": "15/07/2026",
    "lastContact": "30/06/2026 04:12:30 PM",
    "createdAt": "30/06/2026 04:12:30 PM",
    "updatedAt": "30/06/2026 04:12:30 PM",
    "district": "Dhaka",
    "isPinned": false,
    "isArchived": false,
    "followUpHistory": ""
  }
]
\`\`\`

### getTickets
- **Action**: \`getTickets\`
- **Response**: Array of Ticket Objects.

### getStats
- **Action**: \`getStats\`
- **Response**: Dashboard KPIs (total clients, open tickets, pending followups).

---

## 3. POST API Endpoints

### addClient
- **Action**: \`addClient\`
- **Body**:
\`\`\`json
{
  "action": "addClient",
  "name": "Rahim Ahmed",
  "phone": "01712345678",
  "company": "Dhaka Tech Ltd",
  "district": "Dhaka",
  "status": "New"
}
\`\`\`

### updateClient
- **Action**: \`updateClient\`
- **Body**: Update parameters mapping Client ID.`,

  deployment: `# Google Apps Script Deployment Guide
Step-by-step instructions to link Google Sheets and Google Apps Script securely.

## Prerequisites
1. A Google Account (Workspace or Gmail).
2. A blank Google Sheet created in your Google Drive.

---

## Step-by-Step Instructions

### Step 1: Open Google Apps Script
1. Navigate to **https://script.google.com**.
2. Click **New Project** at the top left.
3. Rename the project to: **"Enterprise CRM Backend Service"**.

### Step 2: Create required script files
Create a total of 14 files inside your Apps Script project matching the names below:
1. **Code.gs**
2. **Config.gs**
3. **Auth.gs**
4. **Client.gs**
5. **Ticket.gs**
6. **Conversation.gs**
7. **FollowUp.gs**
8. **User.gs**
9. **Activity.gs**
10. **Backup.gs**
11. **Dashboard.gs**
12. **Search.gs**
13. **Utils.gs**
14. **API.gs**

*Note: You can add files by clicking the "+" icon next to "Files" and choosing "Script". Delete any default placeholder code inside before pasting.*

### Step 3: Copy and Paste Code
Copy the production-ready code for each file from the expandable cards in this **Apps Script Manager** and paste them into their corresponding files.

### Step 4: Save the Project
Click the disk icon or press **Ctrl+S** (Cmd+S on macOS) to save all files.

### Step 5: Deploy as a Web App
1. Click the blue **"Deploy"** button at the top right.
2. Select **"New deployment"**.
3. Click the gear icon next to "Select type" and choose **"Web app"**.
4. Configure the following fields:
   - **Description**: CRM REST API Gateway
   - **Execute as**: **Me (your-email@gmail.com)**
   - **Who has access**: **Anyone**
5. Click **"Deploy"**.
6. Google will prompt you to **Authorize Access**. Click "Authorize access", choose your Google account, click "Advanced", click "Go to Enterprise CRM Backend Service (unsafe)", and click "Allow".
7. Copy the generated **Web App URL**. It will look like: \`https://script.google.com/macros/s/AKfyc.../exec\`.

### Step 6: Link to CRM App
1. Return to the CRM under **Profile -> Connections Settings**.
2. Paste the URL into the **Google Apps Script Web App URL** input field.
3. Click **Save Settings**.
4. Go to **Developer Panel -> Apps Script Manager** and click **Test Apps Script Connection** to verify connection.`,

  version: `# Google Apps Script CRM Version History
Chronological release notes of the backend database architecture.

### v3.5.0 (Current Release - June 2026)
- Added full support for Multi-User concurrency checks.
- Enabled automatic Owner Promotions during database zero-state boots.
- Integrated automated database JSON backups and restorations.
- Added comprehensive Bangladeshi mobile phone validators.

### v2.1.0 (March 2026)
- Implemented Support Ticketing models.
- Added automated follow-up scheduling and notification bubblers.
- Integrated localized Asia/Dhaka timestamp strings.

### v1.0.0 (January 2026)
- Initial deployment of Google Sheets DB layout.
- Basic REST routing for Clients directory.`,

  release: `# Release Notes: v3.5.0-Enterprise
Published: June 30, 2026

## What's New
- **Zero-Config Database Bootstrap**: When the CRM backend initializes for the first time, the system detects an empty user log and automatically registers the first Google Auth login as the absolute **Owner**.
- **Unified Relational Integrity**: Added automatic cascades. Creating a support note on a ticket automatically increments the conversation counts and schedules follow-up logs on the parent client row.
- **Enhanced Bangladesh Localization**: Mobile numbers are parsed and formatted into international standards (\`+8801...\`) with regex validation.
- **Audit Compliance logs**: Every client insert, user deletion, or backup restoration is written immediately into the \`ActivityLogs\` worksheet for transparent tracking.`
};
