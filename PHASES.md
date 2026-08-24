# AECS CRM Delivery Plan

The CRM is delivered in ten independently reviewable phases. A phase is complete only when its acceptance criteria pass, the browser preview is reviewed, and the resulting changes are committed together.

## Phase 1 — Secure foundation

- Supabase-only staff authentication and revocable sessions
- Canonical staff roles and database-enforced authorization helpers
- Active-staff verification and least-privilege profile editing
- Protected routes, explicit unauthorized states, and a real not-found page
- Responsive application shell and deployment configuration
- Error handling, validation, build checks, and security baseline

## Phase 2 — Leads and student intake

- Public enquiries, lead ownership, follow-ups, duplicate detection
- Lead conversion, student registration, profiles, search, and activity history

## Phase 3 — Counselling and applications

- Counselling appointments and notes, course shortlists, application and visa lifecycle
- Case tasks, document deadlines, ownership, and escalation

## Phase 4 — Document management

- Private object storage, uploads, previews, versions, verification, expiry, and audit history

## Phase 5 — Classes and examinations

- Courses, batches, schedules, enrolment, attendance, mock tests, scores, and progress reports

## Phase 6 — Finance and commissions

- Quotations, invoices, receipts, refunds, expenses, journals, approvals, and commissions

## Phase 7 — HRMS

- Staff records, shifts, attendance, leave, payroll, performance, and staff documents

## Phase 8 — Communication

- Internal messaging, notifications, production realtime transport, email automation, and delivery history

## Phase 9 — Reporting and administration

- Live dashboards, operational reports, exports, branches, RBAC administration, and audit viewer

## Phase 10 — Production hardening

- Automated testing, accessibility, security review, backups, monitoring, CI/CD, and deployment

## Definition of done for every phase

1. Database migrations are repeatable and least-privilege policies are documented.
2. UI workflows include loading, empty, success, validation, and failure states.
3. TypeScript, lint, tests, and production build pass for the phase scope.
4. Desktop, tablet, and mobile layouts are verified in the browser.
5. No credentials, private student data, or generated preview artifacts are committed.
6. The user reviews the preview before the phase receives its final commit.
