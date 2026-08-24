import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { CrmSkeleton } from "../components/common/CrmSkeleton";
import { CrmNotificationCenter } from "../components/common/CrmNotifications";

const AppShell = lazy(() => import("../components/layout/AppShell").then(m => ({ default: m.AppShell })));
const LoginArea = lazy(() => import("../features/auth/AuthRoutes").then(m => ({ default: m.LoginArea })));
const ProtectedArea = lazy(() => import("../features/auth/AuthRoutes").then(m => ({ default: m.ProtectedArea })));

// Core Bespoke Workspaces
const ManagementDashboard = lazy(() =>
  import("../features/dashboard/ManagementDashboard").then(m => ({ default: m.ManagementDashboard }))
);
const RegistrationForm = lazy(() =>
  import("../features/students/registration/RegistrationForm").then(m => ({ default: m.RegistrationForm }))
);
const StudentDirectory = lazy(() =>
  import("../features/students/directory/StudentDirectory").then(m => ({ default: m.StudentDirectory }))
);
const StudentProfile = lazy(() =>
  import("../features/students/profile/StudentProfile").then(m => ({ default: m.StudentProfile }))
);
const CounsellingDashboard = lazy(() =>
  import("../features/counselling/CounsellingDashboard").then(m => ({ default: m.CounsellingDashboard }))
);
const ApplicationWorkspace = lazy(() =>
  import("../features/applications/ApplicationWorkspace").then(m => ({ default: m.ApplicationWorkspace }))
);
const DocumentDashboard = lazy(() =>
  import("../features/documents/DocumentDashboard").then(m => ({ default: m.DocumentDashboard }))
);
const ClassesWorkspace = lazy(() =>
  import("../features/classes/ClassesWorkspace").then(m => ({ default: m.ClassesWorkspace }))
);
const ClassEnquiries = lazy(() =>
  import("../features/classes/ClassEnquiries").then(m => ({ default: m.ClassEnquiries }))
);
const ClassEnquiryProfile = lazy(() =>
  import("../features/classes/ClassEnquiryProfile").then(m => ({ default: m.ClassEnquiryProfile }))
);
const MockTestsWorkspace = lazy(() =>
  import("../features/mocks/MockTestsWorkspace").then(m => ({ default: m.MockTestsWorkspace }))
);
const FinanceWorkspace = lazy(() =>
  import("../features/finance/FinanceWorkspace").then(m => ({ default: m.FinanceWorkspace }))
);
const AnalyticsDashboard = lazy(() =>
  import("../features/analytics/AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard }))
);
const AdminDashboard = lazy(() =>
  import("../features/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard }))
);
const HrmsWorkspace = lazy(() =>
  import("../features/hrms/HrmsWorkspace").then(m => ({ default: m.HrmsWorkspace }))
);
const LeadsWorkspace = lazy(() =>
  import("../features/leads/LeadsWorkspace").then(m => ({ default: m.LeadsWorkspace }))
);
const B2BWorkspace = lazy(() =>
  import("../features/b2b/B2BWorkspace").then(m => ({ default: m.B2BWorkspace }))
);
const MessagesWorkspace = lazy(() =>
  import("../features/messages/MessagesWorkspace").then(m => ({ default: m.MessagesWorkspace }))
);
const EmailAutomationWorkspace = lazy(() =>
  import("../features/email/EmailAutomationWorkspace").then(m => ({ default: m.EmailAutomationWorkspace }))
);

const NotFound = () => (
  <section className="page-container" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
    <div className="panel" style={{ maxWidth: "520px", textAlign: "center", padding: "40px" }}>
      <p className="eyebrow">404 · Workspace not found</p>
      <h1 style={{ margin: "8px 0", fontSize: "24px" }}>This CRM page does not exist</h1>
      <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
        The address may be outdated or the module may not be available to your account.
      </p>
      <Link className="primary-button" style={{ display: "inline-flex", marginTop: "14px", textDecoration: "none" }} to="/dashboard">
        Return to dashboard
      </Link>
    </div>
  </section>
);

import { RoleRouteGuard } from "../features/auth/RoleRouteGuard";

export default function App() {
  return (
    <><CrmNotificationCenter/><Suspense fallback={<CrmSkeleton />}>
      <Routes>
        {/* Staff login route */}
        <Route path="/login" element={<LoginArea />} />

        {/* Protected Staff Operational Workspace */}
        <Route element={<ProtectedArea />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ManagementDashboard />} />
            
            {/* Leads Workspace */}
            <Route
              path="/leads"
              element={
                <RoleRouteGuard permission="leads" workspaceName="Leads Management">
                  <LeadsWorkspace />
                </RoleRouteGuard>
              }
            />

            {/* Students Directory */}
            <Route
              path="/students"
              element={
                <RoleRouteGuard permission="students" workspaceName="Student Directory">
                  <StudentDirectory />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/students/register"
              element={
                <RoleRouteGuard permission="students" workspaceName="Student Registration">
                  <RegistrationForm />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/students/:id"
              element={
                <RoleRouteGuard permission="students" workspaceName="Student Profile">
                  <StudentProfile />
                </RoleRouteGuard>
              }
            />

            {/* Abroad Counselling */}
            <Route
              path="/counselling"
              element={
                <RoleRouteGuard permission="counselling" workspaceName="Abroad Counselling Hub">
                  <CounsellingDashboard />
                </RoleRouteGuard>
              }
            />

            {/* Applications & Visa */}
            <Route
              path="/applications"
              element={
                <RoleRouteGuard permission="applications" workspaceName="Visa Applications Workspace">
                  <ApplicationWorkspace />
                </RoleRouteGuard>
              }
            />

            {/* B2B Partners */}
            <Route
              path="/b2b"
              element={
                <RoleRouteGuard permission="b2b" workspaceName="B2B Partners Desk">
                  <B2BWorkspace />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/b2b-partners"
              element={
                <RoleRouteGuard permission="b2b" workspaceName="B2B Partners Desk">
                  <B2BWorkspace />
                </RoleRouteGuard>
              }
            />

            {/* Documents Vault */}
            <Route
              path="/documents"
              element={
                <RoleRouteGuard permission="documents" workspaceName="Document Vault & Verification">
                  <DocumentDashboard />
                </RoleRouteGuard>
              }
            />

            {/* Classes & Batches */}
            <Route
              path="/classes"
              element={
                <RoleRouteGuard permission="classes" workspaceName="Classes & Test Preparation">
                  <ClassesWorkspace />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/class-enquiries"
              element={
                <RoleRouteGuard permission="classes" workspaceName="Class Enquiries">
                  <ClassEnquiries />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/class-enquiries/:id"
              element={
                <RoleRouteGuard permission="classes" workspaceName="Class Enquiry Profile">
                  <ClassEnquiryProfile />
                </RoleRouteGuard>
              }
            />

            {/* Mock Tests */}
            <Route
              path="/mocks"
              element={
                <RoleRouteGuard permission="mocks" workspaceName="Mock Tests & Diagnostics">
                  <MockTestsWorkspace />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/mock-tests"
              element={
                <RoleRouteGuard permission="mocks" workspaceName="Mock Tests & Diagnostics">
                  <MockTestsWorkspace />
                </RoleRouteGuard>
              }
            />

            {/* HRMS & Payroll */}
            <Route
              path="/hrms"
              element={
                <RoleRouteGuard permission="hrms" workspaceName="HRMS & Staff Management">
                  <HrmsWorkspace />
                </RoleRouteGuard>
              }
            />

            {/* Finance & Accounts */}
            <Route
              path="/finance"
              element={
                <RoleRouteGuard permission="finance" workspaceName="Finance & Accounting">
                  <FinanceWorkspace />
                </RoleRouteGuard>
              }
            />

            {/* Team Messages (All 18 Staff Can Chat Privately) */}
            <Route
              path="/messages"
              element={
                <RoleRouteGuard permission="messages" workspaceName="Team Messages">
                  <MessagesWorkspace />
                </RoleRouteGuard>
              }
            />

            {/* Email Automation & Drip Campaigns */}
            <Route
              path="/email-automation"
              element={
                <RoleRouteGuard permission="settings" workspaceName="Email Automation">
                  <EmailAutomationWorkspace />
                </RoleRouteGuard>
              }
            />

            {/* Reports & Analytics */}
            <Route
              path="/analytics"
              element={
                <RoleRouteGuard permission="reports" workspaceName="Analytics & Reports">
                  <AnalyticsDashboard />
                </RoleRouteGuard>
              }
            />

            {/* Administration Settings & RBAC */}
            <Route
              path="/settings"
              element={
                <RoleRouteGuard permission="settings" workspaceName="System Settings & Security">
                  <AdminDashboard />
                </RoleRouteGuard>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense></>
  );
}
