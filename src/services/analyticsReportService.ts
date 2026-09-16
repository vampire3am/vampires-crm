import { supabase } from "../lib/supabase";
import { REPORT_CATALOGUE, reportKey } from "../features/analytics/reportCatalogue";

export type LiveReportDefinition={key:string;name:string;category:string;description:string};
export type LiveReportResult={key:string;name:string;rows:Array<Record<string,unknown>>};
export type FunnelStage={key:string;label:string;count:number;note:string;color:string};
export type ReportFilters={query?:string;dateFrom?:string;dateTo?:string;status?:string;country?:string};
export type CatalogueReportResult=LiveReportResult&{categoryId:number;categoryName:string;generatedAt:string;source:string;filters:ReportFilters};

const reportName:Record<string,string>={lead_pipeline:"Lead Pipeline",application_pipeline:"Application Pipeline",finance_summary:"Finance Summary",staff_attendance:"Staff Attendance"};

const categorySources:Record<number,string[]>={
  1:["leads","students","university_applications","visa_tracking","student_invoices"],2:["leads","students","counselling_records","university_applications","mock_test_bookings"],3:["leads","lead_follow_ups","lead_activities"],4:["students"],5:["students","counselling_records","university_applications","visa_tracking"],6:["counselling_records"],7:["university_applications","application_events"],8:["study_destination_catalog","course_shortlists","university_applications"],9:["university_applications"],10:["visa_tracking","university_applications"],11:["mock_test_bookings"],12:["class_students","test_prep_batches","batch_enrollments"],13:["student_invoices"],14:["documents","document_activity","case_tasks"],15:["study_destination_catalog","university_applications","visa_tracking"],16:["university_applications","study_destination_catalog"],17:["b2b_partners","students"],18:["university_applications","study_destination_catalog"],19:["communication_messages","staff_voice_calls","email_delivery_logs"],20:["leads"],21:["students","leads"],22:["student_invoices","finance_journals"],23:["student_invoices","finance_journals"],24:["hr_salary_components","student_invoices"],25:["staff_assignments","case_tasks","lead_follow_ups"],
  37:["chart_of_accounts","finance_journals","finance_journal_lines"],38:["finance_journals","finance_journal_lines"],39:["student_invoices"],40:["finance_expenses","finance_journals"],41:["finance_journals","finance_journal_lines"],42:["finance_expenses","finance_journals"],43:["finance_journals","finance_journal_lines"],44:["chart_of_accounts","finance_journal_lines"],45:["chart_of_accounts","finance_journal_lines"],46:["chart_of_accounts","finance_journal_lines"],47:["finance_journals","finance_journal_lines"],48:["finance_budgets","finance_journals"],49:["finance_journals","finance_journal_lines","hr_tds_ledger"],50:["finance_assets"],51:["chart_of_accounts","finance_journal_lines"],52:["documents","university_applications","hr_contracts"],53:["audit_logs","report_exports","email_delivery_logs"],54:["leads","students","university_applications","visa_tracking","student_invoices"],55:["report_exports","audit_logs"],
};

const semanticTableRules:Array<[RegExp,string[]]> = [
  [/audit|modification|deleted record|security activity|approval history|system error|user activity|login history/i,["audit_logs"]],
  [/report export|export history/i,["report_exports"]],
  [/email/i,["email_delivery_logs"]],
  [/call|unanswered communication/i,["staff_voice_calls"]],
  [/communication|whatsapp|sms|message/i,["communication_messages"]],
  [/document|compliance|agreement|consent|expiry/i,["documents","document_activity"]],
  [/visa/i,["visa_tracking"]],
  [/offer|application|admission|institution|university|course|intake/i,["university_applications"]],
  [/counsell/i,["counselling_records"]],
  [/lead|enquiry|campaign|marketing|facebook|instagram|website|acquisition/i,["leads","lead_follow_ups"]],
  [/student|retention|re-engagement|returning/i,["students"]],
  [/test|ielts|pte|duolingo|exam/i,["mock_test_bookings"]],
  [/class|batch|training|instructor/i,["class_students","test_prep_batches","batch_enrollments"]],
  [/partner|referral/i,["b2b_partners"]],
  [/task|productivity|workload|sla|employee activity|pending work/i,["staff_assignments","case_tasks","lead_follow_ups"]],
  [/asset/i,["finance_assets"]],
  [/budget|variance/i,["finance_budgets"]],
  [/expense|payable|vendor/i,["finance_expenses","finance_journals"]],
  [/receivable|payment|collection|sales|refund|income|revenue|service|package/i,["student_invoices","finance_journals"]],
  [/tax|vat|tds/i,["finance_journals","hr_tds_ledger"]],
  [/account|cash|bank|journal|ledger|trial balance|profit|loss|balance sheet|cash flow|financial statement|equity|net worth/i,["chart_of_accounts","finance_journal_lines","finance_journals"]],
];
const sourcesForReport=(categoryId:number,name:string)=>{
  if(categoryId===1||categoryId===2||categoryId===54)return categorySources[categoryId];
  const matched=semanticTableRules.find(([pattern])=>pattern.test(name));
  return matched?.[1]??categorySources[categoryId]??[];
};

const normalizeRows=(table:string,rows:Record<string,unknown>[])=>rows.map(row=>({source:table.replaceAll("_"," "),...row}));
const rowDate=(row:Record<string,unknown>)=>String(row.created_at??row.updated_at??row.attendance_date??row.expense_date??row.issued_at??row.date??"").slice(0,10);
const matchesFilters=(row:Record<string,unknown>,filters:ReportFilters)=>{
  const text=JSON.stringify(row).toLowerCase(),date=rowDate(row);
  if(filters.query&&!text.includes(filters.query.toLowerCase()))return false;
  if(filters.status&&!text.includes(filters.status.toLowerCase()))return false;
  if(filters.country&&!text.includes(filters.country.toLowerCase()))return false;
  if(filters.dateFrom&&date&&date<filters.dateFrom)return false;
  if(filters.dateTo&&date&&date>filters.dateTo)return false;
  return true;
};

const fieldFor=(row:Record<string,unknown>,words:string[])=>Object.keys(row).find(key=>words.some(word=>key.toLowerCase().includes(word)));
const amountFieldFor=(row:Record<string,unknown>)=>fieldFor(row,["amount","total","revenue","paid","balance","debit","credit"]);
const amountFor=(row:Record<string,unknown>)=>{const key=amountFieldFor(row);return key?Number(row[key]??0)||0:0};
function specializeRows(name:string,input:Record<string,unknown>[]){
  let rows=[...input];const lower=name.toLowerCase(),today=new Date().toISOString().slice(0,10),month=today.slice(0,7);
  if(lower.includes("daily ")||lower.startsWith("daily"))rows=rows.filter(row=>rowDate(row)===today);
  if(lower.includes("monthly ")||lower.startsWith("monthly"))rows=rows.filter(row=>rowDate(row).startsWith(month));
  if(lower.includes("new "))rows=rows.filter(row=>rowDate(row).startsWith(month));
  const states:Array<[string,string[]]>= [["inactive",["inactive","closed"]],["active",["active","open","in_progress"]],["lost",["lost"]],["pending",["pending","draft","under_review","queued"]],["submitted",["submitted"]],["approved",["approved","granted","completed","paid"]],["granted",["granted","approved"]],["refused",["refused","rejected"]],["rejected",["rejected","refused"]],["completed",["completed","approved","paid"]],["cancel",["cancelled","canceled"]],["overdue",["overdue"]]];
  const state=states.find(([term])=>lower.includes(term));
  if(state)rows=rows.filter(row=>{const value=JSON.stringify(row).toLowerCase();if(state[0]==="overdue"){const due=String(row.due_at??row.due_date??row.expires_on??"").slice(0,10);return Boolean(due&&due<today&&!value.includes("completed")&&!value.includes("paid"))}return state[1].some(value.includes.bind(value))});
  if(lower.includes("aging")||lower.includes("processing time"))rows=rows.map(row=>{const date=rowDate(row);return{...row,age_days:date?Math.max(0,Math.floor((Date.now()-new Date(`${date}T00:00:00`).getTime())/86_400_000)):null}});
  const dimensions:Array<[string,string[]]>= [["country",["country","destination"]],["source",["source"]],["status",["status","stage"]],["employee",["employee","staff","assigned_to","created_by","owner","officer","counsellor"]],["department",["department"]],["institution",["institution","university"]],["course",["course","program"]],["intake",["intake"]],["service",["service","category"]],["payment method",["payment_method","method"]],["branch",["branch"]],["category",["category","type"]]];
  const dimension=dimensions.find(([term])=>lower.includes(`by ${term}`)||lower.includes(`${term}-wise`)||lower.startsWith(`${term} `));
  if(dimension&&rows.length){const key=fieldFor(rows[0],dimension[1]);if(key){const grouped=new Map<string,{count:number;amount:number}>();for(const row of rows){const value=displayGroup(row[key]);const current=grouped.get(value)??{count:0,amount:0};current.count++;current.amount+=amountFor(row);grouped.set(value,current)}return[...grouped].map(([value,totals])=>({[key]:value,record_count:totals.count,total_amount:totals.amount}))}}
  if(/conversion|success rate|refusal rate|offer rate|acceptance rate|retention rate|achievement|utilization|percentage|margin/i.test(lower)){
    const statusKey=rows[0]&&fieldFor(rows[0],["status","stage","outcome"]);const successful=/refusal/i.test(lower)?["refused","rejected"]:/conversion/i.test(lower)?["converted","completed","approved","granted","enrolled","paid"]:["approved","granted","completed","paid","active"];
    const matched=statusKey?rows.filter(row=>successful.some(token=>String(row[statusKey]??"").toLowerCase().includes(token))).length:0;
    return[{metric:name,total_records:rows.length,matching_records:matched,rate_percent:rows.length?Number((matched/rows.length*100).toFixed(2)):0}];
  }
  if(/summary|dashboard|overview|position|business growth|comparison|forecast|trend analysis|management alerts/i.test(lower)){
    const grouped=new Map<string,{count:number;amount:number;hasAmount:boolean}>();for(const row of rows){const source=String(row.source??"operational records");const current=grouped.get(source)??{count:0,amount:0,hasAmount:false};current.count++;current.amount+=amountFor(row);current.hasAmount||=Boolean(amountFieldFor(row));grouped.set(source,current)}
    return[...grouped].map(([source,total])=>({source,record_count:total.count,...(total.hasAmount?{total_amount:Number(total.amount.toFixed(2))}:{})}));
  }
  return rows;
}
const displayGroup=(value:unknown)=>value===null||value===undefined||value===""?"Unspecified":String(value);

async function readFirstAvailable(tables:string[]){
  const collected:Record<string,unknown>[]=[];const used:string[]=[];
  for(const table of tables){const{data,error}=await supabase.from(table).select("*").limit(1000);if(!error){used.push(table);collected.push(...normalizeRows(table,(data??[]) as Record<string,unknown>[]))}}
  return{rows:collected,source:used.length?used.join(", "):"No compatible operational source is installed"};
}

export const AnalyticsReportService={
  async runCatalogueReport(categoryId:number,name:string,filters:ReportFilters={}):Promise<CatalogueReportResult>{
    const category=REPORT_CATALOGUE.find(item=>item.id===categoryId);if(!category||!category.reports.includes(name))throw new Error("Unknown report selection.");
    const result=await readFirstAvailable(sourcesForReport(categoryId,name));const rows=specializeRows(name,result.rows).filter(row=>matchesFilters(row,filters));
    void supabase.rpc("log_report_activity",{report_key:reportKey(categoryId,name),activity:"VIEW",activity_filters:filters}).then(()=>{},()=>{});
    return{key:reportKey(categoryId,name),name,categoryId,categoryName:category.name,rows,source:result.source,generatedAt:new Date().toISOString(),filters};
  },
  async logExport(key:string,format:"CSV"|"XLSX"|"PDF",filters:ReportFilters){void supabase.rpc("log_report_activity",{report_key:key,activity:`EXPORT_${format}`,activity_filters:filters}).then(()=>{},()=>{})},
  async getDefinitions():Promise<LiveReportDefinition[]>{const{data,error}=await supabase.from("report_definitions").select("report_key,name,category,description").eq("is_active",true).order("category").order("name");if(error)throw error;return(data??[]).map(item=>({key:item.report_key,name:item.name,category:item.category,description:item.description??""}))},
  async run(key:string):Promise<LiveReportResult>{let result:{data:unknown[]|null;error:unknown};switch(key){case"lead_pipeline":result=await supabase.from("report_lead_pipeline").select("*");break;case"application_pipeline":result=await supabase.from("report_application_pipeline").select("*");break;case"finance_summary":result=await supabase.from("report_finance_summary").select("*");break;case"staff_attendance":result=await supabase.from("report_staff_attendance").select("*").order("attendance_date",{ascending:false}).limit(500);break;default:throw new Error("This report does not have a live data source.")}if(result.error)throw result.error;return{key,name:reportName[key]??"CRM Report",rows:(result.data??[]) as Array<Record<string,unknown>>}},
  async getSummary():Promise<Record<string,number>>{const{data,error}=await supabase.rpc("management_dashboard_summary");if(error)throw error;const row=(data??{}) as Record<string,unknown>;return{students:Number(row.students??0),leads:Number(row.leads??0),counselling:Number(row.counselling??0),offers:Number(row.offers??0),visaRatio:Number(row.visa_ratio??0),monthRevenue:Number(row.month_revenue??0),pendingTasks:Number(row.pending_tasks??0)}},
  async getFunnel():Promise<FunnelStage[]>{const[leads,counselling,applications,offers,visaSubmitted,visaApproved]=await Promise.all([supabase.from("leads").select("id",{count:"exact",head:true}),supabase.from("counselling_records").select("id",{count:"exact",head:true}),supabase.from("university_applications").select("id",{count:"exact",head:true}).neq("stage","DRAFT"),supabase.from("university_applications").select("id",{count:"exact",head:true}).in("stage",["CONDITIONAL_OFFER","UNCONDITIONAL_OFFER","CAS_ISSUED","VISA_LODGED","VISA_APPROVED","ENROLLED"]),supabase.from("visa_tracking").select("id",{count:"exact",head:true}).in("visa_status",["SUBMITTED","APPROVED"]),supabase.from("visa_tracking").select("id",{count:"exact",head:true}).eq("visa_status","APPROVED")]);const failure=[leads,counselling,applications,offers,visaSubmitted,visaApproved].find(item=>item.error);if(failure?.error)throw failure.error;return[
    {key:"leads",label:"Initial leads and enquiries",count:leads.count??0,note:"Live lead records entered in the CRM",color:"#f97316"},
    {key:"counselling",label:"Counselling completed",count:counselling.count??0,note:"Recorded student counselling sessions",color:"#fb923c"},
    {key:"applications",label:"University applications submitted",count:applications.count??0,note:"Applications beyond draft stage",color:"#0ea5e9"},
    {key:"offers",label:"Offers and post-offer cases",count:offers.count??0,note:"Conditional offer through enrolment",color:"#8b5cf6"},
    {key:"visa_submitted",label:"Visa applications submitted",count:visaSubmitted.count??0,note:"Submitted and approved visa records",color:"#10b981"},
    {key:"visa_approved",label:"Visa approvals",count:visaApproved.count??0,note:"Approved visa outcomes",color:"#047857"},
  ]},
};
