import { supabase } from "../lib/supabase";

export type EmployeeMonthlyReportRow = {
  id: string;
  staffProfileId: string | null;
  employeeCode: string;
  fullName: string;
  department: string;
  role: string;
  photoUrl: string;
  presentDays: number;
  workedHours: number;
  lateArrivals: number;
  lateMinutes: number;
  tasksAssigned: number;
  tasksCompleted: number;
  targetsAssigned: number;
  targetProgress: number;
  leadsAssigned: number;
  conversions: number;
  applications: number;
  leadDetails: EmployeeLeadDetail[];
  applicationDetails: EmployeeApplicationDetail[];
  score: number;
};

export type EmployeeLeadDetail = {
  id: string;
  code: string;
  name: string;
  country: string;
  stage: string;
  createdAt: string;
};

export type EmployeeApplicationDetail = {
  id: string;
  university: string;
  course: string;
  country: string;
  stage: string;
  createdAt: string;
};

export type EmployeeMonthlyReport = {
  month: string;
  workingDaysElapsed: number;
  rows: EmployeeMonthlyReportRow[];
  totals: {
    employees: number;
    workedHours: number;
    lateArrivals: number;
    tasksCompleted: number;
    conversions: number;
    teamScore: number;
  };
  warnings: string[];
};

type LooseRow = Record<string, unknown>;
const textValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  const end = endDate.toISOString().slice(0, 10);
  const now = new Date();
  const elapsedEnd = year === now.getFullYear() && monthNumber === now.getMonth() + 1
    ? Math.min(now.getDate(), endDate.getUTCDate())
    : endDate.getUTCDate();
  let workingDaysElapsed = 0;
  for (let day = 1; day <= elapsedEnd; day += 1) {
    const weekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) workingDaysElapsed += 1;
  }
  return { start, end, endExclusive: new Date(Date.UTC(year, monthNumber, 1)).toISOString(), workingDaysElapsed };
}

function hoursBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function optionalQuery(name: string, promise: PromiseLike<{ data: unknown; error: unknown }>, warnings: string[]) {
  const { data, error } = await promise;
  if (error) {
    warnings.push(`${name} data is unavailable for your current access level.`);
    return [] as LooseRow[];
  }
  return (data ?? []) as LooseRow[];
}

export const EmployeeMonthlyReportService = {
  async get(month: string): Promise<EmployeeMonthlyReport> {
    const { start, end, endExclusive, workingDaysElapsed } = monthBounds(month);
    const warnings: string[] = [];
    const { data: employeesData, error: employeesError } = await supabase
      .from("hr_employees")
      .select("id,staff_profile_id,employee_code,full_name,department,job_title,employment_status,join_date")
      .neq("employment_status", "EXITED")
      .lte("join_date", end)
      .order("full_name");
    if (employeesError) throw employeesError;

    const [attendance, tasks, targets, leads, applications, profilePhotos] = await Promise.all([
      optionalQuery("Attendance", supabase.from("hr_attendance").select("employee_id,attendance_date,clock_in,clock_out,status,late_minutes").gte("attendance_date", start).lte("attendance_date", end), warnings),
      optionalQuery("Task", supabase.from("case_tasks").select("assigned_to,status,created_at,completed_at").lt("created_at", endExclusive).or(`completed_at.is.null,completed_at.gte.${start}T00:00:00Z`), warnings),
      optionalQuery("Target", supabase.from("hr_performance_targets").select("employee_id,target_value,achieved_value,status,period_start,period_end").lte("period_start", end).gte("period_end", start), warnings),
      optionalQuery("Lead", supabase.from("leads").select("id,lead_code,full_name,target_country,assigned_counsellor,stage,created_at").gte("created_at", `${start}T00:00:00Z`).lt("created_at", endExclusive), warnings),
      optionalQuery("Application", supabase.from("university_applications").select("id,university_name,course_name,country,stage,officer_id,created_at").gte("created_at", `${start}T00:00:00Z`).lt("created_at", endExclusive), warnings),
      optionalQuery("Profile photo", supabase.from("hr_staff_documents").select("employee_id,storage_path,created_at,mime_type").eq("document_type", "Profile Photo").order("created_at", { ascending: false }), warnings),
    ]);

    const latestPhotoPath = new Map<string, string>();
    for (const photo of profilePhotos) {
      const employeeId = textValue(photo.employee_id);
      const storagePath = textValue(photo.storage_path);
      if (employeeId && storagePath && !latestPhotoPath.has(employeeId) && textValue(photo.mime_type).startsWith("image/")) latestPhotoPath.set(employeeId, storagePath);
    }
    const signedPhotoEntries = await Promise.all([...latestPhotoPath].map(async ([employeeId, storagePath]) => {
      const { data, error } = await supabase.storage.from("hr-staff-documents").createSignedUrl(storagePath, 3600);
      return [employeeId, error ? "" : data.signedUrl] as const;
    }));
    const photoUrls = new Map(signedPhotoEntries);

    const rows = ((employeesData ?? []) as LooseRow[]).map(employee => {
      const employeeAttendance = attendance.filter(item => item.employee_id === employee.id);
      const employeeTasks = employee.staff_profile_id ? tasks.filter(item => item.assigned_to === employee.staff_profile_id) : [];
      const employeeTargets = targets.filter(item => item.employee_id === employee.id && item.status !== "CANCELLED");
      const employeeLeads = employee.staff_profile_id ? leads.filter(item => item.assigned_counsellor === employee.staff_profile_id) : [];
      const employeeApplications = employee.staff_profile_id ? applications.filter(item => item.officer_id === employee.staff_profile_id) : [];
      const presentDays = employeeAttendance.filter(item => ["PRESENT", "LATE", "HALF_DAY"].includes(textValue(item.status))).reduce((sum, item) => sum + (item.status === "HALF_DAY" ? 0.5 : 1), 0);
      const workedHours = employeeAttendance.reduce((sum, item) => sum + hoursBetween(textValue(item.clock_in) || null, textValue(item.clock_out) || null), 0);
      const lateArrivals = employeeAttendance.filter(item => item.status === "LATE" || Number(item.late_minutes) > 0).length;
      const lateMinutes = employeeAttendance.reduce((sum, item) => sum + Number(item.late_minutes ?? 0), 0);
      const tasksAssigned = employeeTasks.filter(item => item.status !== "CANCELLED").length;
      const tasksCompleted = employeeTasks.filter(item => {
        const completedDate = textValue(item.completed_at).slice(0, 10);
        return item.status === "COMPLETED" && completedDate >= start && completedDate <= end;
      }).length;
      const targetsAssigned = employeeTargets.length;
      const targetProgress = targetsAssigned
        ? employeeTargets.reduce((sum, item) => sum + Math.min(1, Number(item.achieved_value ?? 0) / Math.max(1, Number(item.target_value ?? 0))), 0) / targetsAssigned
        : 0;
      const conversions = employeeLeads.filter(item => item.stage === "CONVERTED").length;
      const attendanceScore = workingDaysElapsed ? Math.min(100, (presentDays / workingDaysElapsed) * 100) : 0;
      const taskScore = tasksAssigned ? (tasksCompleted / tasksAssigned) * 100 : 50;
      const targetScore = targetsAssigned ? targetProgress * 100 : 50;
      const contributionScore = Math.min(100, employeeLeads.length * 5 + conversions * 30 + employeeApplications.length * 20);

      return {
        id: textValue(employee.id),
        staffProfileId: textValue(employee.staff_profile_id) || null,
        employeeCode: textValue(employee.employee_code, "—"),
        fullName: textValue(employee.full_name, "Unknown employee"),
        department: textValue(employee.department, "Unassigned department"),
        role: textValue(employee.job_title, "Staff member"),
        photoUrl: photoUrls.get(textValue(employee.id)) ?? "",
        presentDays,
        workedHours: Number(workedHours.toFixed(1)),
        lateArrivals,
        lateMinutes,
        tasksAssigned,
        tasksCompleted,
        targetsAssigned,
        targetProgress: Math.round(targetProgress * 100),
        leadsAssigned: employeeLeads.length,
        conversions,
        applications: employeeApplications.length,
        leadDetails: employeeLeads.map(item => ({
          id: textValue(item.id),
          code: textValue(item.lead_code, "Lead"),
          name: textValue(item.full_name, "Unnamed lead"),
          country: textValue(item.target_country, "Destination pending"),
          stage: textValue(item.stage, "NEW_INQUIRY"),
          createdAt: textValue(item.created_at),
        })),
        applicationDetails: employeeApplications.map(item => ({
          id: textValue(item.id),
          university: textValue(item.university_name, "University pending"),
          course: textValue(item.course_name, "Course pending"),
          country: textValue(item.country, "Destination pending"),
          stage: textValue(item.stage, "DRAFT"),
          createdAt: textValue(item.created_at),
        })),
        score: clampScore(attendanceScore * 0.3 + taskScore * 0.25 + targetScore * 0.25 + contributionScore * 0.2),
      } satisfies EmployeeMonthlyReportRow;
    });

    return {
      month,
      workingDaysElapsed,
      rows,
      totals: {
        employees: rows.length,
        workedHours: Number(rows.reduce((sum, row) => sum + row.workedHours, 0).toFixed(1)),
        lateArrivals: rows.reduce((sum, row) => sum + row.lateArrivals, 0),
        tasksCompleted: rows.reduce((sum, row) => sum + row.tasksCompleted, 0),
        conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
        teamScore: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0,
      },
      warnings: [...new Set(warnings)],
    };
  },
};
