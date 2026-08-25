import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Award, BookOpen, CalendarCheck2, Camera, Check, ChevronRight, Clock, GraduationCap, History, Pencil, Plus, Search, Trash2, TrendingUp, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AttendanceHistoryRecord, ClassFaculty, ClassStudent, ClassStudentService } from "../../services/classStudentService";
import { StudentDirectoryRecord, StudentService } from "../../services/studentService";
import { notifyError, notifySuccess } from "../../components/common/CrmNotifications";

interface BatchItem {
  id: string;
  batchCode: string;
  courseName: string;
  facultyId?: string;
  timing: string;
  instructor: string;
  enrolledStudents: number;
  maxCapacity: number;
  room: string;
  startDate: string;
  status: "ACTIVE" | "UPCOMING" | "COMPLETED";
}

const INITIAL_BATCHES: BatchItem[] = [];

export function ClassesWorkspace() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"students" | "batches" | "attendance" | "faculty">("students");
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [internalStudents, setInternalStudents] = useState<StudentDirectoryRecord[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>(INITIAL_BATCHES);
  const [facultyRecords,setFacultyRecords]=useState<ClassFaculty[]>([]);
  const [attendanceHistory,setAttendanceHistory]=useState<AttendanceHistoryRecord[]>([]);
  const [historyStudent,setHistoryStudent]=useState<ClassStudent|null>(null);
  const [editingFaculty,setEditingFaculty]=useState<ClassFaculty|null>(null);
  const [facultyToRemove,setFacultyToRemove]=useState<ClassFaculty|null>(null);
  const [showFacultyModal,setShowFacultyModal]=useState(false);
  const [customCourse,setCustomCourse]=useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [activeStudentDetail, setActiveStudentDetail] = useState<ClassStudent | null>(null);
  const [attendanceDate,setAttendanceDate]=useState(new Date().toISOString().slice(0,10));
  const [attendanceBatch,setAttendanceBatch]=useState("ALL");
  const [attendance, setAttendance] = useState<Record<string,"PRESENT"|"ABSENT"|"LATE"|"EXCUSED">>({});
  const [errorMessage,setErrorMessage]=useState("");
  const [successMessage,setSuccessMessage]=useState("");
  const [isLoading,setIsLoading]=useState(true);
  const [studentSource,setStudentSource]=useState<"INTERNAL"|"EXTERNAL">("INTERNAL");
  const [selectedInternalStudentId,setSelectedInternalStudentId]=useState("");
  const [classStudentPhotoUrls,setClassStudentPhotoUrls]=useState<Record<string,string>>({});
  const [photoUploading,setPhotoUploading]=useState(false);
  const [editingClassStudent,setEditingClassStudent]=useState<ClassStudent|null>(null);
  const [classStudentEditForm,setClassStudentEditForm]=useState<Partial<ClassStudent>>({});

  // Exact Add Student Form State matching the user's uploaded screenshot!
  const [studentForm, setStudentForm] = useState({
    // S. Student Details
    fullName: "",
    phone: "",
    altPhone: "",
    email: "",
    gender: "Male" as ClassStudent["gender"],
    educationLevel: "",
    guardianName: "",
    guardianPhone: "",
    address: "",
    recordStatus: "Active" as ClassStudent["recordStatus"],
    notes: "",

    // C. First Class Enrolment
    enrolledClass: "IELTS Preparation" as ClassStudent["enrolledClass"],
    teacher: "",
    startDate: "",
    expectedCompletion: "",
    batchName: "",
    schedule: "",
    mode: "Classroom" as ClassStudent["mode"],
    classStatus: "Active" as ClassStudent["classStatus"],
    enrolmentNotes: "",
    feePaid: "",
  });

  // Batch Form State
  const [batchForm, setBatchForm] = useState({
    batchCode: "",
    courseName: "IELTS Preparation" as BatchItem["courseName"],
    facultyId: "",
    timing: "",
    instructor: "",
    maxCapacity: 0,
    room: "",
    startDate: "",
    status: "ACTIVE" as BatchItem["status"],
  });
  const emptyFacultyForm={fullName:"",email:"",phone:"",specialization:"",qualification:"",employmentType:"Part-time" as ClassFaculty["employmentType"],status:"ACTIVE" as ClassFaculty["status"],notes:""};
  const [facultyForm,setFacultyForm]=useState(emptyFacultyForm);

  // Load students
  const loadStudents = async () => {
    try { const [data,batchRows,crmStudents,facultyRows,historyRows] = await Promise.all([ClassStudentService.getStudents(),ClassStudentService.getBatches(),StudentService.getStudents(),ClassStudentService.getFaculty(),ClassStudentService.getAttendanceHistory()]);
      setStudents(data);setBatches(batchRows as BatchItem[]);setInternalStudents(crmStudents);setFacultyRecords(facultyRows);setAttendanceHistory(historyRows);setErrorMessage("");
    } catch(error) { setErrorMessage(error instanceof Error?error.message:"Unable to load class operations"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudents();
  }, []);

  useEffect(()=>{let active=true;void Promise.all(students.filter(student=>student.photoPath).map(async student=>[student.id,await ClassStudentService.photoUrl(student.photoPath!)] as const)).then(entries=>{if(active)setClassStudentPhotoUrls(Object.fromEntries(entries))}).catch(()=>{});return()=>{active=false}},[students]);

  const uploadClassStudentPhoto=async(file?:File)=>{if(!file||!activeStudentDetail)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)){notifyError("Unsupported photo","Choose a JPG, PNG or WEBP image.");return}if(file.size>5*1024*1024){notifyError("Photo is too large","Choose an image below 5 MB.");return}setPhotoUploading(true);try{await ClassStudentService.uploadPhoto(activeStudentDetail,file);const refreshed=await ClassStudentService.getStudents();setStudents(refreshed);const current=refreshed.find(student=>student.id===activeStudentDetail.id)??null;setActiveStudentDetail(current);notifySuccess("Class student photo updated",`${activeStudentDetail.fullName}'s profile picture is now saved.`)}catch(error){notifyError("Photo upload failed",error instanceof Error?error.message:"Unable to upload photo")}finally{setPhotoUploading(false)}};

  const beginClassStudentEdit=(student:ClassStudent)=>{setEditingClassStudent(student);setClassStudentEditForm({fullName:student.fullName,phone:student.phone,altPhone:student.altPhone??"",email:student.email??"",gender:student.gender,educationLevel:student.educationLevel??"",guardianName:student.guardianName??"",guardianPhone:student.guardianPhone??"",address:student.address??"",recordStatus:student.recordStatus,notes:student.notes??""})};
  const saveClassStudentEdit=async(event:React.FormEvent)=>{event.preventDefault();if(!editingClassStudent)return;try{const patch={...classStudentEditForm};if(editingClassStudent.linkedStudentId){delete patch.fullName;delete patch.phone;delete patch.email;delete patch.gender;delete patch.address}await ClassStudentService.updateStudent(editingClassStudent.id,patch);const refreshed=await ClassStudentService.getStudents();setStudents(refreshed);setActiveStudentDetail(refreshed.find(student=>student.id===editingClassStudent.id)??null);setEditingClassStudent(null);notifySuccess("Class student updated","The profile changes were saved successfully.")}catch(error){notifyError("Update failed",error instanceof Error?error.message:"Unable to update class student")}};

  // Submit Handler for Add Class Student (Matching User's Screenshot Form)
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.fullName.trim() || !studentForm.phone.trim() || !studentForm.batchName) {
      setErrorMessage("Enter the student name and phone, then select an available batch.");
      return;
    }
    try { await ClassStudentService.createStudent({
      linkedStudentId: studentSource === "INTERNAL" ? selectedInternalStudentId : undefined,
      fullName: studentForm.fullName.trim(),
      phone: studentForm.phone.trim(),
      altPhone: studentForm.altPhone.trim(),
      email: studentForm.email.trim(),
      gender: studentForm.gender,
      educationLevel: studentForm.educationLevel.trim(),
      guardianName: studentForm.guardianName.trim(),
      guardianPhone: studentForm.guardianPhone.trim(),
      address: studentForm.address.trim(),
      recordStatus: studentForm.recordStatus,
      notes: studentForm.notes.trim(),
      enrolledClass: studentForm.enrolledClass,
      teacher: studentForm.teacher,
      startDate: studentForm.startDate,
      expectedCompletion: studentForm.expectedCompletion,
      batchName: studentForm.batchName.trim(),
      schedule: studentForm.schedule.trim(),
      mode: studentForm.mode,
      classStatus: studentForm.classStatus,
      enrolmentNotes: studentForm.enrolmentNotes.trim(),
      feePaid: studentForm.feePaid.trim(),
    });

    await loadStudents();
    setShowAddStudentModal(false);
    setSuccessMessage("Class student enrolled successfully.");
    setStudentForm({
      fullName: "",
      phone: "",
      altPhone: "",
      email: "",
      gender: "Male",
      educationLevel: "",
      guardianName: "",
      guardianPhone: "",
      address: "",
      recordStatus: "Active",
      notes: "",
      enrolledClass: "IELTS Preparation",
      teacher: "",
      startDate: "",
      expectedCompletion: "",
      batchName: "",
      schedule: "",
      mode: "Classroom",
      classStatus: "Active",
      enrolmentNotes: "",
      feePaid: "",
    });
    setSelectedInternalStudentId("");
    } catch(error) { setErrorMessage(error instanceof Error?error.message:"Unable to enrol class student"); }
  };

  // Submit Handler for Add Batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedCourse=batchForm.courseName==="OTHER"?customCourse.trim():batchForm.courseName;
    if (!batchForm.batchCode.trim() || !resolvedCourse || !batchForm.timing.trim() || !batchForm.instructor.trim() || !batchForm.startDate) {
      setErrorMessage("Course, batch code, schedule, instructor and start date are required.");
      return;
    }

    try { await ClassStudentService.createBatch({...batchForm,courseName:resolvedCourse,batchCode:batchForm.batchCode.trim(),timing:batchForm.timing.trim(),maxCapacity:Number(batchForm.maxCapacity)||15,room:batchForm.room.trim()});
    await loadStudents();
    setShowAddBatchModal(false);
    setSuccessMessage("Course batch created successfully.");
    setBatchForm({
      batchCode: "",
      courseName: "IELTS Preparation",
      facultyId: "",
      timing: "",
      instructor: "",
      maxCapacity: 0,
      room: "",
      startDate: "",
      status: "ACTIVE",
    });
    setCustomCourse("");
    } catch(error) { setErrorMessage(error instanceof Error?error.message:"Unable to create course batch"); }
  };

  useEffect(()=>{let live=true;ClassStudentService.getAttendance(attendanceDate).then(rows=>{if(live)setAttendance(Object.fromEntries(rows.map(row=>[row.classStudentId,row.status])))}).catch(error=>{if(live)setErrorMessage(error instanceof Error?error.message:"Unable to load attendance")});return()=>{live=false}},[attendanceDate]);

  const markAttendance=async(studentId:string,status:"PRESENT"|"ABSENT"|"LATE"|"EXCUSED")=>{try{await ClassStudentService.markAttendance(studentId,status,attendanceDate);setAttendance(current=>({...current,[studentId]:status}));setAttendanceHistory(await ClassStudentService.getAttendanceHistory());setErrorMessage("");notifySuccess("Attendance saved",`Marked as ${status.toLowerCase()} for ${attendanceDate}.`)}catch(error){notifyError("Attendance not saved",error instanceof Error?error.message:"Unable to mark attendance")}};

  const openFacultyEditor=(faculty?:ClassFaculty)=>{setEditingFaculty(faculty??null);setFacultyForm(faculty?{fullName:faculty.fullName,email:faculty.email,phone:faculty.phone,specialization:faculty.specialization,qualification:faculty.qualification,employmentType:faculty.employmentType,status:faculty.status,notes:faculty.notes}:emptyFacultyForm);setShowFacultyModal(true)};
  const saveFaculty=async(event:React.FormEvent)=>{event.preventDefault();if(!facultyForm.fullName.trim())return;try{await ClassStudentService.saveFaculty({...facultyForm,id:editingFaculty?.id,fullName:facultyForm.fullName.trim()});await loadStudents();setShowFacultyModal(false);notifySuccess(editingFaculty?"Faculty updated":"Faculty added",`${facultyForm.fullName.trim()}'s profile was saved.`)}catch(error){notifyError("Faculty was not saved",error instanceof Error?error.message:"Unable to save faculty")}};
  const removeFaculty=async()=>{if(!facultyToRemove)return;const faculty=facultyToRemove;try{await ClassStudentService.removeFaculty(faculty.id);await loadStudents();setFacultyToRemove(null);notifySuccess("Faculty removed",`${faculty.fullName} was removed and open batches were unassigned.`)}catch(error){notifyError("Faculty was not removed",error instanceof Error?error.message:"Unable to remove faculty")}};

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (courseFilter !== "ALL" && s.enrolledClass !== courseFilter) return false;
      if (statusFilter !== "ALL" && s.classStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          s.fullName.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          s.batchName.toLowerCase().includes(q) ||
          s.teacher.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [students, courseFilter, statusFilter, searchQuery]);

  // Aggregate metrics
  const totalEnrolled = students.filter(student=>student.classStatus==="Active").length;
  const activeBatchesCount = batches.filter(b => b.status === "ACTIVE").length;
  const classroomSeats = batches.reduce((acc, b) => acc + b.maxCapacity, 0);
  const occupiedSeats = batches.reduce((acc, b) => acc + b.enrolledStudents, 0);
  const occupancyRate = classroomSeats > 0 ? Math.round((occupiedSeats / classroomSeats) * 100) : 0;
  const faculty = useMemo(()=>facultyRecords.map(profile=>{const assigned=batches.filter(batch=>batch.facultyId===profile.id||(!batch.facultyId&&batch.instructor.trim().toLowerCase()===profile.fullName.trim().toLowerCase()));return{...profile,batches:assigned,students:assigned.reduce((sum,batch)=>sum+batch.enrolledStudents,0)}}),[batches,facultyRecords]);
  const attendanceStudents=students.filter(student=>attendanceBatch==="ALL"||student.batchName===attendanceBatch);
  const attendanceMarked=attendanceStudents.filter(student=>attendance[student.id]).length;
  const eligibleBatches = batches.filter(batch => batch.status !== "COMPLETED" && batch.enrolledStudents < batch.maxCapacity);

  const chooseInternalStudent = (studentId:string) => {
    setSelectedInternalStudentId(studentId);
    const student=internalStudents.find(item=>item.id===studentId);
    if(!student)return;
    setStudentForm(current=>({...current,fullName:student.fullName,phone:student.phone,email:student.email,gender:student.gender,address:student.address,educationLevel:student.highestQualification,guardianName:"",guardianPhone:"",altPhone:"",notes:`Linked to ${student.code}`}));
  };

  const selectBatch = (batchCode: string) => {
    const batch = batches.find(item => item.batchCode === batchCode);
    if (!batch) {
      setStudentForm(current => ({ ...current, batchName: "", teacher: "", schedule: "" }));
      return;
    }
    setStudentForm(current => ({
      ...current,
      batchName: batch.batchCode,
      enrolledClass: batch.courseName,
      teacher: batch.instructor,
      schedule: batch.timing,
      startDate: current.startDate || batch.startDate,
    }));
  };

  return (
    <div className="page-container classes-workspace">
      {/* 1. Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Classes & Test Preparation Workspace</h2>
          <p>
            Manage enrolled class students, language batches, faculty assignments, and daily attendance.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", gap: "10px" }}>
          {/* Orange Primary Button matching user screenshot */}
          <button
            type="button"
            className="btn-primary"
            style={{ background: "var(--accent-orange, #EA580C)", borderColor: "var(--accent-orange, #EA580C)", boxShadow: "0 2px 8px rgba(234, 88, 12, 0.25)" }}
            onClick={() => setShowAddStudentModal(true)}
          >
            <Plus size={16} />
            <span>Add class student</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowAddBatchModal(true)}
          >
            <BookOpen size={15} />
            <span>Create Batch</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/mocks")}
            title="Go to Mock Tests Suite"
          >
            <Award size={15} />
            <span>Mock Tests Suite →</span>
          </button>
        </div>
      </div>
      {errorMessage&&<div className="phase2-alert phase2-alert-error"><AlertCircle size={16}/>{errorMessage}<button type="button" onClick={()=>setErrorMessage("")}><X size={14}/></button></div>}
      {successMessage&&<div className="classes-success"><Check size={16}/><span>{successMessage}</span><button type="button" onClick={()=>setSuccessMessage("")}><X size={14}/></button></div>}

      {/* 2. Top 4 Metric Strip */}
      <section className="classes-summary">
        <header><div><strong>Live operations summary</strong><span>Calculated from active class records</span></div><small>{isLoading?"Synchronising…":"Database connected"}</small></header>
      <div className="metrics-grid-4 classes-metrics">
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Enrolled Students</span>
            <div className="metric-icon-wrap blue">
              <Users size={17} />
            </div>
          </div>
          <div className="metric-value">{totalEnrolled}</div>
          <span className="metric-sub">Active enrolments</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Active Batches</span>
            <div className="metric-icon-wrap green">
              <BookOpen size={17} />
            </div>
          </div>
          <div className="metric-value">{activeBatchesCount}</div>
          <span className="metric-sub">Batches currently running</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
          <span className="metric-label">Seat Utilisation</span>
            <div className="metric-icon-wrap purple">
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="metric-value">{occupancyRate}%</div>
          <span className="metric-sub">{occupiedSeats} of {classroomSeats} configured seats</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Certified Faculty</span>
            <div className="metric-icon-wrap amber">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="metric-value">{faculty.length}</div>
          <span className="metric-sub">Assigned instructors</span>
        </div>
      </div>
      </section>

      {/* 3. Navigation Tabs */}
      <div className="document-tabs">
        <button
          type="button"
          className={activeTab === "students" ? "active" : ""}
          onClick={() => setActiveTab("students")}
        >
          <Users size={15} />
          <span>Class Students ({students.length})</span>
        </button>

        <button
          type="button"
          className={activeTab === "batches" ? "active" : ""}
          onClick={() => setActiveTab("batches")}
        >
          <BookOpen size={15} />
          <span>Course Batches & Schedules ({batches.length})</span>
        </button>

        <button
          type="button"
          className={activeTab === "attendance" ? "active" : ""}
          onClick={() => setActiveTab("attendance")}
        >
          <CalendarCheck2 size={15} />
          <span>Daily Roll Call Register</span>
        </button>

        <button
          type="button"
          className={activeTab === "faculty" ? "active" : ""}
          onClick={() => setActiveTab("faculty")}
        >
          <GraduationCap size={15} />
          <span>Faculty & Trainers</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: CLASS STUDENTS DIRECTORY
          ========================================================================= */}
      {activeTab === "students" && (
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
                placeholder="Search class student, phone, or batch…"
              />
            </div>

            <div className="toolbar-selects">
              <select
                className="crm-select"
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
              >
                <option value="ALL">All Courses</option>
                <option value="IELTS Preparation">IELTS Preparation</option>
                <option value="PTE Academic">PTE Academic</option>
                <option value="Duolingo (DET)">Duolingo (DET)</option>
                <option value="German Language (A1/A2)">German Language (A1/A2)</option>
                <option value="Japanese (NAT/JLPT)">Japanese (NAT/JLPT)</option>
              </select>

              <select
                className="crm-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>

              <button
                type="button"
                className="btn-primary"
                style={{ background: "var(--accent-orange, #EA580C)", borderColor: "var(--accent-orange, #EA580C)", padding: "6px 14px", fontSize: "12px" }}
                onClick={() => setShowAddStudentModal(true)}
              >
                <Plus size={14} />
                <span>Add student</span>
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: "110px" }}>STUDENT CODE</th>
                  <th>STUDENT NAME</th>
                  <th>ENROLLED COURSE</th>
                  <th>BATCH & TIMING</th>
                  <th>INSTRUCTOR</th>
                  <th>MODE</th>
                  <th>START DATE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <Users size={28} style={{ opacity: 0.35 }} />
                        <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>No class students found</strong>
                        <span style={{ fontSize: "12px" }}>Register students directly into IELTS, PTE or Language batches.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(st => {
                    const initials = st.fullName
                      .split(" ")
                      .map(n => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <tr
                        key={st.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => setActiveStudentDetail(st)}
                      >
                        <td>
                          <span className="account-code-cell" style={{ fontWeight: 700 }}>
                            {st.studentCode}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
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
                            <div>
                              <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>{st.fullName}</strong>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{st.phone}</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="badge-status counselling" style={{ fontSize: "11px", fontWeight: 700 }}>
                            {st.enrolledClass}
                          </span>
                        </td>

                        <td>
                          <div>
                            <strong style={{ fontSize: "12.5px", color: "var(--text-main)" }}>{st.batchName}</strong>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{st.schedule}</div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontSize: "12px", color: "var(--text-main)" }}>{st.teacher}</span>
                        </td>

                        <td>
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "var(--bg-card-subtle)",
                              border: "1px solid var(--border-subtle)",
                              fontWeight: 600,
                            }}
                          >
                            {st.mode}
                          </span>
                        </td>

                        <td>
                          <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>{st.startDate}</span>
                        </td>

                        <td>
                          <span className={`badge-status ${st.classStatus === "Active" ? "enrolled" : "purple"}`}>
                            {st.classStatus}
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "4px 10px", fontSize: "11.5px" }}
                            onClick={() => setActiveStudentDetail(st)}
                          >
                            <span>Dossier</span>
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: COURSE BATCHES & SCHEDULES
          ========================================================================= */}
      {activeTab === "batches" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="classes-section-heading"><div><strong>Batch schedule</strong><span>Capacity, faculty ownership, room and delivery timing</span></div><button type="button" className="btn-primary" onClick={()=>setShowAddBatchModal(true)}><Plus size={14}/>Create batch</button></div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "18px",
            }}
          >
            {batches.length===0&&<div className="classes-empty"><BookOpen size={26}/><strong>No course batches configured</strong><span>Create the first batch before enrolling class students.</span><button type="button" className="btn-primary" onClick={()=>setShowAddBatchModal(true)}><Plus size={14}/>Create first batch</button></div>}
            {batches.map(b => {
              const fillPct = Math.round((b.enrolledStudents / b.maxCapacity) * 100);

              return (
                <div
                  key={b.id}
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
                    <span className="account-code-cell" style={{ fontWeight: 700 }}>
                      {b.batchCode}
                    </span>
                    <span className="badge-status enrolled">{b.status}</span>
                  </div>

                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "2px 0 4px" }}>
                      {b.courseName}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                      <Clock size={13} />
                      <span>{b.timing}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: "12px", background: "var(--bg-card-subtle)", padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Instructor:</span>
                      <strong>{b.instructor}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Classroom Location:</span>
                      <strong>{b.room}</strong>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span>Batch Capacity Fill</span>
                      <strong>{b.enrolledStudents} / {b.maxCapacity} Seats ({fillPct}%)</strong>
                    </div>
                    <div style={{ height: "6px", background: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${fillPct}%`,
                          background: fillPct >= 90 ? "var(--danger, #DC2626)" : "var(--accent-blue)",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "8px", borderTop: "1px solid var(--border-subtle)" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: "12px" }}
                      onClick={() => {
                        setStudentForm(f => ({ ...f, enrolledClass: b.courseName, batchName: b.batchCode, schedule: b.timing, teacher: b.instructor }));
                        setShowAddStudentModal(true);
                      }}
                    >
                      <UserPlus size={13} />
                      <span>Enroll Student</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DAILY ROLL CALL REGISTER
          ========================================================================= */}
      {activeTab === "attendance" && (
        <div className="crm-panel classes-register">
          <div className="panel-header-bar">
            <div>
              <h3>Daily Roll Call Register</h3>
              <p>Saved attendance by class date and active batch</p>
            </div>
            <div className="classes-register-controls"><label><span>Class date</span><input type="date" value={attendanceDate} onChange={event=>setAttendanceDate(event.target.value)}/></label><label><span>Batch</span><select value={attendanceBatch} onChange={event=>setAttendanceBatch(event.target.value)}><option value="ALL">All active batches</option>{batches.map(batch=><option key={batch.id} value={batch.batchCode}>{batch.batchCode} · {batch.courseName}</option>)}</select></label><div><strong>{attendanceMarked}/{attendanceStudents.length}</strong><span>Marked</span></div></div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>STUDENT CODE</th>
                  <th>STUDENT NAME</th>
                  <th>BATCH</th>
                  <th>TIMING</th>
                  <th>TODAY'S ATTENDANCE STATUS</th>
                  <th>HISTORY</th>
                  <th style={{ textAlign: "right" }}>QUICK MARK</th>
                </tr>
              </thead>
              <tbody>
                {attendanceStudents.length===0&&<tr><td colSpan={7}><div className="classes-empty compact"><CalendarCheck2 size={24}/><strong>No students available for this register</strong><span>Enroll students in a batch to begin daily roll call.</span></div></td></tr>}
                {attendanceStudents.map(s => (
                  <tr key={s.id}>
                    <td><strong className="code-font">{s.studentCode}</strong></td>
                    <td><strong style={{ color: "var(--text-main)" }}>{s.fullName}</strong></td>
                    <td><span className="badge-status counselling">{s.batchName}</span></td>
                    <td><span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.schedule}</span></td>
                    <td>
                      <span className={`badge-status ${attendance[s.id]==="ABSENT"?"visa":attendance[s.id]==="LATE"?"counselling":attendance[s.id]?"enrolled":"purple"}`}>
                        {attendance[s.id]&&<Check size={11} style={{ display: "inline", marginRight: "3px" }} />}
                        {attendance[s.id]??"Not marked"}
                      </span>
                    </td>
                    <td><button type="button" className="btn-secondary" onClick={()=>setHistoryStudent(s)} style={{padding:"6px 10px",fontSize:"11px"}}><History size={13}/>View {attendanceHistory.filter(item=>item.classStudentId===s.id).length}</button></td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        <button type="button" onClick={()=>markAttendance(s.id,"PRESENT")} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--success, #059669)" }}>P</button>
                        <button type="button" onClick={()=>markAttendance(s.id,"ABSENT")} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--danger, #DC2626)" }}>A</button>
                        <button type="button" onClick={()=>markAttendance(s.id,"LATE")} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--accent-orange, #EA580C)" }}>L</button>
                        <button type="button" onClick={()=>markAttendance(s.id,"EXCUSED")} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }}>E</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: FACULTY & INSTRUCTORS
          ========================================================================= */}
      {activeTab === "faculty" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div><h3 style={{margin:0,fontSize:16}}>Faculty & Trainers</h3><p style={{margin:"4px 0 0",fontSize:12,color:"var(--text-muted)"}}>Maintain teacher profiles and see every assigned batch.</p></div><button type="button" className="btn-primary" onClick={()=>openFacultyEditor()}><Plus size={14}/>Add faculty</button></div>
        <div className="classes-faculty-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "18px",
          }}
        >
          {faculty.length===0&&<div className="classes-empty"><GraduationCap size={26}/><strong>No faculty profiles yet</strong><span>Add a trainer once, then assign them to any course batch.</span><button type="button" className="btn-primary" onClick={()=>openFacultyEditor()}><Plus size={14}/>Add faculty profile</button></div>}
          {faculty.map((teacher) => (
            <div key={teacher.id} className="crm-panel classes-faculty-card">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "var(--primary-navy)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {teacher.fullName.split(" ").map(part=>part[0]).slice(0,2).join("")}
                </div>
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>{teacher.fullName}</strong>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                    {teacher.specialization||"General trainer"} · {teacher.employmentType}
                  </span>
                </div>
                <div style={{marginLeft:"auto",display:"flex",gap:6}}><button type="button" className="btn-secondary" title="Edit faculty" onClick={()=>openFacultyEditor(teacher)} style={{padding:7}}><Pencil size={13}/></button><button type="button" className="btn-secondary" title="Remove faculty" onClick={()=>setFacultyToRemove(teacher)} style={{padding:7,color:"var(--danger, #dc2626)"}}><Trash2 size={13}/></button></div>
              </div>

              <div style={{ fontSize: "12px", background: "var(--bg-card-subtle)", padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Active Batches:</span>
                  <strong>{teacher.batches.filter(batch=>batch.status==="ACTIVE").length} running</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Students:</span>
                  <strong>{teacher.students} enrolled</strong>
                </div>
              </div>
              {(teacher.email||teacher.phone||teacher.qualification)&&<div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.7}}>{teacher.email&&<div>{teacher.email}</div>}{teacher.phone&&<div>{teacher.phone}</div>}{teacher.qualification&&<div>{teacher.qualification}</div>}</div>}
              <div className="classes-faculty-tags">{teacher.batches.length?teacher.batches.map(batch=><span key={batch.id}>{batch.batchCode} · {batch.courseName} · {batch.status}</span>):<span>No batch assigned</span>}</div>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Add class student */}
      <AnimatePresence>
        {showAddStudentModal && (
          <div className="modal-backdrop-clean" onClick={() => setShowAddStudentModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean classes-student-dialog"
              onClick={e => e.stopPropagation()}
            >
              <div
                className="classes-student-dialog-header"
                style={{
                  padding: "16px 22px",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: "var(--bg-card-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", color: "var(--accent-blue)", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                    ← Classes
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div className="classes-student-dialog-icon"
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "rgba(234, 88, 12, 0.12)",
                        color: "var(--accent-orange, #EA580C)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "14px",
                      }}
                    >
                      +
                    </div>
                    <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0 }}>
                      Enrol a class student
                    </h3>
                  </div>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Create a class-only learner profile and assign the first batch.
                  </p>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowAddStudentModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateStudent} className="classes-student-dialog-form">
                <div className="classes-student-source">
                  <div className="classes-student-source-copy"><strong>Student type</strong><span>Choose an existing CRM student or create an independent class learner.</span></div>
                  <div className="classes-student-source-toggle" role="group" aria-label="Student type">
                    <button type="button" className={studentSource==="INTERNAL"?"active":""} onClick={()=>{setStudentSource("INTERNAL");setSelectedInternalStudentId("")}}><Users size={15}/><span>Internal student</span></button>
                    <button type="button" className={studentSource==="EXTERNAL"?"active":""} onClick={()=>{setStudentSource("EXTERNAL");setSelectedInternalStudentId("");setStudentForm(current=>({...current,fullName:"",phone:"",altPhone:"",email:"",gender:"Male",educationLevel:"",guardianName:"",guardianPhone:"",address:"",notes:""}))}}><UserPlus size={15}/><span>External student</span></button>
                  </div>
                  {studentSource==="INTERNAL"&&<div className="classes-internal-picker">
                    <label>Select CRM student *</label>
                    <select required value={selectedInternalStudentId} onChange={event=>chooseInternalStudent(event.target.value)}>
                      <option value="">Search by student name or AECS code</option>
                      {internalStudents.map(student=><option key={student.id} value={student.id}>{student.code} · {student.fullName} · {student.phone||student.email}</option>)}
                    </select>
                    {selectedInternalStudentId&&(()=>{const selected=internalStudents.find(student=>student.id===selectedInternalStudentId);return selected?<div className="classes-internal-preview"><span className="classes-internal-avatar">{selected.fullName.split(/\s+/).slice(0,2).map(part=>part[0]).join("")}</span><div><strong>{selected.fullName}</strong><span>{selected.code} · {selected.email||"No email"} · {selected.phone||"No phone"}</span></div><em>Profile linked</em></div>:null})()}
                  </div>}
                </div>
                <div
                  className="classes-student-form-panel identity"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px 18px",
                    marginBottom: "18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "4px",
                        background: "rgba(249, 115, 22, 0.1)",
                        color: "var(--accent-blue)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      S
                    </div>
                    <div className="classes-student-section-title"><strong>Student profile</strong><span>Contact and personal information</span></div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Full name *</label>
                      <input
                        type="text"
                        required
                        readOnly={studentSource==="INTERNAL"}
                        value={studentForm.fullName}
                        onChange={e => setStudentForm({ ...studentForm, fullName: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Phone *</label>
                      <input
                        type="text"
                        required
                        readOnly={studentSource==="INTERNAL"}
                        value={studentForm.phone}
                        onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })}
                        placeholder="+977 98XXXXXXXX"
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Alternate phone</label>
                      <input
                        type="text"
                        readOnly={studentSource==="INTERNAL"}
                        value={studentForm.altPhone}
                        onChange={e => setStudentForm({ ...studentForm, altPhone: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        readOnly={studentSource==="INTERNAL"}
                        value={studentForm.email}
                        onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Gender</label>
                      <select
                        disabled={studentSource==="INTERNAL"}
                        value={studentForm.gender}
                        onChange={e => setStudentForm({ ...studentForm, gender: e.target.value as ClassStudent["gender"] })}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Education level</label>
                      <input
                        type="text"
                        readOnly={studentSource==="INTERNAL"}
                        value={studentForm.educationLevel}
                        onChange={e => setStudentForm({ ...studentForm, educationLevel: e.target.value })}
                        placeholder="e.g. Grade 12, Bachelor's"
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Guardian name</label>
                      <input
                        type="text"
                        value={studentForm.guardianName}
                        onChange={e => setStudentForm({ ...studentForm, guardianName: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Guardian phone</label>
                      <input
                        type="text"
                        value={studentForm.guardianPhone}
                        onChange={e => setStudentForm({ ...studentForm, guardianPhone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Address</label>
                    <textarea
                      rows={2}
                      readOnly={studentSource==="INTERNAL"}
                      value={studentForm.address}
                      onChange={e => setStudentForm({ ...studentForm, address: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      rows={2}
                      value={studentForm.notes}
                      onChange={e => setStudentForm({ ...studentForm, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div
                  className="classes-student-form-panel enrolment"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px 18px",
                    marginBottom: "18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "4px",
                        background: "rgba(5, 150, 105, 0.1)",
                        color: "var(--success, #059669)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      C
                    </div>
                    <div className="classes-student-section-title"><strong>Batch enrolment</strong><span>Schedule and delivery preferences</span></div>
                  </div>

                  <div className="form-group">
                    <label>Assign to batch *</label>
                    <select required value={studentForm.batchName} onChange={event => selectBatch(event.target.value)}>
                      <option value="">Select an active batch</option>
                      {eligibleBatches.map(batch => <option key={batch.id} value={batch.batchCode}>{batch.batchCode} · {batch.courseName} · {batch.timing} ({batch.enrolledStudents}/{batch.maxCapacity})</option>)}
                    </select>
                    {!eligibleBatches.length && <small>No available batch exists. Create a batch before enrolling a class student.</small>}
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Start date *</label>
                      <input
                        type="date"
                        required
                        value={studentForm.startDate}
                        onChange={e => setStudentForm({ ...studentForm, startDate: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Expected completion</label>
                      <input
                        type="date"
                        value={studentForm.expectedCompletion}
                        onChange={e => setStudentForm({ ...studentForm, expectedCompletion: e.target.value })}
                      />
                    </div>
                  </div>

                  {studentForm.batchName && <div className="classes-batch-assignment"><div><span>Course</span><strong>{studentForm.enrolledClass}</strong></div><div><span>Instructor</span><strong>{studentForm.teacher || "Unassigned"}</strong></div><div><span>Schedule</span><strong>{studentForm.schedule || "Not set"}</strong></div></div>}

                  <div className="form-group">
                    <label>Mode</label>
                    <select
                      value={studentForm.mode}
                      onChange={e => setStudentForm({ ...studentForm, mode: e.target.value as ClassStudent["mode"] })}
                    >
                      <option value="Classroom">Classroom</option>
                      <option value="Online">Online</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                    <small style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>
                      CrashCourse is available for IELTS, PTE and DET only.
                    </small>
                  </div>

                  <div className="form-group">
                    <label>Enrolment notes</label>
                    <textarea
                      rows={2}
                      value={studentForm.enrolmentNotes}
                      onChange={e => setStudentForm({ ...studentForm, enrolmentNotes: e.target.value })}
                    />
                  </div>
                </div>

                <div
                  className="classes-student-dialog-footer"
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    paddingTop: "14px",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAddStudentModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!eligibleBatches.length}
                    style={{ background: "var(--accent-orange, #EA580C)", borderColor: "var(--accent-orange, #EA580C)", boxShadow: "0 2px 8px rgba(234, 88, 12, 0.25)" }}
                  >
                    Create student record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyStudent&&<div className="modal-backdrop-clean" onClick={()=>setHistoryStudent(null)}><motion.div initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.96,opacity:0}} className="modal-dialog-clean" style={{maxWidth:700}} onClick={event=>event.stopPropagation()}>
          <div className="modal-header-clean"><div><h3 style={{margin:0,fontSize:16}}>Attendance history</h3><p style={{margin:"3px 0 0",fontSize:12,color:"var(--text-muted)"}}>{historyStudent.fullName} · {historyStudent.studentCode}</p></div><button type="button" className="drawer-close-btn" onClick={()=>setHistoryStudent(null)}><X size={18}/></button></div>
          <div className="modal-body-clean">
            {(()=>{const rows=attendanceHistory.filter(item=>item.classStudentId===historyStudent.id);const total=rows.length;return <><div className="metrics-grid-4" style={{marginBottom:16}}>{(["PRESENT","ABSENT","LATE","EXCUSED"] as const).map(status=><div className="metric-box" key={status}><span className="metric-label">{status}</span><strong className="metric-value" style={{fontSize:22}}>{rows.filter(item=>item.status===status).length}</strong><small>{total?Math.round(rows.filter(item=>item.status===status).length/total*100):0}% of records</small></div>)}</div>{rows.length?<div className="table-wrapper"><table className="crm-table"><thead><tr><th>DATE</th><th>BATCH</th><th>COURSE</th><th>STATUS</th><th>MARKED AT</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{new Date(`${row.sessionDate}T00:00:00`).toLocaleDateString()}</strong></td><td>{row.batchCode}</td><td>{row.courseName}</td><td><span className={`badge-status ${row.status==="ABSENT"?"visa":row.status==="LATE"?"counselling":row.status==="PRESENT"?"enrolled":"purple"}`}>{row.status}</span></td><td>{new Date(row.markedAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<div className="classes-empty compact"><History size={24}/><strong>No attendance history yet</strong><span>Saved roll-call entries will appear here by date.</span></div>}</>})()}
          </div>
        </motion.div></div>}
      </AnimatePresence>

      <AnimatePresence>
        {showFacultyModal&&<div className="modal-backdrop-clean" onClick={()=>setShowFacultyModal(false)}><motion.div initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.96,opacity:0}} className="modal-dialog-clean" style={{maxWidth:620}} onClick={event=>event.stopPropagation()}>
          <div className="modal-header-clean"><div><h3 style={{margin:0,fontSize:16}}>{editingFaculty?"Edit faculty profile":"Add faculty or trainer"}</h3><p style={{margin:"3px 0 0",fontSize:12,color:"var(--text-muted)"}}>Basic details used for class scheduling and workload visibility.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowFacultyModal(false)}><X size={18}/></button></div>
          <form onSubmit={saveFaculty}><div className="modal-body-clean">
            <div className="form-row-2"><div className="form-group"><label>Full name *</label><input required value={facultyForm.fullName} onChange={e=>setFacultyForm({...facultyForm,fullName:e.target.value})} placeholder="Teacher's full name"/></div><div className="form-group"><label>Status</label><select value={facultyForm.status} onChange={e=>setFacultyForm({...facultyForm,status:e.target.value as ClassFaculty["status"]})}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div></div>
            <div className="form-row-2"><div className="form-group"><label>Email</label><input type="email" value={facultyForm.email} onChange={e=>setFacultyForm({...facultyForm,email:e.target.value})} placeholder="teacher@example.com"/></div><div className="form-group"><label>Phone</label><input value={facultyForm.phone} onChange={e=>setFacultyForm({...facultyForm,phone:e.target.value})} placeholder="Contact number"/></div></div>
            <div className="form-row-2"><div className="form-group"><label>Specialization</label><input value={facultyForm.specialization} onChange={e=>setFacultyForm({...facultyForm,specialization:e.target.value})} placeholder="e.g. IELTS, PTE, Japanese"/></div><div className="form-group"><label>Employment type</label><select value={facultyForm.employmentType} onChange={e=>setFacultyForm({...facultyForm,employmentType:e.target.value as ClassFaculty["employmentType"]})}><option>Full-time</option><option>Part-time</option><option>Visiting</option></select></div></div>
            <div className="form-group"><label>Qualification</label><input value={facultyForm.qualification} onChange={e=>setFacultyForm({...facultyForm,qualification:e.target.value})} placeholder="Highest qualification or certification"/></div>
            <div className="form-group"><label>Internal notes</label><textarea rows={3} value={facultyForm.notes} onChange={e=>setFacultyForm({...facultyForm,notes:e.target.value})} placeholder="Availability, preferred schedules, or teaching notes"/></div>
            {editingFaculty&&<div style={{padding:12,border:"1px solid var(--border-subtle)",borderRadius:10,background:"var(--bg-card-subtle)"}}><strong style={{fontSize:12}}>Assigned batches</strong><div className="classes-faculty-tags" style={{marginTop:8}}>{batches.filter(batch=>batch.facultyId===editingFaculty.id||(!batch.facultyId&&batch.instructor.toLowerCase()===editingFaculty.fullName.toLowerCase())).map(batch=><span key={batch.id}>{batch.batchCode} · {batch.courseName}</span>)}</div></div>}
          </div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowFacultyModal(false)}>Cancel</button><button type="submit" className="btn-primary"><Check size={14}/>{editingFaculty?"Save changes":"Add faculty"}</button></div></form>
        </motion.div></div>}
      </AnimatePresence>

      <AnimatePresence>
        {facultyToRemove&&<div className="modal-backdrop-clean" onClick={()=>setFacultyToRemove(null)}><motion.div initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.96,opacity:0}} className="modal-dialog-clean" style={{maxWidth:430}} onClick={event=>event.stopPropagation()}><div className="modal-body-clean" style={{padding:28,textAlign:"center"}}><div style={{width:46,height:46,margin:"0 auto 14px",borderRadius:14,display:"grid",placeItems:"center",background:"#fef2f2",color:"#dc2626"}}><Trash2 size={20}/></div><h3 style={{margin:"0 0 7px"}}>Remove faculty profile?</h3><p style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.6,margin:0}}><strong>{facultyToRemove.fullName}</strong> will be removed. Their active and upcoming batches will stay intact but become unassigned.</p></div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setFacultyToRemove(null)}>Keep faculty</button><button type="button" className="btn-primary" onClick={()=>void removeFaculty()} style={{background:"#dc2626",borderColor:"#dc2626"}}><Trash2 size={14}/>Remove faculty</button></div></motion.div></div>}
      </AnimatePresence>

      {/* =========================================================================
          MODAL: CREATE NEW BATCH
          ========================================================================= */}
      <AnimatePresence>
        {showAddBatchModal && (
          <div className="modal-backdrop-clean" onClick={() => setShowAddBatchModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean"
              style={{ maxWidth: "560px" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean">
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    Create New Course Batch
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Configure timing, room, teacher and seat capacity
                  </p>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowAddBatchModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateBatch}>
                <div className="modal-body-clean">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Batch Code *</label>
                      <input
                        type="text"
                        required
                        value={batchForm.batchCode}
                        onChange={e => setBatchForm({ ...batchForm, batchCode: e.target.value })}
                        placeholder="e.g. BATCH-IELTS-M05"
                      />
                    </div>

                    <div className="form-group">
                      <label>Course *</label>
                      <select
                        value={batchForm.courseName}
                        onChange={e => setBatchForm({ ...batchForm, courseName: e.target.value as BatchItem["courseName"] })}
                      >
                        <option value="IELTS Preparation">IELTS Preparation</option>
                        <option value="PTE Academic">PTE Academic</option>
                        <option value="Duolingo (DET)">Duolingo (DET)</option>
                        <option value="German Language (A1/A2)">German Language (A1/A2)</option>
                        <option value="Japanese (NAT/JLPT)">Japanese (NAT/JLPT)</option>
                        <option value="Korean (TOPIK)">Korean (TOPIK)</option>
                        <option value="OTHER">＋ Other course</option>
                      </select>
                      {batchForm.courseName==="OTHER"&&<div style={{marginTop:8,padding:10,border:"1px solid var(--border-subtle)",borderRadius:9,background:"var(--bg-card-subtle)"}}><label style={{display:"block",marginBottom:5}}>Custom course name *</label><input autoFocus required value={customCourse} onChange={e=>setCustomCourse(e.target.value)} placeholder="e.g. French Language A1"/><small style={{display:"block",marginTop:5,color:"var(--text-muted)"}}>This course will be saved and shown on the batch and student records.</small></div>}
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Schedule & Timing *</label>
                      <input
                        type="text"
                        required
                        value={batchForm.timing}
                        onChange={e => setBatchForm({ ...batchForm, timing: e.target.value })}
                        placeholder="e.g. 07:00 AM – 08:30 AM (Sun–Fri)"
                      />
                    </div>

                    <div className="form-group">
                      <label>Instructor *</label>
                      <select required value={batchForm.facultyId} onChange={e=>{const selected=facultyRecords.find(item=>item.id===e.target.value);setBatchForm({...batchForm,facultyId:e.target.value,instructor:selected?.fullName??""})}}><option value="">Select an active faculty member</option>{facultyRecords.filter(item=>item.status==="ACTIVE").map(item=><option key={item.id} value={item.id}>{item.fullName} · {item.specialization||"General"}</option>)}</select>
                      <button type="button" onClick={()=>openFacultyEditor()} style={{border:0,background:"transparent",color:"var(--accent-orange, #ea580c)",padding:"7px 0 0",fontSize:11,fontWeight:700,cursor:"pointer"}}><Plus size={12} style={{verticalAlign:"middle"}}/> Add a new faculty profile</button>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Room / Lab Location</label>
                      <input
                        type="text"
                        value={batchForm.room}
                        onChange={e => setBatchForm({ ...batchForm, room: e.target.value })}
                        placeholder="e.g. Lab 01 · Audio Hub"
                      />
                    </div>

                    <div className="form-group">
                      <label>Max Seat Capacity</label>
                      <input
                        type="number"
                        value={batchForm.maxCapacity}
                        onChange={e => setBatchForm({ ...batchForm, maxCapacity: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group"><label>Batch start date *</label><input type="date" required value={batchForm.startDate} onChange={e=>setBatchForm({...batchForm,startDate:e.target.value})}/></div>
                    <div className="form-group"><label>Operational status</label><select value={batchForm.status} onChange={e=>setBatchForm({...batchForm,status:e.target.value as BatchItem["status"]})}><option value="UPCOMING">Upcoming</option><option value="ACTIVE">Active</option></select></div>
                  </div>
                </div>

                <div className="modal-footer-clean">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAddBatchModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    <BookOpen size={15} />
                    <span>Save Course Batch</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          DRAWER: STUDENT PROFILE & DOSSIER
          ========================================================================= */}
      <AnimatePresence>
        {activeStudentDetail && (
          <div className="modal-backdrop-clean" onClick={() => setActiveStudentDetail(null)}>
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
                      borderRadius: "50%",
                      background: "var(--primary-navy)",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      overflow: "hidden",
                    }}
                  >
                    {classStudentPhotoUrls[activeStudentDetail.id]?<img src={classStudentPhotoUrls[activeStudentDetail.id]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:activeStudentDetail.studentCode.split("-").pop()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                      {activeStudentDetail.fullName}
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {activeStudentDetail.studentCode} · {activeStudentDetail.enrolledClass}
                    </span>
                  </div>
                </div>

                <div className="classes-student-profile-actions">
                  <label className="btn-secondary"><Camera size={14}/><span>{photoUploading?"Uploading…":"Photo"}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoUploading} onChange={event=>{void uploadClassStudentPhoto(event.target.files?.[0]);event.currentTarget.value=""}}/></label>
                  <button type="button" className="btn-secondary" onClick={()=>beginClassStudentEdit(activeStudentDetail)}><Pencil size={14}/><span>Edit</span></button>
                  <button type="button" className="drawer-close-btn" onClick={() => setActiveStudentDetail(null)}><X size={18} /></button>
                </div>
              </div>

              <div style={{ padding: "22px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>
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
                    <span style={{ color: "var(--text-muted)" }}>Phone:</span>
                    <strong>{activeStudentDetail.phone}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Email:</span>
                    <strong>{activeStudentDetail.email || "—"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Guardian:</span>
                    <strong>{activeStudentDetail.guardianName || "—"} ({activeStudentDetail.guardianPhone || "—"})</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Address:</span>
                    <strong>{activeStudentDetail.address || "—"}</strong>
                  </div>
                </div>

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
                  <strong style={{ fontSize: "13px" }}>Enrolment & Batch Details</strong>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Batch Name:</span>
                    <strong>{activeStudentDetail.batchName}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Timing:</span>
                    <strong>{activeStudentDetail.schedule}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Instructor:</span>
                    <strong>{activeStudentDetail.teacher}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Mode:</span>
                    <strong>{activeStudentDetail.mode}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Start Date:</span>
                    <strong>{activeStudentDetail.startDate}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Fee Status:</span>
                    <strong style={{ color: "var(--success, #059669)" }}>{activeStudentDetail.feePaid}</strong>
                  </div>
                </div>

                <div>
                  <strong style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}>Notes & Study Goals</strong>
                  <p style={{ fontSize: "12.5px", color: "var(--text-main)", background: "var(--bg-card-subtle)", padding: "12px", borderRadius: "4px", border: "1px solid var(--border-subtle)", margin: 0 }}>
                    {activeStudentDetail.notes || "No special remarks recorded."}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingClassStudent&&<div className="modal-backdrop-clean" onClick={()=>setEditingClassStudent(null)}><motion.div initial={{opacity:0,scale:.97}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.97}} className="modal-dialog-clean class-student-edit-dialog" onClick={event=>event.stopPropagation()}>
          <div className="modal-header-clean"><div><small>Class student profile</small><h3>Edit {editingClassStudent.fullName}</h3><p>{editingClassStudent.linkedStudentId?"CRM-linked identity fields are protected; class-specific information remains editable.":"Update personal and contact information for this external class student."}</p></div><button type="button" className="drawer-close-btn" onClick={()=>setEditingClassStudent(null)}><X size={18}/></button></div>
          <form onSubmit={saveClassStudentEdit}>
            <div className="class-student-edit-grid">
              <label>Full name *<input required readOnly={Boolean(editingClassStudent.linkedStudentId)} value={classStudentEditForm.fullName??""} onChange={event=>setClassStudentEditForm({...classStudentEditForm,fullName:event.target.value})}/></label>
              <label>Phone *<input required readOnly={Boolean(editingClassStudent.linkedStudentId)} value={classStudentEditForm.phone??""} onChange={event=>setClassStudentEditForm({...classStudentEditForm,phone:event.target.value})}/></label>
              <label>Email<input type="email" readOnly={Boolean(editingClassStudent.linkedStudentId)} value={classStudentEditForm.email??""} onChange={event=>setClassStudentEditForm({...classStudentEditForm,email:event.target.value})}/></label>
              <label>Gender<select disabled={Boolean(editingClassStudent.linkedStudentId)} value={classStudentEditForm.gender??"Other"} onChange={event=>setClassStudentEditForm({...classStudentEditForm,gender:event.target.value as ClassStudent["gender"]})}><option>Male</option><option>Female</option><option>Other</option></select></label>
              <label>Education level<input value={classStudentEditForm.educationLevel??""} onChange={event=>setClassStudentEditForm({...classStudentEditForm,educationLevel:event.target.value})}/></label>
              <label>Record status<select value={classStudentEditForm.recordStatus??"Active"} onChange={event=>setClassStudentEditForm({...classStudentEditForm,recordStatus:event.target.value as ClassStudent["recordStatus"]})}><option>Active</option><option>Completed</option><option>On Hold</option><option>Dropped</option></select></label>
              <label>Guardian name<input value={classStudentEditForm.guardianName??""} onChange={event=>setClassStudentEditForm({...classStudentEditForm,guardianName:event.target.value})}/></label>
              <label>Guardian phone<input value={classStudentEditForm.guardianPhone??""} onChange={event=>setClassStudentEditForm({...classStudentEditForm,guardianPhone:event.target.value})}/></label>
              <label className="wide">Address<textarea readOnly={Boolean(editingClassStudent.linkedStudentId)} value={classStudentEditForm.address??""} onChange={event=>setClassStudentEditForm({...classStudentEditForm,address:event.target.value})}/></label>
              <label className="wide">Notes<textarea value={classStudentEditForm.notes??""} onChange={event=>setClassStudentEditForm({...classStudentEditForm,notes:event.target.value})}/></label>
            </div>
            <div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setEditingClassStudent(null)}>Cancel</button><button type="submit" className="btn-primary">Save changes</button></div>
          </form>
        </motion.div></div>}
      </AnimatePresence>
    </div>
  );
}

export default ClassesWorkspace;
