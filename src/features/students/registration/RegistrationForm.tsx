import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  GraduationCap,
  Globe,
  Lock,
  Mail,
  MapPin,
  Phone,
  PlaneTakeoff,
  RotateCcw,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StudentService } from "../../../services/studentService";
import { PhoneInput } from "../../../components/ui/PhoneInput";
import { CountrySelect } from "../../../components/ui/CountrySelect";
import { IntakePicker } from "../../../components/ui/IntakePicker";
import { AECS_AUTHORIZED_COUNTRIES } from "../../../lib/destinationsData";
import { CountryDisplay } from "../../../components/ui/CountryDisplay";

const REGISTRATION_STEPS = [
  { step: 1, title: "Personal Details", sub: "Identity & Contact", icon: User },
  { step: 2, title: "Academic Background", sub: "Qualifications & GPA", icon: GraduationCap },
  { step: 3, title: "Study Preferences", sub: "Country, Course & Intake", icon: Globe },
  { step: 4, title: "English Proficiency", sub: "IELTS / PTE / DET", icon: Award },
  { step: 5, title: "Passport & Travel", sub: "Travel history & validity", icon: PlaneTakeoff },
  { step: 6, title: "Review & Submit", sub: "Summary & Verification", icon: CheckCircle2 },
];

export function RegistrationForm() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdStudent, setCreatedStudent] = useState<{ id: string; code: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Personal
    fullName: "",
    gender: "" as "Male" | "Female" | "Other",
    dob: "",
    phone: "",
    email: "",
    address: "",
    guardianName: "",
    guardianPhone: "",

    // Step 2: Academic
    highestQualification: "",
    institutionName: "",
    boardUniversity: "",
    passedYear: "",
    gpaOrPercentage: "",
    studyGapYears: "",
    gapExplanation: "",

    // Step 3: Study Preferences
    targetCountry: "",
    secondCountry: "",
    targetDegree: "",
    targetCourse: "",
    targetIntake: "",
    budgetNpr: "",
    counsellor: "",

    // Step 4: English Proficiency
    testStatus: "None" as "Taken" | "Booked" | "Preparing" | "None",
    testType: "",
    overallScore: "",
    listening: "",
    reading: "",
    writing: "",
    speaking: "",
    trfNumber: "",

    // Step 5: Passport & Travel History
    hasPassport: false,
    passportNumber: "",
    passportExpiry: "",
    hasVisaRefusal: false,
    refusalDetails: "",

    // Step 6: Referral & Initial Note
    leadSource: "",
    counsellorNotes: "",
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    setErrorMessage("");
    if (currentStep === 1) {
      if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
        setErrorMessage("Please fill in all required personal contact details (*)");
        return;
      }
    }
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMessage("");
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const created = await StudentService.createStudent({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        dob: formData.dob,
        gender: formData.gender,
        address: formData.address,
        targetCountry: formData.targetCountry,
        targetCourse: formData.targetCourse,
        targetIntake: formData.targetIntake,
        budget: formData.budgetNpr,
        counsellor: formData.counsellor,
        secondCountry: formData.secondCountry,
        highestQualification: formData.highestQualification,
        academicStatus: formData.institutionName,
        latestResult: formData.gpaOrPercentage,
        studyGap: formData.studyGapYears,
        employmentStatus: formData.gapExplanation,
        testTaken: formData.testStatus === "Taken",
        testType: formData.testType,
        testScore: formData.overallScore,
        hasPassport: formData.hasPassport,
        leadSource: formData.leadSource,
        message: formData.counsellorNotes,
        status: "NEW_LEAD",
      });

      setCreatedStudent({
        id: created.id,
        code: created.code,
        name: created.fullName,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to register student record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (createdStudent?.code) {
      navigator.clipboard.writeText(createdStudent.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (createdStudent) {
    return (
      <div className="page-container" style={{ maxWidth: "680px", margin: "40px auto" }}>
        <div className="crm-panel" style={{ textAlign: "center", padding: "40px 32px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "var(--success-soft)",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <span className="page-category-eyebrow" style={{ color: "var(--success)" }}>
            Registration Complete
          </span>
          <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "6px 0 10px" }}>
            Student Registered Successfully
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "480px", margin: "0 auto 24px" }}>
            Official student dossier and multi-table records have been created in the AECS Bagbazar operations database.
          </p>

          <div
            style={{
              background: "var(--bg-card-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              maxWidth: "420px",
              margin: "0 auto 28px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)" }}>
              Official Student Identifier
            </span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span className="code-font" style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent-blue)" }}>
                {createdStudent.code}
              </span>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "4px 8px", fontSize: "11px" }}
                onClick={handleCopyCode}
              >
                {copied ? <Check size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: 600 }}>
              {createdStudent.name}
            </span>
            <span className="status-pill" style={{ alignSelf: "center", marginTop: "4px" }}>
              Initial Stage: New Lead / In Counselling
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCreatedStudent(null);
                setCurrentStep(1);
              }}
            >
              <RotateCcw size={15} />
              <span>Register Another Student</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate("/students")}
            >
              <Users size={15} />
              <span>Open Student Directory</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container student-registration-page">
      {/* Header */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Student Registration</h2>
          <p>
            Build a complete student profile for counselling, applications, and admission processing.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/students")}
          >
            <ArrowLeft size={15} />
            <span>Cancel & Return</span>
          </button>
        </div>
      </div>

      {/* Stepper Strip */}
      <div className="crm-panel student-registration-progress">
        <div className="student-registration-progress-heading">
          <div>
            <span>Registration progress</span>
            <strong>Step {currentStep} of {REGISTRATION_STEPS.length}</strong>
          </div>
          <b>{Math.round((currentStep / REGISTRATION_STEPS.length) * 100)}%</b>
        </div>
        <div className="student-registration-progress-bar" aria-hidden="true">
          <span style={{ width: `${(currentStep / REGISTRATION_STEPS.length) * 100}%` }} />
        </div>
        <div className="student-registration-steps">
        {REGISTRATION_STEPS.map(s => {
          const Icon = s.icon;
          const isActive = s.step === currentStep;
          const isDone = s.step < currentStep;

          return (
            <button
              type="button"
              key={s.step}
              className={`student-registration-step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
              disabled={!isDone}
              onClick={() => {
                if (isDone) setCurrentStep(s.step);
              }}
            >
              <div className="student-registration-step-icon">
                {isDone ? <Check size={16} /> : <Icon size={16} />}
              </div>
              <div>
                <span>Step {s.step}</span>
                <strong>{s.title}</strong>
              </div>
            </button>
          );
        })}
        </div>
      </div>

      {/* Main Step Body Card */}
      <div className="crm-panel student-registration-card">
        <div className="panel-header-bar student-registration-card-header">
          <div>
            <span className="student-registration-section-label">Step {currentStep}</span>
            <h3>{REGISTRATION_STEPS[currentStep - 1].title}</h3>
            <p>{REGISTRATION_STEPS[currentStep - 1].sub}</p>
          </div>
          <div className="student-registration-current-icon">
            {(() => {
              const ActiveIcon = REGISTRATION_STEPS[currentStep - 1].icon;
              return <ActiveIcon size={22} />;
            })()}
          </div>
        </div>

        <div className="panel-body student-registration-fields">
          {/* STEP 1: PERSONAL & CONTACT */}
          {currentStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Full Legal Name (as per Passport) *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={e => handleChange("fullName", e.target.value)}
                    placeholder="e.g. Riya Sharma"
                  />
                </div>
                <div className="form-group">
                  <label>Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={e => handleChange("gender", e.target.value)}
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={formData.dob}
                    onChange={e => handleChange("dob", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => handleChange("email", e.target.value)}
                    placeholder="student@example.com"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>WhatsApp / Mobile Number *</label>
                  <PhoneInput
                    required
                    value={formData.phone}
                    onChange={val => handleChange("phone", val)}
                  />
                </div>
                <div className="form-group">
                  <label>Current Residential Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => handleChange("address", e.target.value)}
                    placeholder="e.g. New Baneshwor, Kathmandu"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Guardian / Parent Name</label>
                  <input
                    type="text"
                    value={formData.guardianName}
                    onChange={e => handleChange("guardianName", e.target.value)}
                    placeholder="e.g. Hari Prasad Sharma"
                  />
                </div>
                <div className="form-group">
                  <label>Guardian Contact Number</label>
                  <input
                    type="tel"
                    value={formData.guardianPhone}
                    onChange={e => handleChange("guardianPhone", e.target.value)}
                    placeholder="+977 98XXXXXXXX"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ACADEMIC BACKGROUND */}
          {currentStep === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Highest Qualification Completed *</label>
                  <select
                    value={formData.highestQualification}
                    onChange={e => handleChange("highestQualification", e.target.value)}
                  >
                    <option value="+2 / Higher Secondary (NEB)">+2 / Higher Secondary (NEB)</option>
                    <option value="A-Levels (Cambridge)">A-Levels (Cambridge)</option>
                    <option value="Bachelor's Degree">Bachelor's Degree</option>
                    <option value="Master's Degree">Master's Degree</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Board / University Name *</label>
                  <input
                    type="text"
                    value={formData.boardUniversity}
                    onChange={e => handleChange("boardUniversity", e.target.value)}
                    placeholder="e.g. Tribhuvan University, Kathmandu University, NEB"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>College / School Name</label>
                  <input
                    type="text"
                    value={formData.institutionName}
                    onChange={e => handleChange("institutionName", e.target.value)}
                    placeholder="e.g. St. Xavier's College, Apex College"
                  />
                </div>
                <div className="form-group">
                  <label>Passing Year *</label>
                  <input
                    type="text"
                    value={formData.passedYear}
                    onChange={e => handleChange("passedYear", e.target.value)}
                    placeholder="e.g. 2025"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Aggregate GPA / Percentage *</label>
                  <input
                    type="text"
                    value={formData.gpaOrPercentage}
                    onChange={e => handleChange("gpaOrPercentage", e.target.value)}
                    placeholder="e.g. 3.45 CGPA or 76.5%"
                  />
                </div>
                <div className="form-group">
                  <label>Study Gap (if any)</label>
                  <select
                    value={formData.studyGapYears}
                    onChange={e => handleChange("studyGapYears", e.target.value)}
                  >
                    <option value="None">No Gap (Fresher)</option>
                    <option value="1 Year">1 Year</option>
                    <option value="2 Years">2 Years</option>
                    <option value="3+ Years">3+ Years</option>
                  </select>
                </div>
              </div>

              {formData.studyGapYears !== "None" && (
                <div className="form-group">
                  <label>Gap Justification / Work Experience</label>
                  <textarea
                    value={formData.gapExplanation}
                    onChange={e => handleChange("gapExplanation", e.target.value)}
                    placeholder="Briefly state work experience or internship during the gap period…"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: STUDY PREFERENCES */}
          {currentStep === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Primary Destination Country *</label>
                  <CountrySelect
                    required
                    value={formData.targetCountry}
                    onChange={country => handleChange("targetCountry", country)}
                  />
                </div>
                <div className="form-group">
                  <label>Secondary Choice Destination</label>
                  <CountrySelect
                    value={formData.secondCountry}
                    onChange={country => handleChange("secondCountry", country)}
                    placeholder="Optional secondary country"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Target Degree Level *</label>
                  <select
                    value={formData.targetDegree}
                    onChange={e => handleChange("targetDegree", e.target.value)}
                  >
                    <option value="Bachelor's Degree (Undergraduate)">Bachelor's Degree (Undergraduate)</option>
                    <option value="Master's Degree (Postgraduate)">Master's Degree (Postgraduate)</option>
                    <option value="Post Graduate Diploma / Diploma">Post Graduate Diploma / Diploma</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Target Intake Cycle *</label>
                  <IntakePicker
                    required
                    value={formData.targetIntake}
                    onChange={intake => handleChange("targetIntake", intake)}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Preferred Course / Major *</label>
                  <input
                    type="text"
                    required
                    value={formData.targetCourse}
                    onChange={e => handleChange("targetCourse", e.target.value)}
                    placeholder="e.g. Master of Science in Data Science"
                  />
                </div>
                <div className="form-group">
                  <label>Estimated Annual Budget *</label>
                  <input
                    type="text"
                    value={formData.budgetNpr}
                    onChange={e => handleChange("budgetNpr", e.target.value)}
                    placeholder="e.g. NPR 25-35 Lakhs / year"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ENGLISH PROFICIENCY */}
          {currentStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>English Language Proficiency Status *</label>
                  <select
                    value={formData.testStatus}
                    onChange={e => handleChange("testStatus", e.target.value)}
                  >
                    <option value="Taken">Test Already Taken (Score Available)</option>
                    <option value="Booked">Test Date Booked</option>
                    <option value="Preparing">Preparing / Enrolled in AECS Batch</option>
                    <option value="None">Not Taken Yet</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Test Type</label>
                  <select
                    value={formData.testType}
                    onChange={e => handleChange("testType", e.target.value)}
                  >
                    <option value="IELTS Academic">IELTS Academic</option>
                    <option value="PTE Academic">PTE Academic</option>
                    <option value="Duolingo">Duolingo English Test (DET)</option>
                    <option value="TOEFL iBT">TOEFL iBT</option>
                    <option value="German Language (A1/A2)">German Language (A1/A2)</option>
                  </select>
                </div>
              </div>

              {formData.testStatus === "Taken" && (
                <div>
                  <div className="form-group" style={{ marginBottom: "14px" }}>
                    <label>Overall Score *</label>
                    <input
                      type="text"
                      value={formData.overallScore}
                      onChange={e => handleChange("overallScore", e.target.value)}
                      placeholder="e.g. 7.0 or 68"
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                    <div className="form-group">
                      <label>Listening</label>
                      <input
                        type="text"
                        value={formData.listening}
                        onChange={e => handleChange("listening", e.target.value)}
                        placeholder="7.5"
                      />
                    </div>
                    <div className="form-group">
                      <label>Reading</label>
                      <input
                        type="text"
                        value={formData.reading}
                        onChange={e => handleChange("reading", e.target.value)}
                        placeholder="7.0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Writing</label>
                      <input
                        type="text"
                        value={formData.writing}
                        onChange={e => handleChange("writing", e.target.value)}
                        placeholder="6.5"
                      />
                    </div>
                    <div className="form-group">
                      <label>Speaking</label>
                      <input
                        type="text"
                        value={formData.speaking}
                        onChange={e => handleChange("speaking", e.target.value)}
                        placeholder="7.0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: PASSPORT & TRAVEL HISTORY */}
          {currentStep === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Do you have a valid passport? *</label>
                  <select
                    value={formData.hasPassport ? "yes" : "no"}
                    onChange={e => handleChange("hasPassport", e.target.value === "yes")}
                  >
                    <option value="yes">Yes, I hold a valid passport</option>
                    <option value="no">No, currently under application</option>
                  </select>
                </div>
                {formData.hasPassport && (
                  <div className="form-group">
                    <label>Passport Number</label>
                    <input
                      type="text"
                      value={formData.passportNumber}
                      onChange={e => handleChange("passportNumber", e.target.value)}
                      placeholder="e.g. 11987654"
                    />
                  </div>
                )}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Prior Visa Refusal (Any Country)? *</label>
                  <select
                    value={formData.hasVisaRefusal ? "yes" : "no"}
                    onChange={e => handleChange("hasVisaRefusal", e.target.value === "yes")}
                  >
                    <option value="no">No, Clean Visa History</option>
                    <option value="yes">Yes, Have Prior Refusal</option>
                  </select>
                </div>
                {formData.hasVisaRefusal && (
                  <div className="form-group">
                    <label>Refusal Country & Reason</label>
                    <input
                      type="text"
                      value={formData.refusalDetails}
                      onChange={e => handleChange("refusalDetails", e.target.value)}
                      placeholder="e.g. Australia 2024 - Financial documentation clause"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: REVIEW & VERIFICATION */}
          {currentStep === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div
                style={{
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "18px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                }}
              >
                <div>
                  <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Student Name
                  </span>
                  <strong>{formData.fullName || "—"}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Contact
                  </span>
                  <span>{formData.email} · {formData.phone}</span>
                </div>
                <div>
                  <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Target Destination
                  </span>
                  <strong><CountryDisplay country={formData.targetCountry}/> ({formData.targetIntake})</strong>
                </div>
                <div>
                  <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Selected Course
                  </span>
                  <span>{formData.targetCourse}</span>
                </div>
                <div>
                  <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Academic Qualification
                  </span>
                  <span>{formData.highestQualification} ({formData.gpaOrPercentage})</span>
                </div>
                <div>
                  <span style={{ fontSize: "10.5px", textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    English Test Score
                  </span>
                  <span>{formData.testType}: Overall {formData.overallScore}</span>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Lead / Referral Source *</label>
                  <select
                    value={formData.leadSource}
                    onChange={e => handleChange("leadSource", e.target.value)}
                  >
                    <option value="Direct Walk-in">Direct Walk-in</option>
                    <option value="Friend Referral">Friend / Alumni Referral</option>
                    <option value="Meta Ads (Facebook/Instagram)">Meta Ads (Facebook/Instagram)</option>
                    <option value="Education Fair">Education Fair / Seminar</option>
                    <option value="Website Online Intake">Website Online Intake</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Assigned Lead Counsellor *</label>
                  <select
                    value={formData.counsellor}
                    onChange={e => handleChange("counsellor", e.target.value)}
                  >
                    <option value="Unassigned">Unassigned</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Initial Counselling Note / Intake Remarks</label>
                <textarea
                  value={formData.counsellorNotes}
                  onChange={e => handleChange("counsellorNotes", e.target.value)}
                  placeholder="Enter initial counseling guidance remarks…"
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div
              style={{
                marginTop: "16px",
                padding: "10px 14px",
                background: "var(--danger-soft)",
                color: "var(--danger-text)",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="modal-footer-clean student-registration-footer">
          <button
            type="button"
            className="btn-secondary"
            disabled={currentStep === 1}
            onClick={handleBack}
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>

          {currentStep < 6 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleNext}
            >
              <span>Next</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              <UserPlus size={15} />
              <span>{isSubmitting ? "Creating Student Dossier…" : "Complete & Register Student"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegistrationForm;
