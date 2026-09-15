import { useEffect,useMemo,useState } from "react";
import { Download,FileBarChart,Search } from "lucide-react";
import { HrmsConfigurationService,type HrConfigRow,type HrReportKey } from "../../services/hrmsConfigurationService";
import { notifyError } from "../../components/common/CrmNotifications";

const keys:HrReportKey[]=["employee","attendance","leave","payroll","salary","performance","kpi","appraisal","workforce"];
const title=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,char=>char.toUpperCase());
const csvValue=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;

export function HrmsReportsWorkspace(){
  const[catalog,setCatalog]=useState<HrConfigRow[]>([]),[active,setActive]=useState<HrReportKey>("employee"),[rows,setRows]=useState<Record<string,unknown>[]>([]),[loading,setLoading]=useState(true),[query,setQuery]=useState("");
  useEffect(()=>{void HrmsConfigurationService.getReportCatalog().then(setCatalog).catch(error=>notifyError("Report catalog unavailable",error instanceof Error?error.message:"Unable to load HR reports"))},[]);
  useEffect(()=>{setLoading(true);void HrmsConfigurationService.runReport(active).then(setRows).catch(error=>{setRows([]);notifyError("Report unavailable",error instanceof Error?error.message:"Unable to generate report")}).finally(()=>setLoading(false))},[active]);
  const filtered=useMemo(()=>rows.filter(row=>Object.values(row).some(value=>String(value??"").toLowerCase().includes(query.toLowerCase()))),[rows,query]);
  const columns=useMemo(()=>Object.keys(filtered[0]??rows[0]??{}),[filtered,rows]);
  const download=()=>{if(!columns.length)return;const csv=[columns.map(csvValue).join(","),...filtered.map(row=>columns.map(column=>csvValue(row[column])).join(","))].join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`hrms-${active}-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url)};
  return <div className="page-container">
    <section className="page-heading"><div><p className="eyebrow">Human resources intelligence</p><h2>HRMS Reports Centre</h2><p>Nine live report groups generated from the same controlled HRMS operational records.</p></div><button className="btn-secondary" type="button" onClick={download} disabled={!filtered.length}><Download size={15}/>Export CSV</button></section>
    <section className="panel" style={{overflow:"hidden"}}><div style={{display:"flex",gap:8,padding:14,borderBottom:"1px solid var(--border-subtle)",overflowX:"auto"}}>{keys.map(key=><button key={key} type="button" className={active===key?"filter-chip active":"filter-chip"} onClick={()=>setActive(key)}>{String(catalog.find(item=>item.report_key===key)?.name??title(key))}</button>)}</div>
      <div className="directory-tools" style={{padding:14}}><div className="search large"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${title(active)} report…`}/></div><span className="status-pill">{filtered.length} records</span></div>
      <div className="table-wrapper"><table className="crm-table"><thead><tr>{columns.map(column=><th key={column}>{title(column)}</th>)}</tr></thead><tbody>{filtered.map((row,index)=><tr key={String(row.id??`${active}-${index}`)}>{columns.map(column=><td key={column}>{format(row[column])}</td>)}</tr>)}{!loading&&!filtered.length&&<tr><td colSpan={Math.max(columns.length,1)}><div style={{display:"grid",placeItems:"center",padding:44,gap:8}}><FileBarChart size={28}/><strong>No report records found</strong><span>Operational data will appear here automatically.</span></div></td></tr>}</tbody></table></div>
    </section>
  </div>;
}
function format(value:unknown){if(value===null||value===undefined||value==="")return "—";if(typeof value==="number")return value.toLocaleString();if(typeof value==="boolean")return value?"Yes":"No";if(typeof value==="object")return JSON.stringify(value);return String(value)}
export default HrmsReportsWorkspace;
