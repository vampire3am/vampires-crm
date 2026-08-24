import { ArrowLeft, ArrowRight, Check, Globe2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { FancySelect } from "../components/shared/FancySelect";

const classTypes = ["IELTS", "PTE", "DET", "GERMAN_LANGUAGE"];
const classModes = ["PHYSICAL", "ONLINE", "HYBRID"];
const countries = ["Australia", "UK", "USA", "New Zealand", "Canada", "Germany", "Finland", "Malta", "Cyprus", "Sweden", "Belgium", "Hungary", "Netherlands", "Ireland", "Japan", "South Korea"];
const labels: Record<string,string> = { DET:"Duolingo English Test (DET)", GERMAN_LANGUAGE:"German Language", PHYSICAL:"Physical", ONLINE:"Online", HYBRID:"Hybrid" };
const initial = { full_name:"", whatsapp:"", email:"", class_type:"", class_mode:"", current_level:"", needs_counselling:"", preferred_country:"", message:"", consent:false, website:"" };
type State = typeof initial;

function ClassBadge({ type }: { type: string }) {
  const text = type === "GERMAN_LANGUAGE" ? "DE" : type;
  return <span className={`class-brand-badge ${type.toLowerCase()}`}>{text}</span>;
}

function PublicServiceFooter(){return <footer className="service-footer"><div><strong>Abroad Education Consultancy Services</strong><span>Find us online and stay connected.</span></div><nav aria-label="Find AECS online"><a href="https://aecsnepal.com/" target="_blank" rel="noreferrer" aria-label="Visit the AECS website" title="Website"><Globe2/></a><a href="https://www.facebook.com/abroadeducation.np" target="_blank" rel="noreferrer" aria-label="Follow AECS on Facebook" title="Facebook"><FacebookLogo/></a><a href="https://www.tiktok.com/@aecsnepal" target="_blank" rel="noreferrer" aria-label="Follow AECS on TikTok" title="TikTok"><TikTokLogo/></a><a href="https://www.instagram.com/abroadeducation.np/" target="_blank" rel="noreferrer" aria-label="Follow AECS on Instagram" title="Instagram"><InstagramLogo/></a></nav><small>© {new Date().getFullYear()} AECS. Your information is handled securely.</small></footer>}

function FacebookLogo(){return <svg className="footer-brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 21v-8h2.8l.4-3.1h-3.2v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.7-.1-1.5-.2-2.3-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H8V13h2.6v8h3.1Z"/></svg>}
function TikTokLogo(){return <svg className="footer-brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.3 3c.3 2.1 1.5 3.4 3.7 3.6v3.1a7.8 7.8 0 0 1-3.6-1v6.1a6.1 6.1 0 1 1-5.3-6v3.2a3 3 0 1 0 2.1 2.8V3h3.1Z"/></svg>}
function InstagramLogo(){return <svg className="footer-brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M7.2 2.8h9.6a4.4 4.4 0 0 1 4.4 4.4v9.6a4.4 4.4 0 0 1-4.4 4.4H7.2a4.4 4.4 0 0 1-4.4-4.4V7.2a4.4 4.4 0 0 1 4.4-4.4Zm0 2.2A2.2 2.2 0 0 0 5 7.2v9.6A2.2 2.2 0 0 0 7.2 19h9.6a2.2 2.2 0 0 0 2.2-2.2V7.2A2.2 2.2 0 0 0 16.8 5H7.2Zm9.95 1.35a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM12 7.3a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 2.2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/></svg>}

export function ClassEnquiryForm({ onBack }: { onBack: () => void }) {
  const [step,setStep] = useState(0);
  const [form,setForm] = useState<State>(initial);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [done,setDone] = useState("");
  const set = <K extends keyof State>(key:K,value:State[K]) => { setForm(current => ({...current,[key]:value})); setError(""); };
  const levelOptions = form.class_type === "GERMAN_LANGUAGE" ? ["A1","A2","B1"] : ["BASIC","INTERMEDIATE","ADVANCED"];

  function missingFields() {
    const missing:string[]=[];
    const need=(key:keyof State,label:string)=>{if(!String(form[key]).trim())missing.push(label)};
    if(step===0){need("full_name","Full name");need("whatsapp","WhatsApp number");need("email","Email address");if(form.whatsapp.length!==10)missing.push("a 10-digit WhatsApp number");if(form.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))missing.push("a valid email address")}
    if(step===1){need("class_type","Class");need("class_mode","Class mode")}
    if(step===2)need("current_level","Current level");
    if(step===3){need("needs_counselling","Counselling preference");if(form.needs_counselling==="true")need("preferred_country","Preferred country");if(!form.consent)missing.push("Consent confirmation")}
    return [...new Set(missing)];
  }

  function next(){const missing=missingFields();if(missing.length){setError(`Please complete: ${missing.join(", ")}.`);return}setError("");setStep(value=>value+1);window.scrollTo({top:0,behavior:"smooth"})}
  function previous(){setError("");if(step===0)onBack();else setStep(value=>value-1)}
  async function submit(){const missing=missingFields();if(missing.length){setError(`Please complete: ${missing.join(", ")}.`);return}setBusy(true);setError("");const{supabase}=await import("../lib/supabase");const{data,error:submitError}=await supabase.rpc("submit_class_enquiry",{payload:{...form,needs_counselling:form.needs_counselling==="true"}});if(submitError)setError(submitError.message);else setDone(data.enquiry_code);setBusy(false)}

  if(done)return <main className="public-register thank-you-page class-thank-you"><section className="public-success thank-you-card class-success"><div className="success-check"><Check/></div><p className="eyebrow">Class enquiry received</p><h1>Thank you for your interest in AECS classes!</h1><p>Your information has been submitted securely. Our class coordinator will review your preferences and contact you shortly with schedules, fees and the next available intake.</p><button className="secondary-button" onClick={onBack}>Submit another enquiry</button></section><PublicServiceFooter/></main>;

  const titles=["Your information","Class preference","Current level","Counselling & consent"];
  return <main className="public-register class-enquiry-page"><section className="public-registration-card">
    <header><div className="public-brand"><span className="public-logo-frame"><img src="/abroad-logo-new.png" alt="Abroad Education Consultancy Services"/></span><div><strong>Abroad Education Consultancy Services</strong><small>Choose Abroad to Study Abroad</small></div></div><div className="secure-note"><ShieldCheck size={16}/>Secure class enquiry</div></header>
    <section className="public-hero"><p className="eyebrow">Classes & test preparation</p><h1>Find the right class for you</h1><p>Tell us what you would like to study and our class coordinator will contact you with the best option.</p></section>
    <section className="public-form"><div className="public-progress"><span style={{width:`${((step+1)/4)*100}%`}}/></div><div className="public-step-title"><small>Step {step+1} of 4</small><h2>{titles[step]}</h2><p>Fields marked <b>*</b> are required.</p></div>
      {step===0&&<div className="public-grid"><Field label="Full name" value={form.full_name} onChange={value=>set("full_name",value)} required/><Field label="WhatsApp number" type="tel" value={form.whatsapp} onChange={value=>set("whatsapp",value.replace(/\D/g,"").slice(0,10))} inputMode="numeric" maxLength={10} hint={`${form.whatsapp.length}/10 digits`} required/><Field label="Email address" type="email" value={form.email} onChange={value=>set("email",value)} required/></div>}
      {step===1&&<div className="public-grid"><FancySelect label="Which class are you interested in?" value={form.class_type} onChange={value=>{setForm(current=>({...current,class_type:value,current_level:""}));setError("")}} options={classTypes} format={value=>labels[value]||value} optionIcon={value=><ClassBadge type={value}/>} required/><FancySelect label="Preferred class mode" value={form.class_mode} onChange={value=>set("class_mode",value)} options={classModes} format={value=>labels[value]||value} required/></div>}
      {step===2&&<div className="level-choice"><p>{form.class_type==="GERMAN_LANGUAGE"?"Select your current German level.":"How would you describe your current preparation level?"}</p><FancySelect label="Current level" value={form.current_level} onChange={value=>set("current_level",value)} options={levelOptions} format={value=>value.charAt(0)+value.slice(1).toLowerCase()} required/></div>}
      {step===3&&<div className="class-final-step"><FancySelect label="Would you also like study-abroad counselling?" value={form.needs_counselling} onChange={value=>{setForm(current=>({...current,needs_counselling:value,preferred_country:value==="true"?current.preferred_country:""}));setError("")}} options={["true","false"]} format={value=>value==="true"?"Yes, I would like counselling":"No, classes only"} required/>{form.needs_counselling==="true"&&<FancySelect label="Which country are you interested in?" value={form.preferred_country} onChange={value=>set("preferred_country",value)} options={countries} country required/>}<label className="class-message">Anything else you would like us to know? <span>Optional</span><textarea value={form.message} onChange={event=>set("message",event.target.value)} maxLength={1000}/></label><label className="consent"><input type="checkbox" checked={form.consent} onChange={event=>set("consent",event.target.checked)}/><span>I consent to AECS securely storing and using this information to contact me about classes and counselling services. <b>*</b></span></label><input className="honeypot" tabIndex={-1} autoComplete="off" value={form.website} onChange={event=>set("website",event.target.value)}/></div>}
      {error&&<div className="validation-error" role="alert">{error}</div>}
      <footer><button className="secondary-button" disabled={busy} onClick={previous}><ArrowLeft size={16}/>Back</button>{step<3?<button className="primary-button" onClick={next}>Continue<ArrowRight size={16}/></button>:<button className="primary-button" disabled={busy} onClick={submit}>{busy?"Submitting…":"Submit class enquiry"}</button>}</footer>
    </section>
  </section><PublicServiceFooter/></main>;
}

function Field({label,value,onChange,type="text",required,hint,inputMode,maxLength}:{label:string;value:string;onChange:(value:string)=>void;type?:string;required?:boolean;hint?:string;inputMode?:"numeric";maxLength?:number}){return <label>{label}{required&&<b> *</b>}{hint&&<span>{hint}</span>}<input type={type} value={value} onChange={event=>onChange(event.target.value)} inputMode={inputMode} maxLength={maxLength} aria-required={required}/></label>}
