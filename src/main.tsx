import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./styles/globals.css";
import "./styles/features.css";
import "./styles/modal.css";
import "./styles/phase9.css";
import "./styles/public-registration.css";
import "./styles/public-registration-validation.css";
import "./styles/final-polish.css";
import "./styles/topbar-interactions.css";
import "./styles/mobile-hardening.css";
import "./styles/brand-redesign.css";
import "./styles/date-filters.css";
import "./styles/logo-fit.css";
import "./styles/registration-mobile-selects.css";
import "./styles/class-enquiries.css";
import "./styles/class-enquiries-polish.css";
import "./styles/student-profile-polish.css";
import "./styles/footer-icons.css";
import "./styles/dashboard-charts.css";
import "./styles/app.css";
import "./styles/messages-workspace.css";
import "./styles/login-page.css";
import "./styles/call-modal.css";
import "./styles/email-workspace.css";
import "./styles/leads-redesign.css";
import "./styles/leads-typography.css";
import "./styles/crm-skeleton.css";
import "./styles/metric-indicators.css";
import "./styles/case-task-panel.css";
import "./styles/case-task-modal.css";
import "./styles/classes-workspace.css";
import "./styles/student-registration-redesign.css";
import "./styles/student-record-editor.css";
import "./styles/student-document-vault.css";
import "./styles/student-directory-redesign.css";
import "./styles/crm-notifications.css";
import "./styles/directory-tables.css";
import "./styles/university-course-manager.css";
import { ErrorBoundary } from "./core/error/ErrorBoundary";

// Total purge of previous sample dataset keys on initial load
const PURGE_FLAG = "aecs_crm_cleared_v6";
if (!localStorage.getItem(PURGE_FLAG)) {
  const keysToPurge = [
    "aecs_persistent_students",
    "aecs_persistent_leads",
    "aecs_persistent_b2b_partners_v2",
    "aecs_class_students_v2",
    "aecs_mock_test_results_v2",
    "aecs_mock_test_slots_v2",
    "aecs_persistent_applications",
    "aecs_persistent_applications_v3",
    "aecs_persistent_counselling",
    "aecs_persistent_invoices",
    "aecs_persistent_journals",
    "aecs_persistent_commissions",
    "aecs_documents_v2",
    "aecs_course_batches_v2",
    "aecs_persistent_batches",
    "aecs_active_chat_channel",
    "aecs_active_chat_recipient",
  ];
  keysToPurge.forEach(k => localStorage.removeItem(k));
  localStorage.setItem(PURGE_FLAG, "true");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary><BrowserRouter><App /></BrowserRouter></ErrorBoundary>
  </React.StrictMode>,
);

