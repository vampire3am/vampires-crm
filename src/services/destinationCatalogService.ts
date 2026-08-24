import { supabase } from "../lib/supabase";
import type { DestinationCatalog } from "../features/counselling/CounsellingDashboard";

type DestinationRow = {
  code:string; name:string; currency:string; dial_code:string; region:DestinationCatalog["region"];
  universities_count:number; courses_count:number; active_processing:number; visas_approved:number;
  visa_success_rate:string; avg_tuition:string; avg_living_cost:string; pswv_work_rights:string;
  accepted_english_tests:string[]; popular_intakes:string[]; intake_cycles:string[]; key_highlights:string;
};

const mapRow=(row:DestinationRow):DestinationCatalog=>({
  code:row.code,name:row.name,currency:row.currency,dialCode:row.dial_code,region:row.region,
  universitiesCount:row.universities_count,coursesCount:row.courses_count,activeProcessing:row.active_processing,
  visasApproved:row.visas_approved,visaSuccessRate:row.visa_success_rate,avgTuition:row.avg_tuition,
  avgLivingCost:row.avg_living_cost,pswvWorkRights:row.pswv_work_rights,
  acceptedEnglishTests:row.accepted_english_tests??[],popularIntakes:row.popular_intakes??[],
  intakeCycles:row.intake_cycles??[],keyHighlights:row.key_highlights,
});

const payload=(item:DestinationCatalog)=>({
  code:item.code,name:item.name,currency:item.currency,dial_code:item.dialCode,region:item.region,
  universities_count:item.universitiesCount,courses_count:item.coursesCount,active_processing:item.activeProcessing,
  visas_approved:item.visasApproved,visa_success_rate:item.visaSuccessRate,avg_tuition:item.avgTuition,
  avg_living_cost:item.avgLivingCost,pswv_work_rights:item.pswvWorkRights,
  accepted_english_tests:item.acceptedEnglishTests,popular_intakes:item.popularIntakes,
  intake_cycles:item.intakeCycles,key_highlights:item.keyHighlights,
});

const migrationPending=(error:{code?:string;message?:string})=>
  ["42P01","42883","PGRST202","PGRST205"].includes(error.code??"")||
  /study_destination_catalog|save_study_destination|delete_study_destination/i.test(error.message??"");

export const DestinationCatalogService={
  async list(){const{data,error}=await supabase.from("study_destination_catalog").select("*").order("name");if(error){if(migrationPending(error))return[];throw error}return((data??[])as DestinationRow[]).map(mapRow)},
  async save(item:DestinationCatalog){const{error}=await supabase.rpc("save_study_destination",{payload:payload(item)});if(error&&!migrationPending(error))throw error},
  async saveMany(items:DestinationCatalog[]){for(const item of items)await this.save(item)},
  async remove(code:string){const{error}=await supabase.rpc("delete_study_destination",{destination_code:code});if(error&&!migrationPending(error))throw error},
};
