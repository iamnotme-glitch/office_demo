# Office Invoice App

A complete invoicing application built with Node.js, Express, TypeScript, EJS templates, and SQLite persistence using `sql.js`.

## Overview

Office Invoice App is designed to help freight and logistics operators create, manage, and export invoices with rich line items, vehicle rate segments, demurrage charges, client entities, and PDF invoice generation.

## Key Features

- User authentication with JWT cookies
- Registration and login pages
- Role-based access control with an admin dashboard
- Create, edit, view, and delete invoices
- Support for vehicle-based rates, demurrage, and item line charges
- Automatic invoice number generation and invoice UUID tracking
- PDF export for invoices using `pdfkit`
- Client/company management and invoice list view
- SQLite database persistence via `sql.js`
- EJS view templates and static assets under `public/`

## Built With

- Node.js
- Express
- TypeScript
- EJS
- SQL.js (SQLite in a file-based persistence model)
- PDFKit
- bcryptjs
- jsonwebtoken

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm

### Installation

1. Clone the repository or copy the project files.
2. Install dependencies:

```bash
npm install
```

### Running Locally

Start the app in development mode:

```bash
npm run dev
```

Then open:

```text
http://localhost:8989
```

### Production Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

Start the compiled app:

```bash
npm start
```

## Environment Variables

The app supports the following optional environment variables:

- `PORT` – port to run the server (default: `3000`)
- `NODE_ENV` – environment mode (`production` recommended for cookie security)
- `JWT_SECRET` – secret used to sign JWT tokens (default is built into the app when not set)

## Database

The application stores its data in `data/invoice.db` using `sql.js`.

- The database file is created automatically when the app starts.
- SQLite tables are created on first launch if they do not already exist.
- Persistent data includes clients, invoices, invoice items, and users.

## Project Structure

- `src/main.ts` – Express app entry point
- `src/routes/` – route definitions for authentication, invoices, and admin controls
- `src/services/` – business logic for auth, invoices, finance, PDF generation, and caching
- `src/repositories/` – database access layer for clients, invoices, and users
- `src/middleware/` – authentication and authorization middleware
- `src/views/` – EJS templates for the UI
- `public/` – static CSS and frontend assets
- `data/` – generated database file and stored persisting content

## Authentication & Authorization

- Users register and log in via form-based authentication.
- JWT tokens are stored in an HTTP-only cookie: `auth_token`.
- Protected routes require authentication and redirect unauthorized users to login.
- The admin panel is restricted to users with the `admin` role.

## Invoice Workflow

1. Register or log in.
2. Create a new invoice from the dashboard.
3. Select sender and receiver clients.
4. Add line item charges, vehicle rate segments, and demurrage entries.
5. Save the invoice and view the invoice detail page.
6. Export invoices as PDF directly from the invoice view.

## Admin Dashboard

The admin dashboard allows authorized users to:

- View summary statistics for invoices, clients, and users
- Manage user roles
- Delete users

## Useful Scripts

- `npm run dev` – start development server with `tsx` watch mode
- `npm run build` – compile TypeScript into `dist/`
- `npm start` – run compiled production server

## Notes

- The app seeding creates a default `Miscellaneous` client automatically.
- If an admin user is required, create a user and then assign the `admin` role in the database or via an existing admin account.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details, or include your preferred open source license in this repository.
