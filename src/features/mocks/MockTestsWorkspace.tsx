import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Edit,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Info,
  Laptop,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MockTestResult, MockTestService, MockTestSlot } from "../../services/mockTestService";
import { ClassStudent, ClassStudentService } from "../../services/classStudentService";
import { useAuth } from "../auth/AuthProvider";

export function MockTestsWorkspace() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"results" | "slots" | "analytics">("results");
  const [results, setResults] = useState<MockTestResult[]>([]);
  const [slots, setSlots] = useState<MockTestSlot[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [testTypeFilter, setTestTypeFilter] = useState("ALL");

  // Modals
  const [showAddResultModal, setShowAddResultModal] = useState(false);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [activeResultDetail, setActiveResultDetail] = useState<MockTestResult | null>(null);
  const [bookingSlot,setBookingSlot]=useState<MockTestSlot|null>(null);
  const [bookingStudentId,setBookingStudentId]=useState("");
  const [bookingCandidateType,setBookingCandidateType]=useState<"INTERNAL"|"EXTERNAL">("INTERNAL");
  const [bookingExternal,setBookingExternal]=useState({name:"",phone:"",email:""});
  const [editingResultId,setEditingResultId]=useState<string|null>(null);

  // Score Entry Form
  const [scoreForm, setScoreForm] = useState({
    candidateType: "INTERNAL" as "INTERNAL"|"EXTERNAL",
    studentName: "",
    studentCode: "",
    phone: "",
    email: "",
    testType: "IELTS Academic" as MockTestResult["testType"],
    testDate: new Date().toISOString().split("T")[0],
    venue: "",
    examiner: "",
    listening: "",
    reading: "",
    writing: "",
    speaking: "",
    overallScore: "",
    status: "Score Issued" as MockTestResult["status"],
    examinerFeedback: "",
    targetAchieved: false,
  });

  // Slot Entry Form
  const [slotForm, setSlotForm] = useState({
    title: "",
    testType: "IELTS Academic" as MockTestSlot["testType"],
    date: "",
    time: "",
    room: "",
    invigilator: "",
    totalSeats: 0,
    bookedSeats: 0,
    status: "OPEN" as MockTestSlot["status"],
  });

  const loadData = async () => {
    const [resData, slotData, studentData] = await Promise.all([
      MockTestService.getResults(),
      MockTestService.getSlots(),
      ClassStudentService.getStudents(),
    ]);
    setResults(resData);
    setSlots(slotData);
    setClassStudents(studentData);
  };

  useEffect(() => {
    void loadData().catch(error=>setFormError(error instanceof Error?error.message:"Unable to load mock-test workspace."));
  }, []);

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      if (testTypeFilter !== "ALL" && r.testType !== testTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          r.studentName.toLowerCase().includes(q) ||
          r.studentCode.toLowerCase().includes(q) ||
          r.testCode.toLowerCase().includes(q) ||
          r.overallScore.toLowerCase().includes(q) ||
          r.examiner.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [results, testTypeFilter, searchQuery]);

  // Handle Score Submit
  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((scoreForm.candidateType==="INTERNAL"&&!scoreForm.studentCode)||(scoreForm.candidateType==="EXTERNAL"&&!scoreForm.studentName.trim()) || !scoreForm.testDate || !scoreForm.overallScore.trim() || !scoreForm.examiner.trim() || !scoreForm.venue.trim() || !scoreForm.examinerFeedback.trim() || !scoreForm.listening || !scoreForm.reading || !scoreForm.writing || !scoreForm.speaking) { setFormError("Select or enter a candidate and complete all required evaluation fields."); return; }
    setSaving(true); setFormError("");
    try { const resultPayload={
      candidateType: scoreForm.candidateType,
      studentName: scoreForm.studentName.trim(),
      studentCode: scoreForm.studentCode.trim(),
      phone:scoreForm.phone.trim(),email:scoreForm.email.trim(),
      testType: scoreForm.testType,
      testDate: scoreForm.testDate,
      venue: scoreForm.venue.trim(),
      examiner: scoreForm.examiner.trim(),
      listening: scoreForm.listening,
      reading: scoreForm.reading,
      writing: scoreForm.writing,
      speaking: scoreForm.speaking,
      overallScore: scoreForm.overallScore.trim(),
      status: scoreForm.status,
      examinerFeedback: scoreForm.examinerFeedback.trim(),
      targetAchieved: scoreForm.targetAchieved,
    }; if(editingResultId) await MockTestService.updateResult(editingResultId,resultPayload); else await MockTestService.createResult(resultPayload);

    await loadData();
    setShowAddResultModal(false); setEditingResultId(null); setSuccessMessage(editingResultId?"Mock-test evaluation updated successfully.":"Mock-test evaluation recorded successfully.");
    setScoreForm({
      candidateType:"INTERNAL",
      studentName: "",
      studentCode: "",
      phone:"",email:"",
      testType: "IELTS Academic",
      testDate: new Date().toISOString().split("T")[0],
      venue: "",
      examiner: "",
      listening: "",
      reading: "",
      writing: "",
      speaking: "",
      overallScore: "",
      status: "Score Issued",
      examinerFeedback: "",
      targetAchieved: false,
    }); } catch(error) { setFormError(error instanceof Error ? error.message : "Unable to save this mock-test evaluation."); }
    finally { setSaving(false); }
  };

  const handleBookCandidate=async(event:React.FormEvent)=>{event.preventDefault();if(!bookingSlot||(bookingCandidateType==="INTERNAL"&&!bookingStudentId)||(bookingCandidateType==="EXTERNAL"&&!bookingExternal.name.trim())){setFormError("Select an internal student or enter the external candidate name.");return}setSaving(true);setFormError("");try{await MockTestService.bookCandidate(bookingSlot.id,{type:bookingCandidateType,classStudentId:bookingStudentId,name:bookingExternal.name.trim(),phone:bookingExternal.phone.trim(),email:bookingExternal.email.trim()});await loadData();setBookingSlot(null);setBookingStudentId("");setBookingExternal({name:"",phone:"",email:""});setSuccessMessage("Candidate staged in the mock-test session successfully.")}catch(error){setFormError(error instanceof Error?error.message:"Unable to book candidate")}finally{setSaving(false)}};

  const openNewResult=()=>{setEditingResultId(null);setFormError("");setShowAddResultModal(true)};
  const openEditResult=(result:MockTestResult)=>{setEditingResultId(result.id);setActiveResultDetail(null);setFormError("");setScoreForm({candidateType:result.candidateType,studentName:result.studentName,studentCode:result.studentCode==="External walk-in"?"":result.studentCode,phone:result.phone??"",email:result.email??"",testType:result.testType,testDate:result.testDate,venue:result.venue,examiner:result.examiner,listening:String(result.listening),reading:String(result.reading),writing:String(result.writing),speaking:String(result.speaking),overallScore:result.overallScore,status:result.status,examinerFeedback:result.examinerFeedback,targetAchieved:result.targetAchieved});setShowAddResultModal(true)};

  // Handle Slot Submit
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotForm.title.trim() || !slotForm.date || !slotForm.time || !slotForm.room.trim() || !slotForm.invigilator.trim()) { setFormError("Title, date, time, venue and invigilator are required."); return; }
    setSaving(true); setFormError("");
    try { await MockTestService.createSlot({
      title: slotForm.title.trim(),
      testType: slotForm.testType,
      date: slotForm.date.trim(),
      time: slotForm.time.trim(),
      room: slotForm.room.trim(),
      invigilator: slotForm.invigilator.trim(),
      totalSeats: Number(slotForm.totalSeats) || 20,
      bookedSeats: 0,
      status: "OPEN",
    });

    await loadData();
    setShowAddSlotModal(false); setSuccessMessage("Mock-test session scheduled successfully.");
    setSlotForm({title:"",testType:"IELTS Academic",date:"",time:"",room:"",invigilator:"",totalSeats:0,bookedSeats:0,status:"OPEN"});
    } catch(error) { setFormError(error instanceof Error ? error.message : "Unable to schedule this mock-test session."); }
    finally { setSaving(false); }
  };

  // Metrics
  const totalMocks = results.length;
  const examReadyCount = results.filter(r => r.targetAchieved).length;
  const upcomingSlots = slots.filter(slot => slot.status === "OPEN").length;
  const readinessRate = totalMocks ? Math.round((examReadyCount / totalMocks) * 100) : 0;
  const averageScore = totalMocks ? (results.reduce((sum, result) => sum + (Number.parseFloat(result.overallScore) || 0), 0) / totalMocks).toFixed(1) : "—";

  return (
    <div className="page-container mock-tests-workspace">
      {/* 1. Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Mock Tests & Evaluation Suite</h2>
          <p>
            Schedule full-length examination simulations, evaluate sectional band scores, and issue diagnostic report cards.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="btn-primary"
            style={{ background: "#0F172A", borderColor: "#0F172A", color: "#FFFFFF" }}
            onClick={openNewResult}
          >
            <Plus size={15} />
            <span>Log Mock Test Scores</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowAddSlotModal(true)}
          >
            <Calendar size={15} />
            <span>Stage & Schedule Mock</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/classes")}
          >
            <BookOpen size={15} />
            <span>← Classes Workspace</span>
          </button>
        </div>
      </div>
      {formError&&<div className="phase2-alert phase2-alert-error"><AlertCircle size={16}/>{formError}<button type="button" onClick={()=>setFormError("")}><X size={14}/></button></div>}
      {successMessage&&<div className="classes-success"><Check size={16}/><span>{successMessage}</span><button type="button" onClick={()=>setSuccessMessage("")}><X size={14}/></button></div>}

      {/* 2. Top 4 Metric Strip */}
      <div className="metrics-grid-4" style={{ marginBottom: "20px" }}>
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Tests Evaluated</span>
            <div className="metric-icon-wrap blue">
              <Award size={17} />
            </div>
          </div>
          <div className="metric-value">{totalMocks} Scorecards</div>
          <span className="metric-sub">IELTS, PTE & Duolingo mocks</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Average Recorded Score</span>
            <div className="metric-icon-wrap green">
              <Sparkles size={17} />
            </div>
          </div>
          <div className="metric-value">{averageScore}</div>
          <span className="metric-sub">Across issued evaluations</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Upcoming Sessions</span>
            <div className="metric-icon-wrap purple">
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="metric-value">{upcomingSlots}</div>
          <span className="metric-sub">Open scheduled mock slots</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Exam Ready</span>
            <div className="metric-icon-wrap amber">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="metric-value">{readinessRate}%</div>
          <span className="metric-sub">{examReadyCount} of {totalMocks} evaluations cleared</span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="document-tabs">
        <button
          type="button"
          className={activeTab === "results" ? "active" : ""}
          onClick={() => setActiveTab("results")}
        >
          <Award size={15} />
          <span>Mock Results Ledger ({results.length})</span>
        </button>

        <button
          type="button"
          className={activeTab === "slots" ? "active" : ""}
          onClick={() => setActiveTab("slots")}
        >
          <CalendarClock size={15} />
          <span>Scheduled Mock Exam Slots ({slots.length})</span>
        </button>

        <button
          type="button"
          className={activeTab === "analytics" ? "active" : ""}
          onClick={() => setActiveTab("analytics")}
        >
          <Target size={15} />
          <span>Diagnostic Readiness Tracker</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: RESULTS LEDGER
          ========================================================================= */}
      {activeTab === "results" && (
        <div className="crm-panel" style={{ padding: 0, overflow: "hidden" }}>
          {/* Search & Filter Toolbar */}
          <div
            style={{
              padding: "12px 18px",
              background: "var(--bg-card-subtle)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div className="search-input-wrap" style={{ width: "320px" }}>
              <Search size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search candidate name, test code, or score…"
              />
            </div>

            <div className="toolbar-selects">
              <select
                className="crm-select"
                value={testTypeFilter}
                onChange={e => setTestTypeFilter(e.target.value)}
              >
                <option value="ALL">All Test Formats</option>
                <option value="IELTS Academic">IELTS Academic</option>
                <option value="PTE Academic">PTE Academic</option>
                <option value="Duolingo (DET)">Duolingo (DET)</option>
              </select>

              <button
                type="button"
                className="btn-primary"
                style={{ background: "#0F172A", borderColor: "#0F172A", padding: "6px 14px", fontSize: "12px" }}
                onClick={openNewResult}
              >
                <Plus size={14} />
                <span>Log Score</span>
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>TEST CODE</th>
                  <th>CANDIDATE</th>
                  <th>TEST TYPE</th>
                  <th>DATE</th>
                  <th>SECTIONAL SCORES (L · R · W · S)</th>
                  <th>OVERALL RESULT</th>
                  <th>TARGET STATUS</th>
                  <th>EXAMINER</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(res => (
                  <tr
                    key={res.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveResultDetail(res)}
                  >
                    <td>
                      <span className="account-code-cell" style={{ fontWeight: 700 }}>
                        {res.testCode}
                      </span>
                    </td>

                    <td>
                      <div>
                        <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>{res.studentName}</strong>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{res.studentCode}</div>
                      </div>
                    </td>

                    <td>
                      <span className="badge-status counselling" style={{ fontSize: "11px", fontWeight: 700 }}>
                        {res.testType}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>{res.testDate}</span>
                    </td>

                    <td>
                      <div style={{ display: "flex", gap: "6px", fontSize: "11.5px" }}>
                        <span style={{ padding: "2px 6px", background: "var(--bg-card-subtle)", borderRadius: "3px", border: "1px solid var(--border-subtle)" }}>
                          <strong>L:</strong> {res.listening}
                        </span>
                        <span style={{ padding: "2px 6px", background: "var(--bg-card-subtle)", borderRadius: "3px", border: "1px solid var(--border-subtle)" }}>
                          <strong>R:</strong> {res.reading}
                        </span>
                        <span style={{ padding: "2px 6px", background: "var(--bg-card-subtle)", borderRadius: "3px", border: "1px solid var(--border-subtle)" }}>
                          <strong>W:</strong> {res.writing}
                        </span>
                        <span style={{ padding: "2px 6px", background: "var(--bg-card-subtle)", borderRadius: "3px", border: "1px solid var(--border-subtle)" }}>
                          <strong>S:</strong> {res.speaking}
                        </span>
                      </div>
                    </td>

                    <td>
                      <strong style={{ fontSize: "14px", color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>
                        {res.overallScore}
                      </strong>
                    </td>

                    <td>
                      <span className={`badge-status ${res.targetAchieved ? "enrolled" : "counselling"}`}>
                        {res.targetAchieved ? "Target Met" : "Needs Review"}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{res.examiner}</span>
                    </td>

                    <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "11.5px" }}
                        onClick={() => setActiveResultDetail(res)}
                      >
                        <span>View</span>
                        <ChevronRight size={13} />
                      </button>
                      <button type="button" className="btn-secondary" style={{padding:"4px 10px",fontSize:"11.5px",marginLeft:"6px"}} onClick={()=>openEditResult(res)}><Edit size={12}/><span>Edit</span></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SCHEDULED MOCK EXAM SLOTS
          ========================================================================= */}
      {activeTab === "slots" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "18px" }}>
          {slots.map(slot => {
            const bookedPct = Math.round((slot.bookedSeats / slot.totalSeats) * 100);

            return (
              <div
                key={slot.id}
                className="crm-panel"
                style={{
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="badge-status counselling">{slot.testType}</span>
                  <span className={`badge-status ${slot.status === "OPEN" ? "enrolled" : "purple"}`}>
                    {slot.status}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "2px 0 4px" }}>
                    {slot.title}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                    <Calendar size={13} />
                    <span>{slot.date} · {slot.time}</span>
                  </div>
                </div>

                <div style={{ fontSize: "12px", background: "var(--bg-card-subtle)", padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Testing Venue:</span>
                    <strong>{slot.room}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Invigilator:</span>
                    <strong>{slot.invigilator}</strong>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span>Seat Bookings</span>
                    <strong>{slot.bookedSeats} / {slot.totalSeats} Seats ({bookedPct}%)</strong>
                  </div>
                  <div style={{ height: "6px", background: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${bookedPct}%`,
                        background: slot.status === "FULL" ? "var(--danger, #DC2626)" : "var(--accent-blue)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: "100%", marginTop: "auto", fontSize: "12px" }}
                  disabled={slot.status === "FULL"}
                  onClick={()=>{setBookingSlot(slot);setBookingStudentId("")}}
                >
                  <UserPlus size={13} />
                  <span>{slot.status === "FULL" ? "Slot Full" : "Book Candidate Slot"}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          TAB 3: DIAGNOSTIC READINESS TRACKER
          ========================================================================= */}
      {activeTab === "analytics" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Candidate Readiness & Target Score Analysis</h3>
              <p>Benchmarking student progress against destination university minimum cutoffs</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>CANDIDATE</th>
                  <th>TEST TYPE</th>
                  <th>TEST DATE</th>
                  <th>LATEST MOCK RESULT</th>
                  <th>STATUS</th>
                  <th>RECOMMENDED ACTION</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                      No candidate diagnostic scorecards recorded yet. Log mock test evaluation scores to view readiness analytics.
                    </td>
                  </tr>
                ) : (
                  results.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.studentName} ({r.studentCode})</strong></td>
                      <td>{r.testType}</td>
                      <td>{r.testDate}</td>
                      <td><strong style={{ color: r.targetAchieved ? "var(--success, #059669)" : "var(--danger, #DC2626)" }}>{r.overallScore} {r.targetAchieved ? "(Cleared)" : "(Below Target)"}</strong></td>
                      <td><span className={`badge-status ${r.targetAchieved ? "enrolled" : "counselling"}`}>{r.status}</span></td>
                      <td>{r.examinerFeedback || "Standard review"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SCHEDULE MOCK TEST
          ========================================================================= */}
      <AnimatePresence>
        {showAddSlotModal && <div className="modal-backdrop-clean" onClick={()=>setShowAddSlotModal(false)}>
          <motion.div initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.96,opacity:0}} className="modal-dialog-clean" style={{maxWidth:620}} onClick={event=>event.stopPropagation()}>
            <div className="modal-header-clean"><div><h3>Schedule a mock-test session</h3><p>Create a controlled exam slot with accountable venue and invigilator details.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowAddSlotModal(false)}><X size={18}/></button></div>
            <form onSubmit={handleSaveSlot}>
              <div className="modal-body-clean mock-schedule-form">
                <section className="workflow-form-section"><header><span>1</span><div><strong>Test session</strong><small>Choose the exam format and session identity.</small></div></header><div className="form-row-2"><div className="form-group"><label>Session title *</label><input required value={slotForm.title} onChange={e=>setSlotForm({...slotForm,title:e.target.value})} placeholder="IELTS Academic Full Mock"/></div><div className="form-group"><label>Test format *</label><select value={slotForm.testType} onChange={e=>setSlotForm({...slotForm,testType:e.target.value as MockTestSlot["testType"]})}><option>IELTS Academic</option><option>PTE Academic</option><option>Duolingo (DET)</option><option>German A1</option></select></div></div></section>
                <section className="workflow-form-section"><header><span>2</span><div><strong>Schedule and controls</strong><small>Set the operational details used by staff.</small></div></header><div className="form-row-2"><div className="form-group"><label>Date *</label><input type="date" required value={slotForm.date} onChange={e=>setSlotForm({...slotForm,date:e.target.value})}/></div><div className="form-group"><label>Start time *</label><input type="time" required value={slotForm.time} onChange={e=>setSlotForm({...slotForm,time:e.target.value})}/></div></div><div className="form-row-2"><div className="form-group"><label>Venue / room *</label><input required value={slotForm.room} onChange={e=>setSlotForm({...slotForm,room:e.target.value})}/></div><div className="form-group"><label>Invigilator *</label><input required value={slotForm.invigilator} onChange={e=>setSlotForm({...slotForm,invigilator:e.target.value})}/></div></div><div className="form-group"><label>Seat capacity *</label><input type="number" min="1" required value={slotForm.totalSeats||""} onChange={e=>setSlotForm({...slotForm,totalSeats:Number(e.target.value)})}/></div></section>
                {formError&&<div className="phase2-alert phase2-alert-error"><AlertCircle size={16}/>{formError}</div>}
              </div>
              <div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowAddSlotModal(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}><CalendarCheck2 size={15}/>{saving?"Scheduling…":"Schedule session"}</button></div>
            </form>
          </motion.div>
        </div>}
      </AnimatePresence>

      {/* =========================================================================
          MODAL: LOG MOCK TEST SCORES
          ========================================================================= */}
      <AnimatePresence>
        {showAddResultModal && (
          <div className="modal-backdrop-clean" onClick={() => setShowAddResultModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean mock-result-dialog"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean mock-result-dialog-header">
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    {editingResultId?"Edit Mock Test Evaluation":"Log Mock Test Evaluation Scores"}
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Record listening, reading, writing, and speaking marks
                  </p>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowAddResultModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveResult}>
                <div className="modal-body-clean mock-result-dialog-body">
                  <div className="mock-candidate-type"><button type="button" className={scoreForm.candidateType==="INTERNAL"?"active":""} disabled={!!editingResultId} onClick={()=>setScoreForm({...scoreForm,candidateType:"INTERNAL",studentName:"",studentCode:"",phone:"",email:""})}><UserCheck size={15}/>Internal student</button><button type="button" className={scoreForm.candidateType==="EXTERNAL"?"active":""} disabled={!!editingResultId} onClick={()=>setScoreForm({...scoreForm,candidateType:"EXTERNAL",studentName:"",studentCode:"",phone:"",email:""})}><UserPlus size={15}/>External candidate</button></div>
                  {scoreForm.candidateType==="INTERNAL"?<div className="form-row-2">
                    <div className="form-group">
                      <label>Class student *</label>
                      <select required disabled={!!editingResultId} value={scoreForm.studentCode} onChange={event=>{const student=classStudents.find(item=>item.studentCode===event.target.value);setScoreForm(current=>({...current,studentCode:student?.studentCode??"",studentName:student?.fullName??""}))}}>
                        <option value="">Select student by name or code</option>
                        {classStudents.map(student=><option key={student.id} value={student.studentCode}>{student.fullName} · {student.studentCode} · {student.enrolledClass}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Student Code *</label>
                      <input type="text" readOnly value={scoreForm.studentCode} placeholder="Filled from selected student" />
                    </div>
                  </div>:<div className="mock-external-fields"><div className="form-group"><label>External candidate name *</label><input required value={scoreForm.studentName} onChange={event=>setScoreForm({...scoreForm,studentName:event.target.value})} placeholder="Full legal name"/></div><div className="form-group"><label>Phone</label><input value={scoreForm.phone} onChange={event=>setScoreForm({...scoreForm,phone:event.target.value})} placeholder="Contact number"/></div><div className="form-group"><label>Email</label><input type="email" value={scoreForm.email} onChange={event=>setScoreForm({...scoreForm,email:event.target.value})} placeholder="Optional email"/></div></div>}

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Test Format *</label>
                      <select
                        value={scoreForm.testType}
                        onChange={e => setScoreForm({ ...scoreForm, testType: e.target.value as any })}
                      >
                        <option value="IELTS Academic">IELTS Academic</option>
                        <option value="PTE Academic">PTE Academic</option>
                        <option value="Duolingo (DET)">Duolingo (DET)</option>
                        <option value="German A1">German A1</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Test Date *</label>
                      <input
                        type="date"
                        required
                        value={scoreForm.testDate}
                        onChange={e => setScoreForm({ ...scoreForm, testDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* 4 Sectional Inputs */}
                  <div className="mock-sectional-card"
                    style={{
                      background: "var(--bg-card-subtle)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px 14px",
                      marginBottom: "12px",
                    }}
                  >
                    <strong style={{ fontSize: "12.5px", display: "block", marginBottom: "8px" }}>
                      Sectional Scores Breakdown
                    </strong>
                    <div className="mock-sectional-grid">
                      <div className="form-group">
                        <label>Listening</label>
                        <input
                          type="text"
                          required
                          value={scoreForm.listening}
                          onChange={e => setScoreForm({ ...scoreForm, listening: e.target.value })}
                          placeholder="e.g. 7.0"
                        />
                      </div>
                      <div className="form-group">
                        <label>Reading</label>
                        <input
                          type="text"
                          required
                          value={scoreForm.reading}
                          onChange={e => setScoreForm({ ...scoreForm, reading: e.target.value })}
                          placeholder="e.g. 6.5"
                        />
                      </div>
                      <div className="form-group">
                        <label>Writing</label>
                        <input
                          type="text"
                          required
                          value={scoreForm.writing}
                          onChange={e => setScoreForm({ ...scoreForm, writing: e.target.value })}
                          placeholder="e.g. 6.5"
                        />
                      </div>
                      <div className="form-group">
                        <label>Speaking</label>
                        <input
                          type="text"
                          required
                          value={scoreForm.speaking}
                          onChange={e => setScoreForm({ ...scoreForm, speaking: e.target.value })}
                          placeholder="e.g. 7.0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Overall Band / Score *</label>
                      <input
                        type="text"
                        required
                        value={scoreForm.overallScore}
                        onChange={e => setScoreForm({ ...scoreForm, overallScore: e.target.value })}
                        placeholder="e.g. 7.0 Band or 66 / 90"
                      />
                    </div>

                    <div className="form-group">
                      <label>Examiner *</label>
                      <input
                        type="text"
                        required
                        value={scoreForm.examiner}
                        onChange={e => setScoreForm({ ...scoreForm, examiner: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group"><label>Venue / Test Centre *</label><input required value={scoreForm.venue} onChange={event=>setScoreForm({...scoreForm,venue:event.target.value})} placeholder="AECS Test Centre · Room 2"/></div>
                    <div className="form-group"><label>Result status *</label><select value={scoreForm.status} onChange={event=>setScoreForm({...scoreForm,status:event.target.value as MockTestResult["status"]})}><option>Score Issued</option><option>Pending Evaluation</option><option>Absent</option><option>Scheduled</option></select></div>
                  </div>
                  <div className="form-group mock-target-outcome"><label>Target score outcome *</label><select value={scoreForm.targetAchieved?"MET":"NOT_MET"} onChange={event=>setScoreForm({...scoreForm,targetAchieved:event.target.value==="MET"})}><option value="NOT_MET">Target not achieved — further preparation required</option><option value="MET">Target achieved — candidate is exam ready</option></select></div>

                  <div className="form-group">
                    <label>Examiner Feedback & Action Plan *</label>
                    <textarea
                      rows={3}
                      required
                      value={scoreForm.examinerFeedback}
                      onChange={e => setScoreForm({ ...scoreForm, examinerFeedback: e.target.value })}
                      placeholder="Identify modules needing improvement and provide exam readiness assessment…"
                    />
                  </div>
                </div>

                <div className="modal-footer-clean">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAddResultModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    <Award size={15} />
                    <span>{saving?"Saving…":editingResultId?"Save Changes":"Issue Mock Result"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingSlot&&<div className="modal-backdrop-clean" onClick={()=>setBookingSlot(null)}><motion.div initial={{opacity:0,scale:.97}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.97}} className="modal-dialog-clean mock-booking-dialog" onClick={event=>event.stopPropagation()}><div className="modal-header-clean"><div><small>Mock staging desk</small><h3>{bookingSlot.title}</h3><p>{bookingSlot.date} · {bookingSlot.time} · {bookingSlot.room}</p></div><button type="button" className="drawer-close-btn" onClick={()=>setBookingSlot(null)}><X size={18}/></button></div><form onSubmit={handleBookCandidate}><div className="modal-body-clean"><div className="mock-booking-capacity"><Users size={17}/><span>{bookingSlot.bookedSeats} of {bookingSlot.totalSeats} seats staged</span></div><div className="mock-candidate-type"><button type="button" className={bookingCandidateType==="INTERNAL"?"active":""} onClick={()=>setBookingCandidateType("INTERNAL")}><UserCheck size={15}/>Internal student</button><button type="button" className={bookingCandidateType==="EXTERNAL"?"active":""} onClick={()=>setBookingCandidateType("EXTERNAL")}><UserPlus size={15}/>External walk-in</button></div>{bookingCandidateType==="INTERNAL"?<div className="form-group"><label>Class student *</label><select required value={bookingStudentId} onChange={event=>setBookingStudentId(event.target.value)}><option value="">Select student by name or code</option>{classStudents.map(student=><option key={student.id} value={student.id}>{student.studentCode} · {student.fullName} · {student.enrolledClass}</option>)}</select></div>:<div className="mock-external-fields"><div className="form-group"><label>Candidate name *</label><input required value={bookingExternal.name} onChange={e=>setBookingExternal({...bookingExternal,name:e.target.value})}/></div><div className="form-group"><label>Phone</label><input value={bookingExternal.phone} onChange={e=>setBookingExternal({...bookingExternal,phone:e.target.value})}/></div><div className="form-group"><label>Email</label><input type="email" value={bookingExternal.email} onChange={e=>setBookingExternal({...bookingExternal,email:e.target.value})}/></div></div>}{formError&&<div className="phase2-alert-error" data-crm-error>{formError}</div>}</div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setBookingSlot(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}><UserCheck size={15}/>{saving?"Staging…":"Stage candidate"}</button></div></form></motion.div></div>}
      </AnimatePresence>

      {/* =========================================================================
          DRAWER: SCORECARD DOSSIER
          ========================================================================= */}
      <AnimatePresence>
        {activeResultDetail && (
          <div className="modal-backdrop-clean" onClick={() => setActiveResultDetail(null)}>
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
                  <Award size={22} style={{ color: "var(--accent-blue)" }} />
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                      Official Diagnostic Scorecard
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {activeResultDetail.testCode} · {activeResultDetail.testType}
                    </span>
                  </div>
                </div>

                <div style={{display:"flex",gap:"8px"}}><button type="button" className="btn-secondary" onClick={()=>openEditResult(activeResultDetail)}><Edit size={14}/>Edit result</button><button type="button" className="drawer-close-btn" onClick={() => setActiveResultDetail(null)}><X size={18} /></button></div>
              </div>

              <div style={{ padding: "22px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div
                  style={{
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                    Overall Test Band
                  </span>
                  <strong style={{ fontSize: "32px", color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>
                    {activeResultDetail.overallScore}
                  </strong>
                  <div style={{ marginTop: "6px" }}>
                    <span className={`badge-status ${activeResultDetail.targetAchieved ? "enrolled" : "counselling"}`}>
                      {activeResultDetail.targetAchieved ? "University Cutoff Met" : "Additional Prep Recommended"}
                    </span>
                  </div>
                  <div className={`mock-target-decision ${activeResultDetail.targetAchieved?"met":"not-met"}`}><BadgeCheck size={16}/><strong>{activeResultDetail.targetAchieved?"Target score achieved":"Target score not achieved"}</strong></div>
                </div>

                {/* Sectional Breakdown Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  <div style={{ padding: "10px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Listening</span>
                    <strong style={{ fontSize: "16px" }}>{activeResultDetail.listening}</strong>
                  </div>
                  <div style={{ padding: "10px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Reading</span>
                    <strong style={{ fontSize: "16px" }}>{activeResultDetail.reading}</strong>
                  </div>
                  <div style={{ padding: "10px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Writing</span>
                    <strong style={{ fontSize: "16px" }}>{activeResultDetail.writing}</strong>
                  </div>
                  <div style={{ padding: "10px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Speaking</span>
                    <strong style={{ fontSize: "16px" }}>{activeResultDetail.speaking}</strong>
                  </div>
                </div>

                <div>
                  <strong style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}>
                    Master Examiner Feedback
                  </strong>
                  <p style={{ fontSize: "12.5px", lineHeight: 1.6, background: "var(--bg-card-subtle)", padding: "12px", borderRadius: "4px", border: "1px solid var(--border-subtle)", margin: 0 }}>
                    {activeResultDetail.examinerFeedback}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MockTestsWorkspace;
