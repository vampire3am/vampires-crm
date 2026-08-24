import { BookOpenCheck, GraduationCap, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ClassEnquiryForm } from "./ClassEnquiryForm";
import { PublicRegistration } from "./PublicRegistration";

type Journey = "counselling" | "classes" | null;

export function PublicIntake() {
  const [journey, setJourney] = useState<Journey>(null);
  if (journey === "counselling") return <PublicRegistration onBack={() => setJourney(null)} />;
  if (journey === "classes") return <ClassEnquiryForm onBack={() => setJourney(null)} />;

  return <main className="public-register intake-choice-page"><section className="intake-choice-card">
    <header className="choice-brand"><span className="public-logo-frame"><img src="/abroad-logo-new.png" alt="Abroad Education Consultancy Services" /></span><div><strong>Abroad Education Consultancy Services</strong><small>Building global futures, one student at a time.</small></div><span className="secure-note"><ShieldCheck size={16}/>Secure enquiry</span></header>
    <div className="choice-copy"><p className="eyebrow">Welcome to AECS</p><h1>How can we assist you today?</h1><p>Choose the service you are interested in. We will only ask for information relevant to your enquiry.</p></div>
    <div className="journey-options">
      <button type="button" onClick={() => setJourney("counselling")}><span className="journey-icon counselling"><GraduationCap /></span><div><strong>Study Abroad Counselling</strong><p>Personalised guidance about destinations, courses, intakes and applications.</p><small>Continue to counselling form →</small></div></button>
      <button type="button" onClick={() => setJourney("classes")}><span className="journey-icon classes"><BookOpenCheck /></span><div><strong>Classes & Test Preparation</strong><p>Explore IELTS, PTE, DET and German language class options.</p><small>Continue to class enquiry →</small></div></button>
    </div>
  </section></main>;
}
