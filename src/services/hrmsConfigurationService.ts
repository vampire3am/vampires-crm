import { supabase } from "../lib/supabase";

export type HrConfigRow = Record<string, unknown> & { id: string };
export type HrReportKey = "employee"|"attendance"|"leave"|"payroll"|"salary"|"performance"|"kpi"|"appraisal"|"workforce";

const reportViews: Record<HrReportKey,string> = {
  employee:"hr_report_employee", attendance:"hr_report_attendance", leave:"hr_report_leave",
  payroll:"hr_report_payroll", salary:"hr_report_salary", performance:"hr_report_performance",
  kpi:"hr_report_kpi", appraisal:"hr_report_appraisal", workforce:"hr_report_workforce",
};

async function list(table:string,order="created_at") {
  const {data,error}=await supabase.from(table).select("*").order(order,{ascending:true});
  if(error)throw error;
  return (data??[]) as HrConfigRow[];
}
async function insert(table:string,payload:Record<string,unknown>) {
  const {data,error}=await supabase.from(table).insert(payload).select("*").single();
  if(error)throw error;
  return data as HrConfigRow;
}
async function update(table:string,id:string,payload:Record<string,unknown>) {
  const {data,error}=await supabase.from(table).update(payload).eq("id",id).select("*").single();
  if(error)throw error;
  return data as HrConfigRow;
}
async function remove(table:string,id:string,key=table==="hr_leave_policies"?"leave_type":"id") {
  const {error}=await supabase.from(table).delete().eq(key,id);
  if(error)throw error;
}

export const HrmsConfigurationService={
  list,
  insert,
  update,
  remove,
  async loadSettings(){
    const tables=["hr_employees","hr_departments","hr_designations","hr_employee_number_settings","hr_attendance_policies","hr_leave_policies","hr_salary_component_definitions","hr_payroll_policies","hr_tax_rule_sets","hr_tax_brackets","hr_kpi_templates","hr_appraisal_cycles","hr_document_types","hr_contracts","hr_approval_routes","hr_approval_route_steps","hr_notification_rules"];
    const orderBy:Record<string,string>={hr_employee_number_settings:"updated_at",hr_leave_policies:"leave_type"};
    const results=await Promise.all(tables.map(async table=>{
      try{return [table,await list(table,orderBy[table]??"created_at")] as const}
      catch(error){
        console.warn(`HRMS configuration source ${table} is not available yet`,error);
        return [table,[] as HrConfigRow[]] as const;
      }
    }));
    return Object.fromEntries(results.map(([table,rows])=>[table,rows.map(row=>({...row,id:String(row.id??row.leave_type),_table:table,_key:row.id===undefined?"leave_type":"id"}))])) as Record<string,HrConfigRow[]>;
  },
  async updateNumbering(payload:Record<string,unknown>){
    const {data,error}=await supabase.from("hr_employee_number_settings").update({...payload,updated_at:new Date().toISOString()}).eq("id",true).select("*").single();
    if(error)throw error; return data as HrConfigRow;
  },
  async setRuleStatus(table:"hr_attendance_policies"|"hr_payroll_policies"|"hr_tax_rule_sets",id:string,status:"DRAFT"|"ACTIVE"|"RETIRED"){
    if(status==="ACTIVE"){
      const {error:retireError}=await supabase.from(table).update({status:"RETIRED"}).eq("status","ACTIVE").neq("id",id);
      if(retireError)throw retireError;
    }
    const payload:Record<string,unknown>={status};
    if(status==="ACTIVE")payload.approved_at=new Date().toISOString();
    return update(table,id,payload);
  },
  async getReportCatalog(){
    try{return await list("hr_report_catalog","category")}
    catch{return ([
      ["employee","Employee Reports","Employee master, employment state and organization placement."],
      ["attendance","Attendance Reports","Daily and monthly attendance, lateness and worked hours."],
      ["leave","Leave Reports","Leave balances, requests, decisions and utilization."],
      ["payroll","Payroll Reports","Payroll runs, totals and payment status."],
      ["salary","Salary Reports","Effective-dated salary and compensation history."],
      ["performance","Performance Reports","Performance targets and review outcomes."],
      ["kpi","KPI Reports","KPI assignments, achievement and completion."],
      ["appraisal","Appraisal Reports","Appraisal cycles and employee ratings."],
      ["workforce","Workforce Reports","Department and employment-status composition."],
    ] as const).map(([report_key,name,description])=>({id:report_key,report_key,name,description,category:report_key.toUpperCase()}))}
  },
  async runReport(key:HrReportKey){
    const {data,error}=await supabase.from(reportViews[key]).select("*").limit(5000);
    if(error)throw error;
    return (data??[]) as Record<string,unknown>[];
  },
  async getTdsLedger(){return list("hr_tds_ledger","period_start")},
};
