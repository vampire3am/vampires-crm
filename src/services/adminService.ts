import { supabase } from "../lib/supabase";

export type OrganizationForm={legalName:string;tagline:string;regNo:string;panVat:string;timezone:string;fiscalYear:string;currency:string;address:string;phone:string;email:string};
export type LiveRoleMatrix={role:string;permissions:string[]};

export const AdminService={
  async getOrganization(){const{data,error}=await supabase.from("organizations").select("*").order("updated_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data?{legalName:data.legal_name,tagline:data.tagline??"",regNo:data.registration_no??"",panVat:data.pan_vat??"",timezone:data.timezone,fiscalYear:data.fiscal_year??"",currency:data.currency,address:data.address??"",phone:data.phone??"",email:data.email??""}:null},
  async saveOrganization(form:OrganizationForm){const{error}=await supabase.rpc("save_organization",{payload:{legal_name:form.legalName,tagline:form.tagline,registration_no:form.regNo,pan_vat:form.panVat,timezone:form.timezone,fiscal_year:form.fiscalYear,currency:form.currency,address:form.address,phone:form.phone,email:form.email}});if(error)throw error},
  async getCounts(){const[branches,roles,audits,staff]=await Promise.all([supabase.from("branches").select("id",{count:"exact",head:true}).eq("is_active",true),supabase.from("permissions").select("role"),supabase.from("audit_logs").select("id",{count:"exact",head:true}),supabase.from("staff_profiles").select("id",{count:"exact",head:true}).eq("is_active",true)]);const error=branches.error||roles.error||audits.error||staff.error;if(error)throw error;return{branches:branches.count??0,roles:new Set((roles.data??[]).map(p=>p.role)).size,audits:audits.count??0,staff:staff.count??0}},
  async getRoleMatrix():Promise<LiveRoleMatrix[]>{const{data,error}=await supabase.from("permissions").select("role,permission_name").eq("enabled",true).order("role").order("permission_name");if(error)throw error;const grouped=new Map<string,string[]>();for(const item of data??[])grouped.set(item.role,[...(grouped.get(item.role)??[]),item.permission_name]);return[...grouped].map(([role,permissions])=>({role,permissions}))},
};
