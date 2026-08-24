import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Globe2, ShieldCheck } from "lucide-react";
import { DobPicker } from "../components/shared/DobPicker";
import { MonthYearPicker } from "../components/shared/MonthYearPicker";
import { FancySelect } from "../components/shared/FancySelect";

const steps = ["Personal", "Academic", "Study plan", "English test", "Passport", "Finish"];
const countries = ["Australia", "UK", "USA", "New Zealand", "Canada", "Germany", "Finland", "Malta", "Cyprus", "Sweden", "Belgium", "Hungary", "Netherlands", "Ireland", "Japan", "South Korea"];
const initial = { full_name:"", gender:"", dob:"", whatsapp:"", email:"", current_address:"", highest_qualification:"", latest_result:"", study_gap:"", employment_status:"", preferred_country:"", second_country:"", preferred_intake:"", preferred_intake_year:"", preferred_course:"", budget_range:"", test_taken:"", test_type:"", score:"", has_passport:"", message:"", consent:false, website:"" };
type State = typeof initial;

export function PublicRegistration({onBack}:{onBack?:()=>void}={}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<State>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const set = <K extends keyof State>(key: K, value: State[K]) => { setForm(current => ({ ...current, [key]: value })); setError(""); };

  function missingFields() {
    const missing: string[] = [];
    const need = (key: keyof State, label: string) => { if (!String(form[key]).trim()) missing.push(label); };
    if (step === 0) {
      need("full_name", "Full name"); need("gender", "Gender"); need("dob", "Date of birth"); need("whatsapp", "WhatsApp number"); need("email", "Email address");
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) missing.push("a valid email address");
      if (form.whatsapp && form.whatsapp.replace(/\D/g, "").length !== 10) missing.push("a 10-digit WhatsApp number");
    }
    if (step === 1) { need("highest_qualification", "Highest qualification"); need("latest_result", "Latest GPA / percentage"); }
    if (step === 2) { need("preferred_country", "Preferred country"); need("preferred_intake", "Preferred intake"); need("preferred_intake_year", "Intake year"); need("preferred_course", "Preferred course"); need("budget_range", "Estimated budget"); }
    if (step === 3) { need("test_taken", "English test answer"); if (form.test_taken === "true") { need("test_type", "Test type"); need("score", "Test score"); } }
    if (step === 4) need("has_passport", "Passport answer");
    if (step === 5 && !form.consent) missing.push("Consent confirmation");
    return missing;
  }

  function next() {
    const missing = missingFields();
    if (missing.length) { setError(`Please complete: ${missing.join(", ")}.`); return; }
    setError(""); setStep(current => current + 1); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const missing = missingFields();
    if (missing.length) { setError(`Please complete: ${missing.join(", ")}.`); return; }
    setBusy(true); setError("");
    const intakeGroups:Record<string,string>={January:"Jan/Feb/Mar",February:"Jan/Feb/Mar",March:"Jan/Feb/Mar",April:"Apr/May",May:"Apr/May",June:"June/July/August",July:"June/July/August",August:"June/July/August",September:"Sep/Oct",October:"Sep/Oct",November:"Nov/Dec",December:"Nov/Dec"};
    const {supabase}=await import("../lib/supabase");
    const { data, error: submitError } = await supabase.rpc("submit_public_registration", { payload: {...form,preferred_intake:intakeGroups[form.preferred_intake]||form.preferred_intake} });
    if (submitError) setError(submitError.message); else setDone(data.student_code);
    setBusy(false);
  }

  if (done) return <main className="public-register thank-you-page"><section className="public-success thank-you-card"><div className="success-check"><Check/></div><p className="eyebrow">Registration received</p><h1>Thank You for Choosing Abroad Education Consultancy Services!</h1><p>Your information has been successfully and securely submitted to our counselling team. One of our expert counsellors will review your information and contact you shortly to assist you with your study-abroad plans.</p><div className="stay-connected"><h2>Connect with us:</h2><div className="social-links"><a href="https://aecsnepal.com/" target="_blank" rel="noreferrer"><Globe2/><div><strong>Website</strong><small>aecsnepal.com</small></div></a><a href="https://www.facebook.com/abroadeducation.np" target="_blank" rel="noreferrer"><FacebookLogo/><div><strong>Facebook</strong><small>abroadeducation.np</small></div></a><a href="https://www.tiktok.com/@aecsnepal" target="_blank" rel="noreferrer"><TikTokLogo/><div><strong>TikTok</strong><small>@aecsnepal</small></div></a><a href="https://www.instagram.com/abroadeducation.np/" target="_blank" rel="noreferrer"><InstagramLogo/><div><strong>Instagram</strong><small>@abroadeducation.np</small></div></a></div></div><p className="closing-note">We look forward to helping you take the next step toward your international education journey.</p></section></main>;

  return <main className="public-register"><section className="public-registration-card">
    <header><div className="public-brand"><span className="public-logo-frame"><img src="/abroad-logo-new.png" alt="Abroad Education Consultancy Services"/></span><div><strong>Abroad Education Consultancy Services</strong><small>Building global futures, one student at a time.</small></div></div><div className="secure-note"><ShieldCheck size={16}/>Secure registration</div></header>
    <section className="public-hero"><p className="eyebrow">Begin your study abroad journey</p><h1>Student registration</h1><p>Complete every required field so our counsellors can give you accurate guidance.</p></section>
    <section className="public-form"><div className="public-progress"><span style={{width:`${((step+1)/6)*100}%`}}/></div><div className="public-step-title"><small>Step {step+1} of 6</small><h2>{steps[step]}</h2><p>Fields marked <b>*</b> are required.</p></div>
      {step===0 && <Grid><Input label="Full name" value={form.full_name} change={v=>set("full_name",v)} required/><Select label="Gender" value={form.gender} change={v=>set("gender",v)} options={["Male","Female","Other","Prefer not to say"]} required/><label>Date of birth <b>*</b><DobPicker value={form.dob} onChange={value=>set("dob",value)} required/></label><Input label="WhatsApp number" type="tel" value={form.whatsapp} change={v=>set("whatsapp",v)} hint={`${form.whatsapp.length}/10 digits`} digitsOnly maxLength={10} required/><Input label="Email address" type="email" value={form.email} change={v=>set("email",v)} required/><Input label="Current address" value={form.current_address} change={v=>set("current_address",v)}/></Grid>}
      {step===1 && <Grid><Select label="Highest qualification" value={form.highest_qualification} change={v=>set("highest_qualification",v)} options={["+2/Diploma","Bachelors","Masters"]} required/><Input label="Latest GPA / percentage" value={form.latest_result} change={v=>set("latest_result",v)} required/><Input label="Study gap" value={form.study_gap} change={v=>set("study_gap",v)} hint="Optional"/><Input label="Employment status" value={form.employment_status} change={v=>set("employment_status",v)} hint="Optional"/></Grid>}
      {step===2 && <Grid><Select label="Preferred country" value={form.preferred_country} change={v=>set("preferred_country",v)} options={countries} required/><Input label="Second choice country" value={form.second_country} change={v=>set("second_country",v)} hint="Optional — type a country"/><label className="wide">Preferred intake <b>*</b><MonthYearPicker month={form.preferred_intake} year={form.preferred_intake_year} onChange={(month,year)=>setForm(current=>({...current,preferred_intake:month,preferred_intake_year:year}))} required/></label><Input label="Preferred course" value={form.preferred_course} change={v=>set("preferred_course",v)} required/><Select label="Estimated budget (NPR)" value={form.budget_range} change={v=>set("budget_range",v)} options={["Below 10 Lakhs","10-20 Lakhs","20-30 Lakhs","30+ Lakhs"]} required/></Grid>}
      {step===3 && <Grid><Select label="Have you taken an English test?" value={form.test_taken} change={v=>set("test_taken",v)} options={["true","false"]} yesNo required/>{form.test_taken==="true" && <><Select label="Test type" value={form.test_type} change={v=>set("test_type",v)} options={["IELTS","PTE","Duolingo","TOEFL","GRE","SAT"]} required/><Input label="Overall score" value={form.score} change={v=>set("score",v)} required/></>}</Grid>}
      {step===4 && <Grid><Select label="Do you have a valid passport?" value={form.has_passport} change={v=>set("has_passport",v)} options={["true","false"]} yesNo required/></Grid>}
      {step===5 && <div className="finish-fields"><label>Anything else you would like us to know? <span>Optional</span><textarea value={form.message} onChange={e=>set("message",e.target.value)} maxLength={2000}/></label><label className="consent"><input type="checkbox" checked={form.consent} onChange={e=>set("consent",e.target.checked)}/><span>I consent to AECS securely storing and using this information to contact me about education counselling and applications. <b>*</b></span></label><input className="honeypot" tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>set("website",e.target.value)}/></div>}
      {error && <div className="validation-error" role="alert">{error}</div>}
      <footer><button className="secondary-button" disabled={(step===0&&!onBack)||busy} onClick={()=>{setError("");if(step===0)onBack?.();else setStep(current=>current-1)}}><ArrowLeft size={16}/>Back</button>{step<5?<button className="primary-button" onClick={next}>Continue<ArrowRight size={16}/></button>:<button className="primary-button" disabled={busy} onClick={submit}>{busy?"Submitting…":"Submit registration"}</button>}</footer>
    </section></section><p className="public-footer">Need help? Visit AECS at Adwait Marga, Purano Buspark, Bagbazar, Kathmandu.</p>
  </main>;
}

function Grid({children}:{children:React.ReactNode}) { return <div className="public-grid">{children}</div>; }
function FacebookLogo() { return <svg className="brand-social-icon facebook-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 21v-8h2.8l.4-3.1h-3.2v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.7-.1-1.5-.2-2.3-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H8V13h2.6v8h3.1Z"/></svg>; }
function TikTokLogo() { return <svg className="brand-social-icon tiktok-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.3 3c.3 2.1 1.5 3.4 3.7 3.6v3.1a7.8 7.8 0 0 1-3.6-1v6.1a6.1 6.1 0 1 1-5.3-6v3.2a3 3 0 1 0 2.1 2.8V3h3.1Z"/></svg>; }
function InstagramLogo() { return <svg className="brand-social-icon instagram-logo" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M7.2 2.8h9.6a4.4 4.4 0 0 1 4.4 4.4v9.6a4.4 4.4 0 0 1-4.4 4.4H7.2a4.4 4.4 0 0 1-4.4-4.4V7.2a4.4 4.4 0 0 1 4.4-4.4Zm0 2.2A2.2 2.2 0 0 0 5 7.2v9.6A2.2 2.2 0 0 0 7.2 19h9.6a2.2 2.2 0 0 0 2.2-2.2V7.2A2.2 2.2 0 0 0 16.8 5H7.2Zm9.95 1.35a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM12 7.3a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 2.2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/></svg>; }
function Input({label,value,change,type="text",required,hint,digitsOnly=false,maxLength}:{label:string;value:string;change:(v:string)=>void;type?:string;required?:boolean;hint?:string;digitsOnly?:boolean;maxLength?:number}) { return <label>{label}{required&&<b> *</b>}{hint&&<span>{hint}</span>}<input type={type} inputMode={digitsOnly?"numeric":undefined} pattern={digitsOnly?"[0-9]*":undefined} maxLength={maxLength} value={value} onChange={e=>change(digitsOnly?e.target.value.replace(/\D/g,"").slice(0,maxLength):e.target.value)} aria-required={required}/></label>; }
function Select({label,value,change,options,required,yesNo=false}:{label:string;value:string;change:(v:string)=>void;options:string[];required?:boolean;yesNo?:boolean}) {
  return <FancySelect
    label={label}
    value={value}
    onChange={change}
    options={options}
    required={required}
    country={label==="Preferred country"}
    format={yesNo ? option => option==="true" ? "Yes" : "No" : undefined}
  />;
}
