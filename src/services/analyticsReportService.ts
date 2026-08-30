import { supabase } from "../lib/supabase";

export type LiveReportDefinition={key:string;name:string;category:string;description:string};
export type LiveReportResult={key:string;name:string;rows:Array<Record<string,unknown>>};
export type FunnelStage={key:string;label:string;count:number;note:string;color:string};

const reportName:Record<string,string>={lead_pipeline:"Lead Pipeline",application_pipeline:"Application Pipeline",finance_summary:"Finance Summary",staff_attendance:"Staff Attendance"};

export const AnalyticsReportService={
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
