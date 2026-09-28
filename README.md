# AECS Student Management System

Internal staff workspace for Abroad Education Consultancy Services Pvt. Ltd.

## Preview locally

1. Open a terminal in this folder.
2. Run `npm install` once.
3. Run `npm run dev` or double-click `preview-aecs.cmd` on Windows.
4. On the server computer, open `http://localhost:5173`.
5. From another computer on the same network, open the `Network` URL printed by Vite, such as `http://172.16.100.44:5173`.

The server listens on all network interfaces. Keep the terminal running; closing it stops the CRM. If another computer still times out, allow inbound TCP port `5173` in the server computer's firewall and confirm both computers are on the same LAN. The preview updates automatically when project files change. Press `Ctrl+C` in the terminal to stop it.

## Production check

Run `npm run build`. The production-ready files are generated in `dist/`.

## Current scope

The CRM includes Supabase authentication, action-level staff permissions, student and application workflows, HRMS, attendance, payroll, employee breaks, finance, reporting, assignments, messaging, and administration.
