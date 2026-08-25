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
import "./styles/workspace-reload.css";
import "./styles/metric-indicators.css";
import "./styles/case-task-panel.css";
import "./styles/case-task-modal.css";
import "./styles/classes-workspace.css";
import "./styles/student-registration-redesign.css";
import "./styles/student-record-editor.css";
import "./styles/student-document-vault.css";
import "./styles/student-directory-redesign.css";
import "./styles/mock-tests-redesign.css";
import "./styles/crm-notifications.css";
import "./styles/directory-tables.css";
import "./styles/university-course-manager.css";
import "./styles/lead-conversion-dialog.css";
import { ErrorBoundary } from "./core/error/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary><BrowserRouter><App /></BrowserRouter></ErrorBoundary>
  </React.StrictMode>,
);

