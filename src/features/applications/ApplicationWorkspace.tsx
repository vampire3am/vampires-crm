import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, Download, Eye, FileSpreadsheet, FileText, GraduationCap, ImagePlus, Kanban, Pencil, PlaneTakeoff, Plus, Search, ShieldCheck, Table as TableIcon, UploadCloud, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ApplicationService,
  type UniversityApplication,
} from "../../services/applicationService";
import { useAuth } from "../auth/AuthProvider";
import { CaseTaskPanel } from "./CaseTaskPanel";
import { KpiTrendIndicator } from "../../components/common/KpiTrendIndicator";
import { CountryDisplay } from "../../components/ui/CountryDisplay";
import { StudentSelect } from "../../components/ui/StudentSelect";
import { StudentDirectoryRecord, StudentService } from "../../services/studentService";
import { DocumentRecord, DocumentService } from "../../services/documentService";
import { notifyError, notifySuccess } from "../../components/common/CrmNotifications";
import { validateDocumentFiles } from "../../lib/documentUploadPolicy";

type ApplicationDestination = { name: string; code: string; popularIntakes?: string[]; intakeCycles?: string[] };
type ApplicationUniversity = {
  name: string;
  country: string;
  countryCode: string;
  popularCourses?: string[];
  courses?: { name: string; qualification?: string; intakes?: string; status?: "ACTIVE" | "INACTIVE" }[];
  tuition?: string;
  intake?: string;
};
const APPLICATION_DESTINATIONS_KEY = "aecs_destinations_catalog_v2";
const APPLICATION_UNIVERSITIES_KEY = "aecs_partner_universities_v2";
const STUDY_LEVELS = ["+2 / Diploma", "Foundation / Pathway", "Certificate", "Bachelor's Degree", "Graduate Certificate", "Postgraduate Diploma", "Master's Degree", "PhD / Doctorate"];

const normalizeCountryCode = (value?: string) => {
  const code = (value || "").trim().toUpperCase();
  if (["UK", "GBR"].includes(code)) return "GB";
  if (code === "USA") return "US";
  return code;
};

const normalizeCountryName = (value?: string) => {
  const name = (value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (["uk", "unitedkingdom", "greatbritain", "britain"].includes(name)) return "unitedkingdom";
  if (["us", "usa", "unitedstates", "unitedstatesofamerica", "america"].includes(name)) return "unitedstates";
  return name;
};

function CatalogCombobox({ value, options, placeholder, disabled, emptyText, onChange }: {
  value: string; options: string[]; placeholder: string; disabled?: boolean; emptyText: string; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className={`catalog-combobox${open ? " open" : ""}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button type="button" className="catalog-combobox-trigger" disabled={disabled} onClick={() => setOpen(current => !current)}>
      <span className={value ? "" : "placeholder"}>{value || placeholder}</span><ChevronDown size={15}/>
    </button>
    {open && <div className="catalog-combobox-menu">
      <div className="catalog-combobox-search"><Search size={14}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search catalogue…" /></div>
      <div className="catalog-combobox-options">
        {filtered.length ? filtered.map(option => <button type="button" key={option} className={option === value ? "selected" : ""} onClick={() => { onChange(option); setOpen(false); setQuery(""); }}><span>{option}</span>{option === value && <Check size={14}/>}</button>) : <div className="catalog-combobox-empty">{emptyText}</div>}
      </div>
    </div>}
  </div>;
}

type ApplicationStage = UniversityApplication["stage"];

const STAGES: { key: ApplicationStage | "ALL"; label: string; tabLabel: string; tone: string }[] = [
  { key: "ALL", label: "All Applications", tabLabel: "All Applications", tone: "blue" },
  { key: "SUBMITTED", label: "Under Review", tabLabel: "Under Review", tone: "amber" },
  { key: "CONDITIONAL_OFFER", label: "Conditional Offer", tabLabel: "Conditional Offer", tone: "blue" },
  { key: "UNCONDITIONAL_OFFER", label: "Unconditional Offer", tabLabel: "Unconditional Offer", tone: "green" },
  { key: "CAS_ISSUED", label: "CAS / I-20 Issued", tabLabel: "CAS / I-20 Issued", tone: "purple" },
  { key: "VISA_LODGED", label: "Visa Lodged", tabLabel: "Visa Lodged", tone: "indigo" },
  { key: "VISA_APPROVED", label: "Visa Approved", tabLabel: "Visa Approved", tone: "green" },
];

export function ApplicationWorkspace() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<UniversityApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "pipeline">("table");
  const [activeTab, setActiveTab] = useState<ApplicationStage | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [students, setStudents] = useState<StudentDirectoryRecord[]>([]);
  const [catalogDestinations, setCatalogDestinations] = useState<ApplicationDestination[]>([]);
  const [catalogUniversities, setCatalogUniversities] = useState<ApplicationUniversity[]>([]);
  const [useUnlistedUniversity, setUseUnlistedUniversity] = useState(false);
  const [useUnlistedCourse, setUseUnlistedCourse] = useState(false);

  // Modals & Drawers
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const [savingApplication, setSavingApplication] = useState(false);
  const [applicationFormError, setApplicationFormError] = useState("");
  const [applicationFormStep, setApplicationFormStep] = useState<1 | 2 | 3>(1);
  const [applicationReviewConfirmed, setApplicationReviewConfirmed] = useState(false);
  const [activeDossier, setActiveDossier] = useState<UniversityApplication | null>(null);
  const [stageChangeApp, setStageChangeApp] = useState<UniversityApplication | null>(null);
  const [dossierDocuments, setDossierDocuments] = useState<DocumentRecord[]>([]);
  const [dossierFilesBusy, setDossierFilesBusy] = useState(false);
  const [studentPhotoUrl, setStudentPhotoUrl] = useState("");

  // Submit Application Form State
  const [newAppForm, setNewAppForm] = useState({
    studentCode: "",
    studentName: "",
    universityName: "",
    country: "" as UniversityApplication["country"],
    countryCode: "" as UniversityApplication["countryCode"],
    studyLevel: "",
    course: "",
    intake: "",
    stage: "SUBMITTED" as ApplicationStage,
    deadline: "",
    officer: profile?.full_name || "",
    tuitionFee: "",
    scholarship: "",
    notes: "",
  });

  useEffect(() => {
    if (!profile?.full_name) return;
    setNewAppForm(current => current.officer ? current : { ...current, officer: profile.full_name });
  }, [profile?.full_name]);

  const resetApplicationForm = () => {
    setNewAppForm({
      studentCode: "", studentName: "", universityName: "", country: "", countryCode: "",
      studyLevel: "", course: "", intake: "", stage: "SUBMITTED", deadline: "", officer: profile?.full_name || "",
      tuitionFee: "", scholarship: "", notes: "",
    });
    setApplicationFormStep(1);
    setApplicationReviewConfirmed(false);
    setEditingApplicationId(null);
    setApplicationFormError("");
    setUseUnlistedUniversity(false);
    setUseUnlistedCourse(false);
  };

  const closeApplicationForm = () => {
    setShowSubmitModal(false);
    resetApplicationForm();
  };

  const cancelApplicationEdit = () => {
    const original = editingApplicationId
      ? applications.find(application => application.id === editingApplicationId) || null
      : null;
    closeApplicationForm();
    if (original) setActiveDossier(original);
  };

  const openNewApplicationForm = () => {
    resetApplicationForm();
    setShowSubmitModal(true);
  };

  const openApplicationEdit = (application: UniversityApplication) => {
    setEditingApplicationId(application.id);
    setApplicationFormError("");
    setNewAppForm({
      studentCode: application.studentCode,
      studentName: application.studentName,
      universityName: application.universityName,
      country: application.country,
      countryCode: application.countryCode,
      studyLevel: application.studyLevel === "Not specified" ? "" : application.studyLevel,
      course: application.course,
      intake: application.intake,
      stage: application.stage,
      deadline: application.deadline,
      officer: application.officer,
      tuitionFee: application.tuitionFee === "Not recorded" ? "" : application.tuitionFee,
      scholarship: application.scholarship === "None" ? "" : application.scholarship,
      notes: application.notes || "",
    });
    setApplicationFormStep(1);
    setUseUnlistedUniversity(!catalogUniversities.some(university => university.name === application.universityName));
    setUseUnlistedCourse(false);
    setActiveDossier(null);
    setShowSubmitModal(true);
  };

  const loadApplications = async () => {
    setLoading(true);
    const data = await ApplicationService.getApplications();
    setApplications(data);
    setLoading(false);
  };

  useEffect(() => {
    // Initial remote hydration is intentionally performed once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadApplications();
  }, []);

  useEffect(() => {
    if (!activeDossier) { setDossierDocuments([]); setStudentPhotoUrl(""); return; }
    let cancelled = false;
    DocumentService.list().then(async records => {
      if (cancelled) return;
      const studentRecords = records.filter(record => record.studentCode === activeDossier.studentCode);
      setDossierDocuments(studentRecords);
      const photo = studentRecords.find(record => record.fileName.startsWith("Student profile photo") && record.mimeType.startsWith("image/"));
      if (photo) {
        const url = await DocumentService.signedUrl(photo.storagePath);
        if (!cancelled) setStudentPhotoUrl(url);
      }
    }).catch(() => { if (!cancelled) setDossierDocuments([]); });
    return () => { cancelled = true; };
  }, [activeDossier?.id, activeDossier?.studentCode]);

  const refreshDossierDocuments = async (studentCode:string) => {
    const records = (await DocumentService.list()).filter(record => record.studentCode === studentCode);
    setDossierDocuments(records);
    const photo = records.find(record => record.fileName.startsWith("Student profile photo") && record.mimeType.startsWith("image/"));
    setStudentPhotoUrl(photo ? await DocumentService.signedUrl(photo.storagePath) : "");
  };

  const uploadDossierPhoto = async (file?:File) => {
    if (!activeDossier || !file) return;
    if (!file.type.startsWith("image/")) { notifyError("Invalid profile photo", "Choose a JPG, PNG, WEBP, or GIF image."); return; }
    if (file.size > 5 * 1024 * 1024) { notifyError("Photo is too large", "Choose an image smaller than 5 MB."); return; }
    setDossierFilesBusy(true);
    try {
      await DocumentService.upload({studentCode:activeDossier.studentCode,category:"Profile Photo",title:`Student profile photo - ${activeDossier.studentName}`,file,expiresOn:"",notes:"Uploaded from the university application dossier"});
      await refreshDossierDocuments(activeDossier.studentCode);
      notifySuccess("Student photo updated", "The photo is visible in this dossier and secured in the Document Vault.");
    } catch (error) { notifyError("Photo upload failed", error instanceof Error ? error.message : "The photo could not be uploaded."); }
    finally { setDossierFilesBusy(false); }
  };

  const uploadDossierDocuments = async (files:File[]) => {
    if (!activeDossier || files.length === 0) return;
    if (!validateDocumentFiles(files)) return;
    if (files.length > 15) { notifyError("Too many documents", "Upload a maximum of 15 documents in one batch."); return; }
    setDossierFilesBusy(true);
    try {
      const results = await Promise.allSettled(files.map(file => DocumentService.upload({studentCode:activeDossier.studentCode,category:"Application Documents",title:file.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," "),file,expiresOn:"",notes:`Application dossier: ${activeDossier.universityName}`})));
      const failed = results.filter(result => result.status === "rejected");
      await refreshDossierDocuments(activeDossier.studentCode);
      if (failed.length) throw new Error(`${results.length-failed.length} uploaded; ${failed.length} failed.`);
      notifySuccess(`${files.length} document${files.length === 1 ? "" : "s"} uploaded`, "Every file is now linked to this application and available in the central Document Vault.");
    } catch (error) { notifyError("Document upload failed", error instanceof Error ? error.message : "The documents could not be uploaded."); }
    finally { setDossierFilesBusy(false); }
  };

  const openDossierDocument = async (document:DocumentRecord, download=false) => {
    try {
      const url = await DocumentService.signedUrl(document.storagePath, download);
      if (download) window.location.assign(url); else window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) { notifyError("Document unavailable", error instanceof Error ? error.message : "The document could not be opened."); }
  };

  useEffect(() => {
    void StudentService.getStudents().then(setStudents).catch(() => setStudents([]));
    try {
      setCatalogDestinations(JSON.parse(localStorage.getItem(APPLICATION_DESTINATIONS_KEY) || "[]"));
      setCatalogUniversities(JSON.parse(localStorage.getItem(APPLICATION_UNIVERSITIES_KEY) || "[]"));
    } catch {
      setCatalogDestinations([]);
      setCatalogUniversities([]);
    }
  }, [showSubmitModal]);

  useEffect(() => {
    const routeState = location.state as { openApplicationForm?: boolean; country?: string; countryCode?: string } | null;
    if (!routeState?.openApplicationForm) return;
    setNewAppForm(current => ({
      ...current,
      country: routeState.country || current.country,
      countryCode: routeState.countryCode || current.countryCode,
    }));
    setUseUnlistedUniversity(false);
    setUseUnlistedCourse(false);
    setShowSubmitModal(true);
    setApplicationFormStep(1);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const universitiesForCountry = useMemo(() => {
    const selectedCode = normalizeCountryCode(newAppForm.countryCode);
    const selectedName = normalizeCountryName(newAppForm.country);
    if (!selectedCode && !selectedName) return [];
    return catalogUniversities.filter(university => {
      const universityCode = normalizeCountryCode(university.countryCode);
      const universityName = normalizeCountryName(university.country);
      return Boolean((selectedCode && universityCode === selectedCode) || (selectedName && universityName === selectedName));
    });
  }, [catalogUniversities, newAppForm.country, newAppForm.countryCode]);

  const coursesForSelection = useMemo(() => {
    const selectedUniversity = universitiesForCountry.find(university => university.name === newAppForm.universityName);
    const source = selectedUniversity ? [selectedUniversity] : universitiesForCountry;
    return Array.from(new Set(source.flatMap(university => {
      const activeCourses = university.courses?.filter(course => {
        if (course.status === "INACTIVE") return false;
        if (!newAppForm.studyLevel || !course.qualification || course.qualification === "Not specified") return true;
        if (newAppForm.studyLevel === "+2 / Diploma") return course.qualification === "Diploma" || course.qualification === "+2 / Diploma";
        return course.qualification === newAppForm.studyLevel;
      }).map(course => course.name).filter(Boolean) ?? [];
      return activeCourses.length ? activeCourses : university.popularCourses || [];
    }).filter(Boolean))).sort();
  }, [newAppForm.studyLevel, newAppForm.universityName, universitiesForCountry]);

  const intakeOptions = useMemo(() => {
    const destination = catalogDestinations.find(item => item.name === newAppForm.country);
    const university = universitiesForCountry.find(item => item.name === newAppForm.universityName);
    const course = university?.courses?.find(item => item.name === newAppForm.course);
    const values = [course?.intakes, university?.intake, ...(destination?.intakeCycles || []), ...(destination?.popularIntakes || [])]
      .flatMap(value => (value || "").split(","))
      .map(value => value.trim().replace(/\b(20\d{2})\s+\1\b/, "$1"))
      .filter(Boolean);
    return Array.from(new Set(values.length ? values : ["September 2026", "January 2027", "Spring 2027", "July 2027", "September 2027"]));
  }, [catalogDestinations, newAppForm.country, newAppForm.course, newAppForm.universityName, universitiesForCountry]);

  const selectedApplicationStudent = students.find(student => student.code === newAppForm.studentCode);

  const selectDestination = (countryName: string) => {
    const destination = catalogDestinations.find(item => item.name === countryName);
    setNewAppForm(current => ({
      ...current,
      country: countryName,
      countryCode: destination?.code || "",
      universityName: "",
      studyLevel: "",
      course: "",
      intake: "",
    }));
    setUseUnlistedUniversity(false);
    setUseUnlistedCourse(false);
  };

  const selectUniversity = (universityName: string) => {
    const university = universitiesForCountry.find(item => item.name === universityName);
    setNewAppForm(current => ({
      ...current,
      universityName,
      studyLevel: "",
      course: "",
      tuitionFee: university?.tuition || current.tuitionFee,
      intake: "",
    }));
  };

  // Compute 4 Top Metrics (Matching User Screenshot)
  const totalActive = applications.length;
  const confirmedOffers = applications.filter(
    a => a.stage === "UNCONDITIONAL_OFFER" || a.stage === "CONDITIONAL_OFFER"
  ).length;
  const visaQueue = applications.filter(a => a.stage === "VISA_LODGED").length;
  const visasApproved = applications.filter(a => a.stage === "VISA_APPROVED").length;
  const activeCountries = new Set(applications.map(application => application.country).filter(Boolean)).size;
  const offerRate = totalActive ? Math.round((confirmedOffers / totalActive) * 100) : 0;
  const visaDecisionTotal = applications.filter(application => application.stage === "VISA_APPROVED" || application.stage === "VISA_LODGED").length;
  const visaApprovalRate = visaDecisionTotal ? Math.round((visasApproved / visaDecisionTotal) * 100) : 0;
  const upcomingDeadline = applications.map(application => application.deadline).filter(Boolean).filter(deadline => new Date(deadline) >= new Date()).sort()[0];

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      // Tab filter
      if (activeTab !== "ALL" && app.stage !== activeTab) return false;

      // Dropdown stage filter
      if (stageFilter !== "ALL" && app.stage !== stageFilter) return false;

      // Destination filter
      if (destinationFilter !== "ALL" && app.country !== destinationFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          app.studentName.toLowerCase().includes(q) ||
          app.studentCode.toLowerCase().includes(q) ||
          app.universityName.toLowerCase().includes(q) ||
          app.course.toLowerCase().includes(q) ||
          app.country.toLowerCase().includes(q) ||
          app.officer.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [applications, activeTab, stageFilter, destinationFilter, searchQuery]);

  // Stage counters for tabs
  const getStageCount = (stageKey: ApplicationStage | "ALL") => {
    if (stageKey === "ALL") return applications.length;
    return applications.filter(a => a.stage === stageKey).length;
  };

  // Submit Handler
  const handleSubmitNewApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (applicationFormStep === 1) {
      if (!newAppForm.studentCode) {
        notifyError("Select a student", "Choose a registered student before continuing to the study plan.");
        return;
      }
      setApplicationFormStep(2);
      return;
    }
    if (applicationFormStep === 2) {
      const studyPlanComplete = newAppForm.country && newAppForm.universityName.trim() && newAppForm.studyLevel && newAppForm.course.trim() && newAppForm.intake;
      if (!studyPlanComplete) {
        notifyError("Complete the study plan", "Select the country, university, study level, course, and intake before continuing.");
        return;
      }
      setApplicationReviewConfirmed(false);
      setApplicationFormStep(3);
      return;
    }
    if (submitter?.dataset.applicationSubmit !== "true" || !applicationReviewConfirmed) {
      notifyError("Review confirmation required", "Review the final application details and tick the confirmation box before submitting.");
      return;
    }
    if (!newAppForm.studentName.trim() || !newAppForm.universityName.trim()) {
      setApplicationFormError("Select a student and university before saving.");
      return;
    }
    setSavingApplication(true);
    setApplicationFormError("");

    let cCode: UniversityApplication["countryCode"] = newAppForm.countryCode || "GB";
    if (newAppForm.country === "Australia") cCode = "AU";
    else if (newAppForm.country === "Canada") cCode = "CA";
    else if (newAppForm.country === "USA") cCode = "US";
    else if (newAppForm.country === "Germany") cCode = "DE";
    else if (newAppForm.country === "New Zealand") cCode = "NZ";
    else if (newAppForm.country === "Finland") cCode = "FI";
    else if (newAppForm.country === "Ireland") cCode = "IE";
    else if (newAppForm.country === "Japan") cCode = "JP";

    const payload = {
      studentCode: newAppForm.studentCode.trim(),
      studentName: newAppForm.studentName.trim(),
      universityName: newAppForm.universityName.trim(),
      country: newAppForm.country,
      countryCode: cCode,
      studyLevel: newAppForm.studyLevel,
      course: newAppForm.course.trim(),
      intake: newAppForm.intake,
      stage: newAppForm.stage,
      deadline: newAppForm.deadline,
      officer: newAppForm.officer,
      tuitionFee: newAppForm.tuitionFee.trim(),
      scholarship: newAppForm.scholarship.trim(),
      appliedDate: new Date().toISOString().split("T")[0],
      notes: newAppForm.notes.trim(),
    };

    try {
      if (editingApplicationId) {
        const updatedApplications = await ApplicationService.updateApplication(editingApplicationId, payload);
        const updated = updatedApplications.find(application => application.id === editingApplicationId) || null;
        setApplications(updatedApplications);
        setActiveDossier(updated);
      } else {
        await ApplicationService.createApplication(payload);
        await loadApplications();
      }
      notifySuccess(editingApplicationId ? "Application updated" : "Application submitted", `${newAppForm.studentName}'s application for ${newAppForm.universityName} was saved successfully.`);
      closeApplicationForm();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to save this application.";
      setApplicationFormError(message);
      notifyError("Unable to submit application", message);
    } finally {
      setSavingApplication(false);
    }
  };

  // Quick Stage Update Handler
  const handleUpdateStage = async (newStage: ApplicationStage) => {
    if (!stageChangeApp) return;
    await ApplicationService.updateApplicationStage(stageChangeApp.id, newStage);
    await loadApplications();
    setStageChangeApp(null);
  };

  return (
    <div className="page-container application-workspace">
      {loading && <div className="phase2-loading" role="status">Loading live applications…</div>}
      {/* 1. Header Row (Matching User Screenshot Layout) */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>University Applications & Lodgements</h2>
          <p>
            Track overseas university submissions, conditional offer letters, CAS/I-20 confirmations, and embassy visa outcomes.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", gap: "10px" }}>
          {/* Export CSV Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => ApplicationService.exportCsv(applications)}
          >
            <FileSpreadsheet size={15} />
            <span>Export CSV</span>
          </button>

          {/* Submit New Application action */}
          <button
            type="button"
            className="btn-primary"
            style={{ background: "#F97316", borderColor: "#F97316", color: "#FFFFFF" }}
            onClick={openNewApplicationForm}
          >
            <Plus size={15} />
            <span>Submit New Application</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Metric Boxes (Matching User Screenshot Layout) */}
      <section className="application-executive-summary">
        <header><div><strong>Admissions snapshot</strong><span>Live operational position</span></div><small>{totalActive} total records</small></header>
      <div className="metrics-grid-4 application-metrics-grid">
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Applications Active</span>
            <div className="metric-icon-wrap blue">
              <BookOpen size={17} />
            </div>
          </div>
          <div className="metric-value">{totalActive}</div>
          <KpiTrendIndicator metricKey="applications.active" value={totalActive} label={`${activeCountries} active destination${activeCountries === 1 ? "" : "s"} · ${upcomingDeadline ? `Next deadline ${new Date(upcomingDeadline).toLocaleDateString()}` : "No upcoming deadline"}`} />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Confirmed Offers</span>
            <div className="metric-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="metric-value">{confirmedOffers}</div>
          <KpiTrendIndicator metricKey="applications.offers" value={confirmedOffers} label={`${offerRate}% of applications · Fee deposit and CAS readiness`} />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Embassy Visa Queue</span>
            <div className="metric-icon-wrap amber">
              <PlaneTakeoff size={17} />
            </div>
          </div>
          <div className="metric-value">{visaQueue}</div>
          <KpiTrendIndicator metricKey="applications.visa-queue" value={visaQueue} label={`${visaQueue ? "Biometrics and embassy decisions require follow-up" : "No embassy decisions currently pending"}`} />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Total Visas Granted</span>
            <div className="metric-icon-wrap purple">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="metric-value">{visasApproved}</div>
          <KpiTrendIndicator metricKey="applications.visas-approved" value={visasApproved} label={`${visaApprovalRate}% approval across recorded visa decisions`} />
        </div>
      </div>
      </section>

      <CaseTaskPanel />

      <section className="crm-panel application-directory-panel">
      <div className="application-directory-heading">
        <div>
          <h3>Application Directory</h3>
          <p>{filteredApplications.length} of {applications.length} applications match the current view</p>
        </div>
      </div>

      {/* 3. Search & Toolbar Filter Row (Matching User Screenshot) */}
      <div className="application-directory-toolbar">
        <div className="search-input-wrap" style={{ flex: 1, minWidth: "280px" }}>
          <Search size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search university, student code, course..."
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Destination dropdown */}
          <select
            className="crm-select"
            value={destinationFilter}
            onChange={e => setDestinationFilter(e.target.value)}
            style={{ width: "160px" }}
          >
            <option value="ALL">All Destinations</option>
            {catalogDestinations.map(destination => <option key={destination.code} value={destination.name}>{destination.name}</option>)}
          </select>

          {/* Stage dropdown */}
          <select
            className="crm-select"
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            style={{ width: "180px" }}
          >
            <option value="ALL">All Application Stages</option>
            <option value="SUBMITTED">Under Review</option>
            <option value="CONDITIONAL_OFFER">Conditional Offer</option>
            <option value="UNCONDITIONAL_OFFER">Unconditional Offer</option>
            <option value="CAS_ISSUED">CAS / I-20 Issued</option>
            <option value="VISA_LODGED">Visa Lodged</option>
            <option value="VISA_APPROVED">Visa Approved</option>
          </select>

          {/* View mode toggle (Table vs Pipeline) */}
          <div className="view-mode-toggle" style={{ display: "flex", background: "var(--bg-card-subtle)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <button
              type="button"
              className={viewMode === "table" ? "active" : ""}
              onClick={() => setViewMode("table")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "table" ? "var(--bg-card)" : "transparent",
                color: viewMode === "table" ? "var(--text-main)" : "var(--text-muted)",
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>

            <button
              type="button"
              className={viewMode === "pipeline" ? "active" : ""}
              onClick={() => setViewMode("pipeline")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "pipeline" ? "var(--bg-card)" : "transparent",
                color: viewMode === "pipeline" ? "var(--text-main)" : "var(--text-muted)",
                boxShadow: viewMode === "pipeline" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <Kanban size={14} />
              <span>Pipeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Filter Tabs with Dynamic Counters (Matching User Screenshot) */}
      <div className="application-stage-tabs">
        {STAGES.map(st => {
          const count = getStageCount(st.key);
          const isSelected = activeTab === st.key;

          return (
            <button
              key={st.key}
              type="button"
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                border: isSelected ? "1px solid #F97316" : "1px solid var(--border-subtle)",
                background: isSelected ? "#F97316" : "var(--bg-card)",
                color: isSelected ? "#FFFFFF" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              onClick={() => setActiveTab(st.key)}
            >
              <span>{st.tabLabel}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: isSelected ? "rgba(255,255,255,0.25)" : "var(--bg-card-subtle)",
                  color: isSelected ? "#FFFFFF" : "var(--text-main)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          VIEW MODE 1: DATA TABLE (MATCHING USER SCREENSHOT COLUMNS & CARDS)
          ========================================================================= */}
      {viewMode === "table" ? (
        <div className="application-table-body">
          <div className="table-wrapper">
            <table className="crm-table application-directory-table">
              <thead>
                <tr>
                  <th>STUDENT CANDIDATE</th>
                  <th>TARGET UNIVERSITY & DESTINATION</th>
                  <th>STUDY PLAN</th>
                  <th>FINANCE</th>
                  <th>STATUS STAGE</th>
                  <th>APPLICATION OFFICER</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <PlaneTakeoff size={32} style={{ opacity: 0.35 }} />
                        <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>No applications found in this view</strong>
                        <span style={{ fontSize: "12px" }}>Submit a new university application dossier or clear filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map(app => {
                    const initials = app.studentName
                      .split(" ")
                      .map(n => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    // Status stage styling
                    let stageBadgeStyle = {
                      background: "rgba(249, 115, 22, 0.12)",
                      color: "#F97316",
                      border: "1px solid rgba(249, 115, 22, 0.25)",
                    };
                    let stageLabel = "Under Review";

                    if (app.stage === "CONDITIONAL_OFFER") {
                      stageBadgeStyle = { background: "rgba(251, 146, 60, 0.15)", color: "#FB923C", border: "1px solid rgba(251, 146, 60, 0.3)" };
                      stageLabel = "Conditional Offer";
                    } else if (app.stage === "UNCONDITIONAL_OFFER") {
                      stageBadgeStyle = { background: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.3)" };
                      stageLabel = "Unconditional Offer";
                    } else if (app.stage === "CAS_ISSUED") {
                      stageBadgeStyle = { background: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "1px solid rgba(139, 92, 246, 0.3)" };
                      stageLabel = "CAS / I-20 Issued";
                    } else if (app.stage === "VISA_LODGED") {
                      stageBadgeStyle = { background: "rgba(99, 102, 241, 0.15)", color: "#6366F1", border: "1px solid rgba(99, 102, 241, 0.3)" };
                      stageLabel = "Visa Lodged";
                    } else if (app.stage === "VISA_APPROVED") {
                      stageBadgeStyle = { background: "rgba(34, 197, 94, 0.15)", color: "#22C55E", border: "1px solid rgba(34, 197, 94, 0.3)" };
                      stageLabel = "Visa Approved";
                    } else if (app.stage === "SUBMITTED") {
                      stageBadgeStyle = { background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.3)" };
                      stageLabel = "Under Review";
                    }

                    return (
                      <tr
                        key={app.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => setActiveDossier(app)}
                      >
                        {/* 1. Student Candidate */}
                        <td>
                          <div className="application-candidate-cell">
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "6px",
                                background: "var(--primary-navy)",
                                color: "#FFFFFF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div className="application-candidate-copy">
                              <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>
                                {app.studentName}
                              </strong>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                {app.studentCode}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Target University & Destination */}
                        <td>
                          <div className="application-university-cell">
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <CountryDisplay country={app.country} size={16}/>
                              <strong style={{ fontSize: "12.5px", color: "var(--text-main)" }}>
                                {app.universityName}
                              </strong>
                            </div>
                            <small>{app.country}</small>
                          </div>
                        </td>

                        {/* 3. Study plan */}
                        <td>
                          <div className="application-study-cell">
                            <strong>{app.course}</strong>
                            <small>{app.intake || "Intake not assigned"}</small>
                          </div>
                        </td>

                        {/* 4. Finance */}
                        <td>
                          <div className="application-finance-cell">
                            <strong style={{ fontSize: "12.5px", color: "var(--text-main)" }}>
                              {app.tuitionFee}
                            </strong>
                            <small>{app.scholarship && app.scholarship !== "None" ? `${app.scholarship} scholarship` : "No scholarship"}</small>
                          </div>
                        </td>

                        {/* 6. Status Stage */}
                        <td>
                          <span
                            style={{
                              ...stageBadgeStyle,
                              fontSize: "11.5px",
                              fontWeight: 600,
                              padding: "4px 10px",
                              borderRadius: "16px",
                              display: "inline-block",
                            }}
                          >
                            {stageLabel}
                          </span>
                        </td>

                        {/* 7. Application Officer */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-main)" }}>
                            <User size={13} style={{ color: "var(--text-muted)" }} />
                            <span>{app.officer}</span>
                          </div>
                        </td>

                        {/* 8. Actions */}
                        <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                          <div className="application-row-actions">
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => setActiveDossier(app)}
                              title="View Application Dossier"
                            >
                              <Eye size={13} />
                            </button>

                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: "4px 10px", fontSize: "11.5px" }}
                              onClick={() => setStageChangeApp(app)}
                              title="Update Admission Stage"
                            >
                              <span>Stage</span>
                              <ChevronRight size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =========================================================================
            VIEW MODE 2: KANBAN PIPELINE BOARD
            ========================================================================= */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", alignItems: "flex-start" }}>
          {STAGES.filter(s => s.key !== "ALL").map(col => {
            const colApps = applications.filter(a => a.stage === col.key);

            return (
              <div
                key={col.key}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  minHeight: "450px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <strong style={{ fontSize: "13px" }}>{col.label}</strong>
                  <span className="nav-badge" style={{ background: "var(--bg-card-subtle)", color: "var(--text-main)" }}>
                    {colApps.length}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                  {colApps.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 10px", color: "var(--text-muted)", fontSize: "11.5px" }}>
                      No dossiers in this stage
                    </div>
                  ) : (
                    colApps.map(app => (
                      <div
                        key={app.id}
                        style={{
                          background: "var(--bg-card-subtle)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          padding: "12px",
                          cursor: "pointer",
                        }}
                        onClick={() => setActiveDossier(app)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "13px" }}>{app.studentName}</strong>
                          <span style={{ fontSize: "10.5px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            {app.studentCode}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-main)", marginBottom: "4px" }}>
                          {app.universityName}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
                          {app.course} · {app.intake}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "6px", borderTop: "1px solid var(--border-subtle)", fontSize: "11px" }}>
                          <span style={{ color: "#10B981", fontWeight: 600 }}>{app.tuitionFee}</span>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "2px 6px", fontSize: "10.5px" }}
                            onClick={e => {
                              e.stopPropagation();
                              setStageChangeApp(app);
                            }}
                          >
                            Advance →
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </section>

      {/* =========================================================================
          MODAL: SUBMIT NEW UNIVERSITY APPLICATION
          ========================================================================= */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="modal-backdrop-clean" onClick={cancelApplicationEdit} style={{ zIndex: 1700 }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean application-modal-professional"
              style={{ maxWidth: "700px" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean application-modal-header">
                <div className="application-modal-heading">
                  <span><PlaneTakeoff size={19}/></span>
                  <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    {editingApplicationId ? "Edit University Application" : "Submit New University Application"}
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {editingApplicationId
                      ? "Update the student, study plan, financial details, deadline, and compliance notes"
                      : "Record formal application lodgement, offer deadlines, and scholarship assessments"}
                  </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={cancelApplicationEdit}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitNewApplication}>
                <div className="application-wizard-progress" aria-label="Application progress">
                  {["Student", "Study plan", "Details"].map((label, index) => <div key={label} className={applicationFormStep === index + 1 ? "active" : applicationFormStep > index + 1 ? "complete" : ""}><span>{applicationFormStep > index + 1 ? <Check size={13}/> : index + 1}</span><strong>{label}</strong></div>)}
                </div>
                <div className="modal-body-clean application-form-modern">
                  {applicationFormStep === 1 && <section className="application-form-section application-wizard-page">
                    <header><span>1</span><div><strong>Choose the applicant</strong><small>Search the live student directory and link this application to the correct CRM profile.</small></div></header>
                    <div className="form-group application-student-field">
                      <label>Registered Student *</label>
                      <StudentSelect students={students} value={newAppForm.studentCode} loading={loading} onChange={selected => setNewAppForm(current => ({ ...current, studentName: selected?.fullName ?? "", studentCode: selected?.code ?? "" }))}/>
                    </div>
                    {selectedApplicationStudent ? <div className="application-selected-student">
                      <span className="application-selected-avatar">{selectedApplicationStudent.fullName.slice(0,1).toUpperCase()}</span>
                      <div><small>SELECTED APPLICANT</small><strong>{selectedApplicationStudent.fullName}</strong><span>{selectedApplicationStudent.code}</span></div>
                      <dl><div><dt>Email</dt><dd>{selectedApplicationStudent.email || "Not recorded"}</dd></div><div><dt>Current plan</dt><dd>{selectedApplicationStudent.targetCountry || "Undecided"} · {selectedApplicationStudent.targetCourse || "Course undecided"}</dd></div></dl>
                      <CheckCircle2 size={19}/>
                    </div> : <div className="application-student-guidance"><Search size={17}/><div><strong>Find the correct student profile</strong><span>Type a name, AECS code, phone number, or email address. No application data is created until the final step.</span></div></div>}
                  </section>}

                  {applicationFormStep === 2 && <section className="application-form-section application-wizard-page">
                    <header><span>2</span><div><strong>Study plan</strong><small>Options are connected to the active Abroad catalogue.</small></div></header>
                  <div className="application-study-flow" aria-label="Study plan selection order">
                    {["Country", "University", "Level", "Course", "Intake"].map((label,index) => {
                      const complete=[newAppForm.country,newAppForm.universityName,newAppForm.studyLevel,newAppForm.course,newAppForm.intake][index];
                      return <span key={label} className={complete ? "complete" : ""}><b>{complete ? <Check size={11}/> : index+1}</b>{label}</span>;
                    })}
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Destination Country *</label>
                      <select required value={newAppForm.country} onChange={event => selectDestination(event.target.value)}>
                        <option value="">Select an active destination</option>
                        {catalogDestinations.map(destination => <option key={destination.code} value={destination.name}>{destination.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Target University *</label>
                      {useUnlistedUniversity ? <input required value={newAppForm.universityName} onChange={event => setNewAppForm(current => ({ ...current, universityName: event.target.value, studyLevel: "", course: "", intake: "" }))} placeholder="Enter the official university name" autoFocus /> : <CatalogCombobox value={newAppForm.universityName} options={universitiesForCountry.map(university => university.name)} disabled={!newAppForm.country} placeholder={newAppForm.country ? "Select a university" : "Select a destination first"} emptyText={`No universities are registered for ${newAppForm.country || "this destination"}.`} onChange={selectUniversity} />}
                      <div className="catalog-field-footer"><small>{useUnlistedUniversity ? "This existing application uses an unlisted university." : `Only universities registered under ${newAppForm.country || "the selected destination"} are shown.`}</small>{editingApplicationId && newAppForm.country && <button type="button" onClick={() => { setUseUnlistedUniversity(current => !current); setNewAppForm(form => ({ ...form, universityName: "", studyLevel: "", course: "", intake: "" })); }}>{useUnlistedUniversity ? "Use catalogue" : "Keep unlisted"}</button>}</div>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Study Level *</label>
                      <CatalogCombobox value={newAppForm.studyLevel} options={STUDY_LEVELS} disabled={!newAppForm.universityName} placeholder={newAppForm.universityName ? "Select study level" : "Select a university first"} emptyText="No study levels are configured." onChange={studyLevel => setNewAppForm(current => ({ ...current, studyLevel, course: "", intake: "" }))}/>
                      <span className="application-field-hint">Includes +2 / Diploma and all qualification levels used in the university catalogue.</span>
                    </div>

                    <div className="form-group">
                      <label>Degree / Course *</label>
                      {useUnlistedCourse ? <input required value={newAppForm.course} onChange={event => setNewAppForm(current => ({ ...current, course: event.target.value, intake: "" }))} placeholder="Enter the official degree or course" autoFocus /> : <CatalogCombobox value={newAppForm.course} options={coursesForSelection} disabled={!newAppForm.studyLevel} placeholder={newAppForm.studyLevel ? "Select a degree or course" : "Select a study level first"} emptyText="No courses match this study level." onChange={course => setNewAppForm(current => ({ ...current, course, intake: "" }))} />}
                      <div className="catalog-field-footer"><small>{useUnlistedCourse ? "This existing application uses an unlisted course." : "Courses are filtered by the selected university and study level."}</small>{editingApplicationId && newAppForm.universityName && <button type="button" onClick={() => { setUseUnlistedCourse(current => !current); setNewAppForm(form => ({ ...form, course: "", intake: "" })); }}>{useUnlistedCourse ? "Use catalogue" : "Keep unlisted"}</button>}</div>
                    </div>
                  </div>

                  <div className="form-group application-intake-field">
                    <label>Intake Cycle *</label>
                    <CatalogCombobox value={newAppForm.intake} options={intakeOptions} disabled={!newAppForm.course} placeholder={newAppForm.course ? "Select an available intake" : "Select a course first"} emptyText="No intake is configured for this course. Add it in the university catalogue." onChange={intake => setNewAppForm(current => ({ ...current, intake }))}/>
                    <span className="application-field-hint">Available intakes are synced from the course, university and destination catalogue.</span>
                  </div>
                  </section>}

                  {applicationFormStep === 3 && <section className="application-form-section application-wizard-page">
                    <header><span>3</span><div><strong>Application details</strong><small>Record financial terms, ownership and submission controls.</small></div></header>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Annual Tuition Fee</label>
                      <input
                        type="text"
                        value={newAppForm.tuitionFee}
                        onChange={e => setNewAppForm({ ...newAppForm, tuitionFee: e.target.value })}
                        placeholder="e.g. £16,500 or A$34,000"
                      />
                    </div>

                    <div className="form-group">
                      <label>Scholarship Award / Note</label>
                      <input
                        type="text"
                        value={newAppForm.scholarship}
                        onChange={e => setNewAppForm({ ...newAppForm, scholarship: e.target.value })}
                        placeholder="e.g. £3,000 Early Bird Grant"
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Initial Application Stage *</label>
                      <select
                        value={newAppForm.stage}
                        onChange={e => setNewAppForm({ ...newAppForm, stage: e.target.value as ApplicationStage })}
                      >
                        <option value="SUBMITTED">Under Review</option>
                        <option value="CONDITIONAL_OFFER">Conditional Offer</option>
                        <option value="UNCONDITIONAL_OFFER">Unconditional Offer</option>
                        <option value="CAS_ISSUED">CAS / I-20 Issued</option>
                        <option value="VISA_LODGED">Visa Lodged</option>
                        <option value="VISA_APPROVED">Visa Approved</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Application Officer</label>
                      <input
                        type="text"
                        readOnly
                        className="application-readonly-field"
                        value={newAppForm.officer || profile?.full_name || "Current signed-in staff"}
                      />
                      <small className="application-field-hint">Assigned automatically to the staff member submitting this application.</small>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Submission / Offer Deadline</label>
                    <input type="date" value={newAppForm.deadline} onChange={e => setNewAppForm({ ...newAppForm, deadline: e.target.value })} />
                    <small className="application-field-hint">Optional when the institution has not published a deadline yet.</small>
                  </div>

                  <div className="form-group">
                    <label>Application Notes & Special Requirements</label>
                    <textarea
                      rows={3}
                      value={newAppForm.notes}
                      onChange={e => setNewAppForm({ ...newAppForm, notes: e.target.value })}
                      placeholder="Include portal credentials, pending documents, or condition remarks…"
                    />
                  </div>
                  <label className="application-review-confirmation">
                    <input type="checkbox" checked={applicationReviewConfirmed} onChange={event => setApplicationReviewConfirmed(event.target.checked)} />
                    <span><strong>I have reviewed this application</strong><small>Confirm the student, study plan, financial details and application stage are correct.</small></span>
                  </label>
                  </section>}
                </div>

                <div className="modal-footer-clean">
                  {applicationFormError && <div className="form-error" style={{ marginRight: "auto" }}>{applicationFormError}</div>}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => applicationFormStep === 1 ? cancelApplicationEdit() : setApplicationFormStep((applicationFormStep - 1) as 1 | 2)}
                    disabled={savingApplication}
                  >
                    {applicationFormStep === 1 ? "Cancel" : "Back"}
                  </button>
                  {applicationFormStep < 3 ? <button
                    type="button"
                    className="btn-primary"
                    disabled={applicationFormStep === 1 ? !newAppForm.studentCode : !newAppForm.country || !newAppForm.universityName.trim() || !newAppForm.studyLevel || !newAppForm.course.trim() || !newAppForm.intake}
                    onClick={() => { setApplicationReviewConfirmed(false); setApplicationFormStep((applicationFormStep + 1) as 2 | 3); }}
                  >
                    <span>Continue</span><ChevronRight size={15}/>
                  </button> : <button
                    type="submit"
                    data-application-submit="true"
                    className="btn-primary"
                    style={{ background: "#F97316", borderColor: "#F97316" }}
                    disabled={savingApplication || !applicationReviewConfirmed}
                  >
                    <PlaneTakeoff size={15} />
                    <span>{savingApplication ? "Saving…" : editingApplicationId ? "Save Application" : "Submit Application"}</span>
                  </button>}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL: QUICK STAGE ADVANCEMENT
          ========================================================================= */}
      <AnimatePresence>
        {stageChangeApp && (
          <div className="modal-backdrop-clean" onClick={() => setStageChangeApp(null)} style={{ zIndex: 1600 }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean"
              style={{ maxWidth: "480px" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean">
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    Advance Admission Stage
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {stageChangeApp.studentName} · {stageChangeApp.universityName}
                  </p>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setStageChangeApp(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body-clean">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {STAGES.filter(s => s.key !== "ALL").map(st => {
                    const isCurrent = stageChangeApp.stage === st.key;

                    return (
                      <button
                        key={st.key}
                        type="button"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 14px",
                          borderRadius: "var(--radius-sm)",
                          border: isCurrent ? "2px solid #F97316" : "1px solid var(--border-subtle)",
                          background: isCurrent ? "rgba(249, 115, 22, 0.08)" : "var(--bg-card)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onClick={() => handleUpdateStage(st.key as ApplicationStage)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "13px", fontWeight: isCurrent ? 700 : 500, color: "var(--text-main)" }}>
                            {st.label}
                          </span>
                        </div>
                        {isCurrent && <Check size={16} style={{ color: "#F97316" }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          DRAWER: APPLICATION DOSSIER SLIDE-OVER
          ========================================================================= */}
      <AnimatePresence>
        {activeDossier && (
          <div className="modal-backdrop-clean" onClick={() => setActiveDossier(null)}>
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: "min(560px, 100vw)",
                background: "var(--bg-card)",
                borderLeft: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow-xl)",
                zIndex: 1500,
                display: "flex",
                flexDirection: "column",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                style={{
                  padding: "18px 22px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-card-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "6px",
                      background: "var(--primary-navy)",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "12px",
                    }}
                  >
                    {studentPhotoUrl ? <img src={studentPhotoUrl} alt={`${activeDossier.studentName} profile`} className="application-student-photo"/> : <CountryDisplay country={activeDossier.country} size={18}/>} 
                  </div>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                      {activeDossier.studentName}
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {activeDossier.studentCode} · {activeDossier.universityName}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button type="button" className="btn-secondary" style={{ padding: "7px 11px", fontSize: "12px" }} onClick={() => openApplicationEdit(activeDossier)}>
                    <Pencil size={14}/><span>Edit application</span>
                  </button>
                  <button type="button" className="drawer-close-btn" onClick={() => setActiveDossier(null)}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div style={{ padding: "22px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <section className="application-dossier-vault">
                  <header>
                    <div>
                      <span>Student identity & files</span>
                      <strong>Application document vault</strong>
                      <small>Uploads here remain available in the central CRM Document Vault.</small>
                    </div>
                    <ShieldCheck size={20}/>
                  </header>
                  <div className="application-dossier-upload-actions">
                    <label className="btn-secondary">
                      <ImagePlus size={15}/><span>{studentPhotoUrl ? "Replace photo" : "Upload photo"}</span>
                      <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" disabled={dossierFilesBusy} onChange={event => { const file=event.target.files?.[0]; event.currentTarget.value=""; void uploadDossierPhoto(file); }}/>
                    </label>
                    <label className="btn-primary">
                      <UploadCloud size={15}/><span>{dossierFilesBusy ? "Uploading…" : "Upload documents"}</span>
                      <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={dossierFilesBusy} onChange={event => { const files=Array.from(event.target.files??[]); event.currentTarget.value=""; void uploadDossierDocuments(files); }}/>
                    </label>
                    <button type="button" className="btn-secondary" onClick={()=>navigate("/documents")}><FileText size={15}/><span>Open vault</span></button>
                  </div>
                  {dossierDocuments.filter(document=>!document.fileName.startsWith("Student profile photo")).length > 0 ? <div className="application-dossier-files">
                    {dossierDocuments.filter(document=>!document.fileName.startsWith("Student profile photo")).slice(0,4).map(document=><article key={document.id}>
                      <FileText size={17}/><div><strong>{document.fileName}</strong><span>{document.category} · {document.fileSize} · {document.status.replace("_"," ")}</span></div>
                      <button type="button" title="Secure preview" onClick={()=>void openDossierDocument(document)}><Eye size={14}/></button>
                      <button type="button" title="Download" onClick={()=>void openDossierDocument(document,true)}><Download size={14}/></button>
                    </article>)}
                    {dossierDocuments.filter(document=>!document.fileName.startsWith("Student profile photo")).length>4&&<button type="button" className="application-vault-more" onClick={()=>navigate("/documents")}>View all {dossierDocuments.filter(document=>!document.fileName.startsWith("Student profile photo")).length} documents</button>}
                  </div> : <div className="application-dossier-empty"><FileText size={17}/><span>No application documents uploaded yet.</span></div>}
                </section>

                <div
                  style={{
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    fontSize: "12.5px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Degree / Course:</span>
                    <strong>{activeDossier.course}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Intake:</span>
                    <strong>{activeDossier.intake}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Destination Country:</span>
                    <strong><CountryDisplay country={activeDossier.country}/></strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Tuition Fee:</span>
                    <strong>{activeDossier.tuitionFee}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Scholarship:</span>
                    <strong style={{ color: "#10B981" }}>{activeDossier.scholarship}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Officer:</span>
                    <strong>{activeDossier.officer}</strong>
                  </div>
                </div>

                <div>
                  <strong style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}>
                    Application Notes & Compliance Details
                  </strong>
                  <p style={{ fontSize: "12.5px", lineHeight: 1.6, background: "var(--bg-card-subtle)", padding: "12px", borderRadius: "4px", border: "1px solid var(--border-subtle)", margin: 0 }}>
                    {activeDossier.notes || "No special remarks recorded for this application."}
                  </p>
                </div>

                <div style={{ marginTop: "auto", display: "flex", gap: "10px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1, background: "#F97316", borderColor: "#F97316" }}
                    onClick={() => {
                      setStageChangeApp(activeDossier);
                    }}
                  >
                    <ChevronRight size={15} />
                    <span>Advance Application Stage</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ApplicationWorkspace;
