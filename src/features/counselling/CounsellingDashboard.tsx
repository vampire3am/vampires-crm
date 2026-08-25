import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Building,
  Building2,
  Calculator,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Compass,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Globe,
  GraduationCap,
  Info,
  Layers,
  MapPin,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Percent,
  Pencil,
  PlaneTakeoff,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CountryFlag } from "../../components/ui/PhoneInput";
import { CountryDisplay } from "../../components/ui/CountryDisplay";
import { CountrySelect } from "../../components/ui/CountrySelect";
import { AECS_AUTHORIZED_COUNTRIES, DestinationCountry } from "../../lib/destinationsData";
import { COUNTRY_METADATA } from "../../lib/countryMetadata.generated";
import { MultiIntakePicker } from "../../components/ui/MultiIntakePicker";
import { notifyError, notifySuccess } from "../../components/common/CrmNotifications";
import { validateDocumentFiles } from "../../lib/documentUploadPolicy";
import { CounsellingService, type CounsellingRecord } from "../../services/counsellingService";
import { DestinationCatalogService } from "../../services/destinationCatalogService";
import { StudentService, type StudentDirectoryRecord } from "../../services/studentService";
import { useAuth } from "../auth/AuthProvider";

export interface DestinationCatalog extends DestinationCountry {
  region: "English Speaking" | "Europe & Schengen" | "East Asia";
  universitiesCount: number;
  coursesCount: number;
  activeProcessing: number;
  visasApproved: number;
  visaSuccessRate: string;
  avgTuition: string;
  avgLivingCost: string;
  pswvWorkRights: string;
  acceptedEnglishTests: string[];
  intakeCycles: string[];
  keyHighlights: string;
}

export interface PartnerUniversity {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  ranking: string;
  popularCourses: string[];
  minPte: string;
  minIelts: string;
  minGpa?: string;
  scholarship: string;
  tuition: string;
  intake: string;
  courses?: UniversityCourse[];
}

export interface UniversityCourse {
  id: string;
  name: string;
  qualification: string;
  faculty: string;
  duration: string;
  tuitionFee: string;
  applicationFee: string;
  intakes: string;
  minGpa: string;
  minIelts: string;
  minPte: string;
  scholarship: string;
  status: "ACTIVE" | "INACTIVE";
  requirements: string;
}

const INITIAL_DESTINATIONS_MASTER: DestinationCatalog[] = [];

const INITIAL_PARTNER_UNIVERSITIES: PartnerUniversity[] = [];
const cleanUniversity=(university:PartnerUniversity):PartnerUniversity=>({...university,scholarship:university.scholarship==="Merit & Early Entry Grants"?"":university.scholarship,tuition:university.tuition==="Competitive Fee Structure"?"":university.tuition});

const DESTINATIONS_STORAGE_KEY = "aecs_destinations_catalog_v2";
const SYNTHETIC_ENGLISH_TESTS = ["IELTS (6.0+)", "PTE (56+)", "Duolingo"];

const removeSyntheticDestinationData = (destination: DestinationCatalog): DestinationCatalog => ({
  ...destination,
  universitiesCount: destination.universitiesCount === 5 ? 0 : destination.universitiesCount,
  coursesCount: destination.coursesCount === 35 ? 0 : destination.coursesCount,
  visaSuccessRate: destination.visasApproved === 0 ? "0%" : destination.visaSuccessRate,
  acceptedEnglishTests:
    JSON.stringify(destination.acceptedEnglishTests) === JSON.stringify(SYNTHETIC_ENGLISH_TESTS)
      ? []
      : destination.acceptedEnglishTests,
});

const COUNTRY_AUTOFILL = COUNTRY_METADATA;
const ALL_COUNTRY_OPTIONS: DestinationCountry[] = COUNTRY_METADATA.map(country=>({name:country[0],code:country[1],currency:country[2],dialCode:country[3],region:country[4],popularIntakes:[]}));

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  US: "United States",
  USA: "United States",
  "U.S.": "United States",
  "U.S.A.": "United States",
  AMERICA: "United States",
  UK: "United Kingdom",
  "U.K.": "United Kingdom",
  BRITAIN: "United Kingdom",
  "GREAT BRITAIN": "United Kingdom",
  UAE: "United Arab Emirates",
  "U.A.E.": "United Arab Emirates",
  KOREA: "South Korea",
  "REPUBLIC OF KOREA": "South Korea",
};
const UNIVERSITIES_STORAGE_KEY = "aecs_partner_universities_v2";
const DESTINATION_DOCUMENTS_STORAGE_KEY = "aecs_destination_documents_v1";

interface DestinationDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
}

export function CounsellingDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"destinations" | "universities" | "consultations">("destinations");
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCountryDetail, setActiveCountryDetail] = useState<DestinationCatalog | null>(null);
  const [isEditingDestination, setIsEditingDestination] = useState(false);
  const [destinationEdit, setDestinationEdit] = useState({ name: "", currency: "", dialCode: "", avgLivingCost: "", pswvWorkRights: "", popularIntakes: "", acceptedEnglishTests: "", keyHighlights: "" });
  const [destinationDocuments, setDestinationDocuments] = useState<Record<string, DestinationDocument[]>>(() => {
    try { return JSON.parse(localStorage.getItem(DESTINATION_DOCUMENTS_STORAGE_KEY) || "{}"); } catch { return {}; }
  });
  const [catalogError,setCatalogError]=useState("");
  const [catalogLoading,setCatalogLoading]=useState(true);

  // Persistent Destination & University Catalogs
  const [destinations, setDestinations] = useState<DestinationCatalog[]>(() => {
    const saved = localStorage.getItem(DESTINATIONS_STORAGE_KEY);
    if (saved) {
      try {
        return (JSON.parse(saved) as DestinationCatalog[]).map(removeSyntheticDestinationData);
      } catch (e) {}
    }
    return INITIAL_DESTINATIONS_MASTER;
  });

  const [universities, setUniversities] = useState<PartnerUniversity[]>(() => {
    const saved = localStorage.getItem(UNIVERSITIES_STORAGE_KEY);
    if (saved) {
      try {
        return (JSON.parse(saved) as PartnerUniversity[]).map(cleanUniversity);
      } catch (e) {}
    }
    return INITIAL_PARTNER_UNIVERSITIES;
  });

  useEffect(() => { let live=true;
    const local=destinations;
    DestinationCatalogService.list().then(async remote=>{
      if(!live)return;
      if(remote.length){setDestinations(remote.map(removeSyntheticDestinationData));localStorage.setItem(DESTINATIONS_STORAGE_KEY,JSON.stringify(remote));}
      else if(local.length){await DestinationCatalogService.saveMany(local);if(live)setDestinations(local);}
      setCatalogError("");
    }).catch(error=>{if(live)setCatalogError(error instanceof Error?error.message:"Unable to load the destination catalogue")}).finally(()=>{if(live)setCatalogLoading(false)});
    return()=>{live=false};
    // Initial migration intentionally runs once; subsequent changes use explicit database writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal States
  const [showAddCountryModal, setShowAddCountryModal] = useState(false);
  const [showAddUniModal, setShowAddUniModal] = useState(false);
  const [courseUniversityId, setCourseUniversityId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const emptyCourseForm: Omit<UniversityCourse, "id"> = {
    name: "",
    qualification: "Bachelor's Degree",
    faculty: "",
    duration: "",
    tuitionFee: "",
    applicationFee: "",
    intakes: "",
    minGpa: "",
    minIelts: "",
    minPte: "",
    scholarship: "",
    status: "ACTIVE",
    requirements: "",
  };
  const [courseForm, setCourseForm] = useState<Omit<UniversityCourse, "id">>(emptyCourseForm);

  // New Country Form State
  const [newCountryForm, setNewCountryForm] = useState({
    name: "",
    code: "",
    currency: "",
    dialCode: "",
    region: "Europe & Schengen" as DestinationCatalog["region"],
    universitiesCount: 0,
    coursesCount: 0,
    avgTuition: "",
    avgLivingCost: "",
    pswvWorkRights: "",
    popularIntakes: "",
    keyHighlights: "",
  });

  const updateCountryName = (name: string) => {
    const enteredName = name.trim();
    const canonicalName = COUNTRY_NAME_ALIASES[enteredName.toUpperCase()] ?? enteredName;
    const match = COUNTRY_AUTOFILL.find(country => country[0].toLowerCase() === canonicalName.toLowerCase());
    setNewCountryForm(current => ({
      ...current,
      name,
      code: match?.[1] ?? "",
      currency: match?.[2] ?? "",
      dialCode: match?.[3] ?? "",
      region: (match?.[4] ?? "Europe & Schengen") as DestinationCatalog["region"],
    }));
  };

  // New University Form State
  const [newUniForm, setNewUniForm] = useState({
    name: "",
    city: "",
    country: "",
    countryCode: "",
    ranking: "",
    popularCourses: "",
    minPte: "",
    minIelts: "",
    minGpa: "",
    scholarship: "",
    tuition: "",
    intake: "",
  });
  const [editingUniversityId,setEditingUniversityId]=useState<string|null>(null);

  const universityCurrency=(country:string)=>destinations.find(item=>item.name===country)?.currency||COUNTRY_METADATA.find(item=>item[0]===country)?.[2]||"USD";
  const tuitionWithCurrency=(tuition:string,country:string)=>{if(!tuition.trim())return"N/A";const currency=universityCurrency(country);const amount=tuition.trim().replace(/^[A-Z]{3}\s+/i,"");return`${currency} ${amount}`};

  const openUniversityForm = (destination?: DestinationCatalog,university?:PartnerUniversity) => {
    setEditingUniversityId(university?.id??null);
    const country=university?.country??destination?.name??destinations[0]?.name??"";
    setNewUniForm({name:university?.name??"",city:university?.city??"",country,countryCode:university?.countryCode??destination?.code??destinations[0]?.code??"",ranking:university?.ranking??"",popularCourses:university?.popularCourses.join(", ")??"",minPte:university?.minPte??"",minIelts:university?.minIelts??"",minGpa:university?.minGpa??"",scholarship:university?.scholarship??"",tuition:(university?.tuition??"").replace(/^[A-Z]{3}\s+/i,""),intake:university?.intake??""});
    setShowAddUniModal(true);
  };

  // Student Consultations State
  const [records, setRecords] = useState<CounsellingRecord[]>([]);
  const [consultationStudents, setConsultationStudents] = useState<StudentDirectoryRecord[]>([]);
  const [consultationLoading, setConsultationLoading] = useState(true);
  const [consultationSaving, setConsultationSaving] = useState(false);
  const [consultationError, setConsultationError] = useState("");
  const [consultForm, setConsultForm] = useState({
    studentCode: "",
    studentName: "",
    targetCountry: "",
    preferredCourse: "",
    counsellorName: profile?.full_name || "",
    stageOutcome: "University Shortlisted",
    followUpDate: "",
    notes: "",
  });

  useEffect(() => {
    let live = true;
    Promise.all([CounsellingService.getRecords(), StudentService.getStudents()])
      .then(([savedRecords, students]) => {
        if (!live) return;
        setRecords(savedRecords);
        setConsultationStudents(students);
        setConsultationError("");
      })
      .catch(error => {
        if (!live) return;
        setConsultationError(error instanceof Error ? error.message : "Unable to load consultation records.");
      })
      .finally(() => { if (live) setConsultationLoading(false); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!consultForm.targetCountry && destinations[0]?.name) {
      setConsultForm(current => ({ ...current, targetCountry: destinations[0].name }));
    }
  }, [destinations, consultForm.targetCountry]);

  // Save to local storage whenever modified
  const saveDestinations = (updated: DestinationCatalog[]) => {
    setDestinations(updated);
    localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(updated));
  };

  const saveUniversities = (updated: PartnerUniversity[]) => {
    const cleaned=updated.map(cleanUniversity);setUniversities(cleaned);
    localStorage.setItem(UNIVERSITIES_STORAGE_KEY, JSON.stringify(cleaned));
  };

  const selectedCourseUniversity = universities.find(university => university.id === courseUniversityId) ?? null;

  const universityCourses = (university: PartnerUniversity): UniversityCourse[] => {
    if (Array.isArray(university.courses) && university.courses.length > 0) return university.courses;
    return (university.popularCourses || []).map((name, index) => ({
      id: `legacy-${university.id}-${index}`,
      name,
      qualification: "Not specified",
      faculty: "",
      duration: "",
      tuitionFee: university.tuition || "",
      applicationFee: "",
      intakes: university.intake || "",
      minGpa: university.minGpa || "",
      minIelts: university.minIelts || "",
      minPte: university.minPte || "",
      scholarship: university.scholarship || "",
      status: "ACTIVE",
      requirements: "",
    }));
  };

  const resetCourseEditor = () => {
    setEditingCourseId(null);
    setCourseForm(emptyCourseForm);
  };

  const openCourseManager = (university: PartnerUniversity) => {
    setCourseUniversityId(university.id);
    resetCourseEditor();
  };

  const editUniversityCourse = (course: UniversityCourse) => {
    const { id, ...details } = course;
    setEditingCourseId(id);
    setCourseForm(details);
  };

  const saveUniversityCourse = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCourseUniversity || !courseForm.name.trim()) return;
    const currentCourses = universityCourses(selectedCourseUniversity);
    const savedCourse: UniversityCourse = {
      ...courseForm,
      id: editingCourseId || `course-${Date.now()}`,
      name: courseForm.name.trim(),
    };
    const courses = editingCourseId
      ? currentCourses.map(course => course.id === editingCourseId ? savedCourse : course)
      : [savedCourse, ...currentCourses];
    saveUniversities(universities.map(university => university.id === selectedCourseUniversity.id
      ? { ...university, courses, popularCourses: courses.filter(course => course.status === "ACTIVE").map(course => course.name) }
      : university));
    notifySuccess(editingCourseId ? "Course updated" : "Course added", `${savedCourse.name} is now available in ${selectedCourseUniversity.name}'s programme catalogue.`);
    resetCourseEditor();
  };

  const deleteUniversityCourse = (course: UniversityCourse) => {
    if (!selectedCourseUniversity || !window.confirm(`Remove ${course.name} from ${selectedCourseUniversity.name}?`)) return;
    const courses = universityCourses(selectedCourseUniversity).filter(item => item.id !== course.id);
    saveUniversities(universities.map(university => university.id === selectedCourseUniversity.id
      ? { ...university, courses, popularCourses: courses.filter(item => item.status === "ACTIVE").map(item => item.name) }
      : university));
    notifySuccess("Course removed", `${course.name} was removed from ${selectedCourseUniversity.name}.`);
    if (editingCourseId === course.id) resetCourseEditor();
  };

  const beginDestinationEdit = (destination: DestinationCatalog) => {
    setDestinationEdit({
      name: destination.name,
      currency: destination.currency,
      dialCode: destination.dialCode,
      avgLivingCost: destination.avgLivingCost,
      pswvWorkRights: destination.pswvWorkRights,
      popularIntakes: destination.popularIntakes.join(", "),
      acceptedEnglishTests: destination.acceptedEnglishTests.join(", "),
      keyHighlights: destination.keyHighlights,
    });
    setIsEditingDestination(true);
  };

  const saveDestinationEdit = async () => {
    if (!activeCountryDetail || !destinationEdit.name.trim()) return;
    const updatedDestination: DestinationCatalog = {
      ...activeCountryDetail,
      name: destinationEdit.name.trim(),
      currency: destinationEdit.currency.trim().toUpperCase(),
      dialCode: destinationEdit.dialCode.trim(),
      avgLivingCost: destinationEdit.avgLivingCost.trim(),
      pswvWorkRights: destinationEdit.pswvWorkRights.trim(),
      popularIntakes: destinationEdit.popularIntakes.split(",").map(value => value.trim()).filter(Boolean),
      acceptedEnglishTests: destinationEdit.acceptedEnglishTests.split(",").map(value => value.trim()).filter(Boolean),
      keyHighlights: destinationEdit.keyHighlights.trim(),
    };
    try { await DestinationCatalogService.save(updatedDestination);saveDestinations(destinations.map(item => item.code === activeCountryDetail.code ? updatedDestination : item));
      setActiveCountryDetail(updatedDestination);setIsEditingDestination(false);setCatalogError("");
    } catch(error){setCatalogError(error instanceof Error?error.message:"Unable to save destination changes")}
  };

  const saveDestinationDocuments = (updated: Record<string, DestinationDocument[]>) => {
    setDestinationDocuments(updated);
    localStorage.setItem(DESTINATION_DOCUMENTS_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleDestinationDocuments = async (files: FileList | null) => {
    if (!files || !activeCountryDetail) return;
    const allowed = Array.from(files).slice(0, 10);
    if (!validateDocumentFiles(allowed)) return;
    const additions = await Promise.all(allowed.map(file => new Promise<DestinationDocument>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, dataUrl: String(reader.result), uploadedAt: new Date().toISOString() });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    const code = activeCountryDetail.code;
    try {
      saveDestinationDocuments({ ...destinationDocuments, [code]: [...(destinationDocuments[code] || []), ...additions] });
      window.alert(`${additions.length} destination document${additions.length === 1 ? "" : "s"} uploaded successfully.`);
    } catch {
      notifyError("Document upload failed","The browser could not store these files. Upload fewer documents and try again.");
    }
  };

  const removeDestinationDocument = (id: string) => {
    if (!activeCountryDetail) return;
    const code = activeCountryDetail.code;
    saveDestinationDocuments({ ...destinationDocuments, [code]: (destinationDocuments[code] || []).filter(document => document.id !== id) });
  };

  const handleDeleteUniversity = async (university: PartnerUniversity) => {
    const confirmed = window.confirm(
      `End the partnership with ${university.name}?\n\nThe university will be removed from the active partner catalogue. Existing student and application records will remain unchanged.`
    );
    if (!confirmed) return;

    saveUniversities(universities.filter(item => item.id !== university.id));
    const updatedDestinations=destinations.map(destination =>
        destination.code === university.countryCode || destination.name === university.country
          ? { ...destination, universitiesCount: Math.max(0, destination.universitiesCount - 1) }
          : destination
      );
    const affected=updatedDestinations.find(destination=>destination.code===university.countryCode||destination.name===university.country);
    try{if(affected)await DestinationCatalogService.save(affected);saveDestinations(updatedDestinations)}catch(error){setCatalogError(error instanceof Error?error.message:"Unable to update the destination catalogue")}
  };

  const handleDeleteDestination = async (destination: DestinationCatalog) => {
    const linkedUniversities = universities.filter(
      university => university.countryCode === destination.code || university.country === destination.name
    );

    if (linkedUniversities.length > 0) {
      window.alert(
        `${destination.name} cannot be removed yet. End its ${linkedUniversities.length} active university partnership${linkedUniversities.length === 1 ? "" : "s"} first.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Remove ${destination.name} from the study destination catalogue?\n\nExisting student and application records will remain unchanged.`
    );
    if (!confirmed) return;

    try { await DestinationCatalogService.remove(destination.code);saveDestinations(destinations.filter(item => item.code !== destination.code));setActiveCountryDetail(null);setCatalogError(""); }
    catch(error){setCatalogError(error instanceof Error?error.message:"Unable to remove destination")}
  };

  // Add Country Handler
  const handleCreateCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryForm.name.trim() || !newCountryForm.code.trim()) return;

    const formattedCode = newCountryForm.code.trim().toUpperCase().substring(0, 2);
    const intakesArray = newCountryForm.popularIntakes.split(",").map(s => s.trim()).filter(Boolean);

    const newDest: DestinationCatalog = {
      name: newCountryForm.name.trim(),
      code: formattedCode,
      currency: newCountryForm.currency.trim().toUpperCase(),
      dialCode: newCountryForm.dialCode.trim(),
      region: newCountryForm.region,
      universitiesCount: 0,
      coursesCount: 0,
      activeProcessing: 0,
      visasApproved: 0,
      visaSuccessRate: "0%",
      avgTuition: newCountryForm.avgTuition.trim(),
      avgLivingCost: newCountryForm.avgLivingCost.trim(),
      pswvWorkRights: newCountryForm.pswvWorkRights.trim(),
      acceptedEnglishTests: [],
      popularIntakes: intakesArray.length > 0 ? intakesArray : ["September", "February"],
      intakeCycles: intakesArray.map(intake => /\b20\d{2}\b/.test(intake) ? intake : `${intake} 2026`),
      keyHighlights: newCountryForm.keyHighlights.trim(),
    };

    try { await DestinationCatalogService.save(newDest);const updated = [newDest, ...destinations.filter(d => d.code !== formattedCode)];
    saveDestinations(updated);setShowAddCountryModal(false);setCatalogError("");
    setNewCountryForm({
      name: "",
      code: "",
      currency: "",
      dialCode: "",
      region: "Europe & Schengen",
      universitiesCount: 0,
      coursesCount: 0,
      avgTuition: "",
      avgLivingCost: "",
      pswvWorkRights: "",
      popularIntakes: "",
      keyHighlights: "",
    });
    } catch(error){setCatalogError(error instanceof Error?error.message:"Unable to save destination")}
  };

  // Add University Handler
  const handleCreateUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniForm.name.trim() || !newUniForm.city.trim()) return;

    const matchedCountry = destinations.find(d => d.name === newUniForm.country);
    const countryCode = matchedCountry ? matchedCountry.code : newUniForm.countryCode || "GB";
    const coursesArray = newUniForm.popularCourses.split(",").map(s => s.trim()).filter(Boolean);

    const newUni: PartnerUniversity = {
      id: editingUniversityId??`uni-${Date.now()}`,
      name: newUniForm.name.trim(),
      city: newUniForm.city.trim(),
      country: newUniForm.country,
      countryCode: countryCode,
      ranking: newUniForm.ranking.trim() || "Accredited Global Partner",
      popularCourses: coursesArray.length > 0 ? coursesArray : ["Undergraduate & Postgraduate Degrees"],
      minPte: newUniForm.minPte.trim() || "58+",
      minIelts: newUniForm.minIelts.trim() || "6.0",
      minGpa: newUniForm.minGpa.trim() || "Not specified",
      scholarship: newUniForm.scholarship.trim(),
      tuition: tuitionWithCurrency(newUniForm.tuition,newUniForm.country),
      intake: newUniForm.intake.trim() || "September & January",
    };

    const updatedUnis = editingUniversityId?universities.map(item=>item.id===editingUniversityId?{...newUni,courses:item.courses}:item):[newUni, ...universities];
    saveUniversities(updatedUnis);

    // Also increment the country's universities count
    const updatedDests = destinations.map(d =>
      d.name === newUniForm.country ? { ...d, universitiesCount: editingUniversityId?d.universitiesCount:d.universitiesCount + 1 } : d
    );
    const affected=updatedDests.find(destination=>destination.name===newUniForm.country);
    try{if(affected)await DestinationCatalogService.save(affected);saveDestinations(updatedDests);setCatalogError("");}
    catch(error){setCatalogError(error instanceof Error?error.message:"Unable to update the destination catalogue")}

    setShowAddUniModal(false);
    notifySuccess(editingUniversityId?"University updated":"University added",`${newUni.name} was saved successfully.`);
    setEditingUniversityId(null);
    setNewUniForm({
      name: "",
      city: "",
      country: "",
      countryCode: "",
      ranking: "",
      popularCourses: "",
      minPte: "",
      minIelts: "",
      minGpa: "",
      scholarship: "",
      tuition: "",
      intake: "",
    });
  };

  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultForm.studentCode) {
      notifyError("Student required", "Select a registered CRM student before saving this consultation.");
      return;
    }
    if (!consultForm.targetCountry || !consultForm.notes.trim()) {
      notifyError("Required details missing", "Choose a destination and enter the consultation notes.");
      return;
    }
    setConsultationSaving(true);
    setConsultationError("");
    try {
      await CounsellingService.createRecord({
        studentName: consultForm.studentName,
        studentCode: consultForm.studentCode,
        counsellorName: consultForm.counsellorName,
        consultationDate: "Today, Just now",
        targetCountry: consultForm.targetCountry,
        preferredCourse: consultForm.preferredCourse.trim(),
        stageOutcome: consultForm.stageOutcome as CounsellingRecord["stageOutcome"],
        followUpDate: consultForm.followUpDate,
        notes: consultForm.notes.trim(),
      });
      setRecords(await CounsellingService.getRecords());
      setConsultForm(current => ({ ...current, studentCode: "", studentName: "", preferredCourse: "", followUpDate: "", notes: "" }));
      notifySuccess("Consultation saved", "The guidance record is now available in the student's consultation history.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The consultation could not be saved.";
      setConsultationError(message);
      notifyError("Unable to save consultation", message);
    } finally {
      setConsultationSaving(false);
    }
  };

  // Filtered destination cards
  const filteredDestinations = useMemo(() => {
    return destinations.filter(d => {
      const matchRegion = selectedRegion === "ALL" || d.region === selectedRegion;
      const matchSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.currency.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.keyHighlights.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRegion && matchSearch;
    });
  }, [destinations, selectedRegion, searchQuery]);

  // Aggregate Top Statistics
  const destinationUniversities = (destination: DestinationCatalog) =>
    universities.filter(university => university.countryCode === destination.code || university.country === destination.name);
  const destinationUniversityCount = (destination: DestinationCatalog) => destinationUniversities(destination).length;
  const destinationCourseCount = (destination: DestinationCatalog) =>
    new Set(destinationUniversities(destination).flatMap(university => university.popularCourses || [])).size;
  const destinationVisaSuccessRate = (destination: DestinationCatalog) =>
    destination.visasApproved > 0 ? destination.visaSuccessRate : "0%";

  const totalUniversitiesCount = universities.length;
  const totalCoursesCount = new Set(universities.flatMap(university => universityCourses(university).map(course => course.name))).size;
  const totalApprovedCount = destinations.reduce((acc, curr) => acc + curr.visasApproved, 0);

  return (
    <div className="page-container">
      {/* 1. Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Abroad & Global Destinations Hub</h2>
          <p>
            Official catalog for the {destinations.length} AECS authorized study destinations, partner universities, and intake cycles.
          </p>
        </div>

        {/* Header Action Buttons with + Add Country and + Add University */}
        <div className="page-header-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {/* ORANGE ADD COUNTRY BUTTON (MATCHING USER SCREENSHOT) */}
          <button
            type="button"
            className="btn-primary"
            style={{ background: "var(--accent-orange, #EA580C)", borderColor: "var(--accent-orange, #EA580C)", boxShadow: "0 2px 8px rgba(234, 88, 12, 0.25)" }}
            onClick={() => setShowAddCountryModal(true)}
          >
            <Plus size={16} />
            <span>Add country</span>
          </button>

          {/* ADD PARTNER UNIVERSITY BUTTON */}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => openUniversityForm()}
          >
            <Building2 size={15} />
            <span>Add University</span>
          </button>
        </div>
      </div>
      {catalogError&&<div className="phase2-alert phase2-alert-error"><AlertCircle size={16}/><span><strong>Destination catalogue unavailable.</strong> {catalogError}</span><button type="button" onClick={()=>setCatalogError("")} aria-label="Dismiss"><X size={14}/></button></div>}
      {catalogLoading&&<div className="catalog-sync-status"><RotateCcw size={14}/><span>Synchronising the shared destination catalogue…</span></div>}

      {/* 2. Flagship Metric Strip (Top 4 KPIs) */}
      <div className="metrics-grid-4" style={{ marginBottom: "24px" }}>
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Destinations</span>
            <div className="metric-icon-wrap blue">
              <Globe size={18} />
            </div>
          </div>
          <div className="metric-value">{destinations.length} Countries</div>
          <span className="metric-sub">Active country catalogs</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Universities</span>
            <div className="metric-icon-wrap green">
              <Building2 size={18} />
            </div>
          </div>
          <div className="metric-value">{totalUniversitiesCount} Available</div>
          <span className="metric-sub">Available institutions</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Courses</span>
            <div className="metric-icon-wrap purple">
              <GraduationCap size={18} />
            </div>
          </div>
          <div className="metric-value">{totalCoursesCount} Programs</div>
          <span className="metric-sub">Configured programs</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Approved</span>
            <div className="metric-icon-wrap amber">
              <Award size={18} />
            </div>
          </div>
          <div className="metric-value">{totalApprovedCount} Outcomes</div>
          <span className="metric-sub">Successful outcomes</span>
        </div>
      </div>

      {/* 3. Navigation Tabs Bar */}
      <div className="document-tabs">
        <button
          type="button"
          className={activeTab === "destinations" ? "active" : ""}
          onClick={() => setActiveTab("destinations")}
        >
          <Globe size={15} />
          <span>Destination directory ({destinations.length})</span>
        </button>

        <button
          type="button"
          className={activeTab === "universities" ? "active" : ""}
          onClick={() => setActiveTab("universities")}
        >
          <Building size={15} />
          <span>Partner Universities & Colleges ({universities.length})</span>
        </button>

        <button
          type="button"
          className={activeTab === "consultations" ? "active" : ""}
          onClick={() => setActiveTab("consultations")}
        >
          <MessageSquarePlus size={15} />
          <span>Student Consultation Logs ({records.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: 16+ DESTINATION DIRECTORY GRID
          ========================================================================= */}
      {activeTab === "destinations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Filter and Search Bar */}
          <div className="filter-toolbar">
            <div className="search-input-wrap" style={{ width: "380px" }}>
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search country, code or currency…"
              />
            </div>

            <div className="toolbar-selects">
              <select
                className="crm-select"
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
              >
                <option value="ALL">All Regions ({destinations.length} Countries)</option>
                <option value="English Speaking">Top English Nations (UK, Aus, US, CA, NZ)</option>
                <option value="Europe & Schengen">Europe & Schengen (Germany, Finland, Malta, etc.)</option>
                <option value="East Asia">East Asia (Japan, South Korea)</option>
              </select>

              <button
                type="button"
                className="btn-primary"
                style={{ background: "var(--accent-orange, #EA580C)", borderColor: "var(--accent-orange, #EA580C)", padding: "6px 14px", fontSize: "12px" }}
                onClick={() => setShowAddCountryModal(true)}
              >
                <Plus size={14} />
                <span>Add country</span>
              </button>
            </div>
          </div>

          {/* Country Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "18px",
            }}
          >
            {filteredDestinations.map(dest => (
              <motion.div
                key={dest.code}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                className="crm-panel"
                style={{
                  padding: "0",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {/* Country Card Header (Matching User Screenshot style) */}
                <div
                  style={{
                    padding: "14px 18px",
                    background: "var(--bg-card-subtle)",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <CountryFlag code={dest.code} size={22} />
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                        {dest.name}
                      </h3>
                      <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {dest.code} · {dest.currency} ({dest.dialCode})
                      </span>
                    </div>
                  </div>

                  <span
                    className="status-pill"
                    style={{
                      background: "var(--success-soft, #ECFDF5)",
                      color: "var(--success, #059669)",
                      borderColor: "rgba(5, 150, 105, 0.2)",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    Active
                  </span>
                </div>

                {/* 6-Metric Mini Ribbon */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "1px",
                    background: "var(--border-subtle)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ background: "var(--bg-card)", padding: "10px", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      Universities
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--text-main)" }}>{destinationUniversityCount(dest)}</strong>
                  </div>

                  <div style={{ background: "var(--bg-card)", padding: "10px", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      Courses
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--text-main)" }}>{destinationCourseCount(dest)}</strong>
                  </div>

                  <div style={{ background: "var(--bg-card)", padding: "10px", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      Visa Grant %
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--success-text, #059669)" }}>{destinationVisaSuccessRate(dest)}</strong>
                  </div>

                  <div style={{ background: "var(--bg-card)", padding: "10px", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      Processing
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--accent-blue)" }}>{dest.activeProcessing}</strong>
                  </div>

                  <div style={{ background: "var(--bg-card)", padding: "10px", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      Approved
                    </span>
                    <strong style={{ fontSize: "15px", color: "var(--success, #059669)" }}>{dest.visasApproved}</strong>
                  </div>

                  <div style={{ background: "var(--bg-card)", padding: "10px", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      Currency
                    </span>
                    <strong style={{ fontSize: "13.5px", fontFamily: "var(--font-mono)" }}>{dest.currency}</strong>
                  </div>
                </div>

                {/* Country Insights */}
                <div style={{ padding: "14px 18px", flex: 1, display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Work Rights (PSWV):
                    </span>
                    <span style={{ color: "var(--accent-blue)", fontWeight: 600 }}>{dest.pswvWorkRights}</span>
                  </div>

                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Popular Intakes:
                    </span>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                      {dest.popularIntakes.map(intk => (
                        <span
                          key={intk}
                          style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "var(--bg-card-subtle)",
                            border: "1px solid var(--border-subtle)",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          {intk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Country-scoped catalogue actions */}
                <div
                  style={{
                    padding: "12px 18px",
                    borderTop: "1px solid var(--border-subtle)",
                    background: "var(--bg-card-subtle)",
                    display: "flex",
                    gap: "8px",
                  }}
                >
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, padding: "8px 12px", fontSize: "12.5px" }}
                    onClick={() => openUniversityForm(dest)}
                  >
                    <Building2 size={14} />
                    <span>Add university</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1, padding: "8px 12px", fontSize: "12.5px" }}
                    onClick={() => setActiveCountryDetail(dest)}
                  >
                    <Compass size={14} />
                    <span>Manage destination</span>
                  </button>
                </div>
              </motion.div>
            ))}

            {/* Dash Box to Add Destination */}
            <div
              onClick={() => setShowAddCountryModal(true)}
              style={{
                border: "2px dashed var(--border-strong)",
                borderRadius: "var(--radius-md)",
                padding: "32px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                cursor: "pointer",
                background: "var(--bg-card-subtle)",
                transition: "all 0.15s ease",
                minHeight: "320px",
                textAlign: "center",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--accent-orange, #EA580C)";
                e.currentTarget.style.background = "var(--bg-card)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.background = "var(--bg-card-subtle)";
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "rgba(234, 88, 12, 0.1)",
                  color: "var(--accent-orange, #EA580C)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={24} />
              </div>
              <strong style={{ fontSize: "15px", color: "var(--text-main)" }}>Add New Study Destination</strong>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "240px", margin: 0 }}>
                Configure country details, intake periods, work rights, and partner institutions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PARTNER UNIVERSITIES DATABASE
          ========================================================================= */}
      {activeTab === "universities" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>AECS Verified Partner Universities & Colleges</h3>
              <p>Direct institutional representation, articulation agreements, and entry requirements</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="status-pill">{universities.length} Verified Partners</span>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: "12px" }}
                onClick={() => openUniversityForm()}
              >
                <Building2 size={14} />
                <span>Add University</span>
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table university-directory-table">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Programs</th>
                  <th>Admission Profile</th>
                  <th>Annual Tuition</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {universities.map(uni => (
                  <tr key={uni.id}>
                    <td>
                      <div>
                        <strong style={{ fontSize: "13.5px", color: "var(--text-main)" }}>{uni.name}</strong>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MapPin size={12} />
                          <span>{uni.city}</span><span>·</span><CountryFlag code={uni.countryCode} size={13}/><span>{uni.country}</span>
                        </div>
                        <span className="university-rank-label">{uni.ranking||"Accredited partner"}</span>
                      </div>
                    </td>

                    <td>
                      <div className="university-program-summary">
                        <strong>{universityCourses(uni).length} course{universityCourses(uni).length === 1 ? "" : "s"}</strong>
                        <span>{universityCourses(uni).slice(0, 2).map(course => course.name).join(" · ") || "No courses configured"}</span>
                      </div>
                    </td>

                    <td><div className="university-admission-summary"><span><b>GPA</b>{uni.minGpa||"N/A"}</span><span><b>PTE</b>{uni.minPte||"N/A"}</span><span><b>IELTS</b>{uni.minIelts||"N/A"}</span><small>Scholarship: {uni.scholarship||"N/A"}</small></div>
                    </td>

                    <td>
                      <strong className="code-font" style={{ fontSize: "12.5px" }}>
                        {tuitionWithCurrency(uni.tuition,uni.country)}
                      </strong>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div className="catalog-row-actions">
                        <button
                          type="button" className="catalog-icon-button" aria-label={`Edit ${uni.name}`} title="Edit university" onClick={()=>openUniversityForm(undefined,uni)}><Pencil size={14}/></button>
                        <button
                          type="button"
                          className="btn-secondary university-course-button"
                          onClick={() => openCourseManager(uni)}
                        >
                          <BookOpen size={13} />
                          <span>Courses</span>
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "11.5px" }}
                          onClick={() => navigate("/applications")}
                        >
                          <span>Apply</span>
                          <ChevronRight size={13} />
                        </button>
                        <button
                          type="button"
                          className="catalog-delete-icon"
                          aria-label={`End partnership with ${uni.name}`}
                          title="End university partnership"
                          onClick={() => handleDeleteUniversity(uni)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: STUDENT CONSULTATION & ADVISORY LOGS
          ========================================================================= */}
      {activeTab === "consultations" && (
        <div className="grid-2col consultation-workspace">
          {/* Left: Log Guidance Form */}
          <div className="crm-panel">
            <div className="panel-header-bar">
              <div>
                <h3>Log Student Consultation</h3>
                <p>Document advisory session, destination shortlisting & next steps</p>
              </div>
              <MessageSquarePlus size={18} style={{ color: "var(--accent-blue)" }} />
            </div>

            <div className="panel-body">
              <form onSubmit={handleSaveConsultation} className="consultation-form">
                <div className="form-group">
                  <label>Registered Student *</label>
                  <select
                    required
                    value={consultForm.studentCode}
                    disabled={consultationLoading}
                    onChange={e => {
                      const student = consultationStudents.find(item => item.student_code === e.target.value);
                      setConsultForm(current => ({ ...current, studentCode: student?.student_code ?? "", studentName: student?.fullName ?? "", targetCountry: student?.targetCountry && student.targetCountry !== "Undecided" ? student.targetCountry : current.targetCountry, preferredCourse: student?.targetCourse && student.targetCourse !== "Undecided" ? student.targetCourse : "" }));
                    }}
                  >
                    <option value="">{consultationLoading ? "Loading registered students…" : "Select student by name or AECS code"}</option>
                    {consultationStudents.map(student => <option key={student.id} value={student.student_code}>{student.fullName} · {student.student_code}</option>)}
                  </select>
                  {consultForm.studentCode && <div className="consultation-student-summary"><span>{consultForm.studentName.slice(0, 1).toUpperCase()}</span><div><strong>{consultForm.studentName}</strong><small>{consultForm.studentCode}</small></div><CheckCircle2 size={17}/></div>}
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Target Country *</label>
                    <select
                      value={consultForm.targetCountry}
                      onChange={e => setConsultForm({ ...consultForm, targetCountry: e.target.value })}
                    >
                      {destinations.map(c => (
                        <option key={c.code} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Outcome *</label>
                    <select
                      value={consultForm.stageOutcome}
                      onChange={e => setConsultForm({ ...consultForm, stageOutcome: e.target.value })}
                    >
                      <option value="University Shortlisted">University Shortlisted</option>
                      <option value="Eligible for Direct Entry">Eligible for Direct Entry</option>
                      <option value="Language Prep Required">Language Prep Required</option>
                      <option value="Financial Documentation Review">Financial Documentation Review</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Preferred Course</label>
                    <input value={consultForm.preferredCourse} onChange={e => setConsultForm({ ...consultForm, preferredCourse: e.target.value })} placeholder="e.g. MSc Data Science" />
                  </div>
                  <div className="form-group">
                    <label>Follow-up Date</label>
                    <input type="date" min={new Date().toISOString().slice(0, 10)} value={consultForm.followUpDate} onChange={e => setConsultForm({ ...consultForm, followUpDate: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Consultation Notes & Remarks *</label>
                  <textarea
                    required
                    rows={4}
                    value={consultForm.notes}
                    onChange={e => setConsultForm({ ...consultForm, notes: e.target.value })}
                    placeholder="Document GPA, test scores, shortlisted institutions, and action items discussed…"
                  />
                </div>

                {consultationError && <div className="consultation-inline-error"><AlertCircle size={15}/><span>{consultationError}</span></div>}
                <button type="submit" className="btn-primary" disabled={consultationSaving || consultationLoading}>
                  <UserCheck size={15} />
                  <span>{consultationSaving ? "Saving consultation…" : "Save Consultation Note"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right: Consultation History Log */}
          <div className="crm-panel">
            <div className="panel-header-bar">
              <div>
                <h3>Recent Consultation Records</h3>
                <p>Auditable log of counsellor-student guidance sessions</p>
              </div>
            </div>

            <div className="consultation-history">
              {!consultationLoading && records.length === 0 && <div className="consultation-empty"><div><MessageSquare size={22}/></div><strong>No consultations recorded yet</strong><span>Select a registered student and save the first advisory session. New records will appear here immediately.</span></div>}
              {records.map(r => (
                <article key={r.id} className="consultation-record">
                  <header><div className="consultation-avatar">{r.studentName.slice(0, 1).toUpperCase()}</div><div className="consultation-identity"><strong>{r.studentName}</strong><span>{r.studentCode} · {r.consultationDate}</span></div><span className="badge-status enrolled">{r.stageOutcome || "Completed"}</span></header>
                  <p>{r.notes}</p>
                  <div className="consultation-meta"><span><Globe size={14}/><CountryDisplay country={r.targetCountry || "Not selected"} size={14}/></span>{r.preferredCourse && <span><BookOpen size={14}/>{r.preferredCourse}</span>}{r.followUpDate && <span><CalendarClock size={14}/>Follow-up {r.followUpDate}</span>}</div>
                  <footer><span>Recorded by</span><strong>{r.counsellorName || "Unassigned staff"}</strong></footer>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: ADD COUNTRY / DESTINATION MODAL
          ========================================================================= */}
      <AnimatePresence>
        {showAddCountryModal && (
          <div className="modal-backdrop-clean" onClick={() => setShowAddCountryModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean"
              style={{ maxWidth: "600px" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean">
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    Add New Study Destination Catalog
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Configure country code, currency, intake periods, and work rights
                  </p>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowAddCountryModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateCountry}>
                <div className="modal-body-clean">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Country Name *</label>
                      <CountrySelect required placement="bottom" countries={ALL_COUNTRY_OPTIONS} value={newCountryForm.name} onChange={updateCountryName} placeholder="Search and select a country" />
                    </div>

                    <div className="form-group">
                      <label>ISO 2-Letter Code *</label>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        readOnly
                        value={newCountryForm.code}
                        placeholder="Generated automatically"
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Currency Code *</label>
                      <input
                        type="text"
                        required
                        readOnly
                        value={newCountryForm.currency}
                        placeholder="Generated automatically"
                      />
                    </div>

                    <div className="form-group">
                      <label>Dialing Code *</label>
                      <input
                        type="text"
                        required
                        readOnly
                        value={newCountryForm.dialCode}
                        placeholder="Generated automatically"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Popular Intakes *</label>
                    <MultiIntakePicker
                      value={newCountryForm.popularIntakes}
                      onChange={popularIntakes => setNewCountryForm({ ...newCountryForm, popularIntakes })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Post-Study Work Rights *</label>
                    <input
                      type="text"
                      required
                      value={newCountryForm.pswvWorkRights}
                      onChange={e => setNewCountryForm({ ...newCountryForm, pswvWorkRights: e.target.value })}
                      placeholder="e.g. 1.5 Years Stay-Back Visa"
                    />
                  </div>

                  <div className="form-group">
                    <label>Key Destination Highlights</label>
                    <textarea
                      rows={3}
                      value={newCountryForm.keyHighlights}
                      onChange={e => setNewCountryForm({ ...newCountryForm, keyHighlights: e.target.value })}
                      placeholder="Brief summary of why Nepali students should choose this country…"
                    />
                  </div>
                </div>

                <div className="modal-footer-clean">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAddCountryModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ background: "var(--accent-orange, #EA580C)", borderColor: "var(--accent-orange, #EA580C)" }}
                  >
                    <Plus size={15} />
                    <span>Save & Add Destination</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL 2: ADD PARTNER UNIVERSITY MODAL
          ========================================================================= */}
      <AnimatePresence>
        {selectedCourseUniversity && (
          <div className="modal-backdrop-clean" onClick={() => setCourseUniversityId(null)}>
            <motion.div
              initial={{ opacity: 0, y: 16, scale: .98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: .98 }}
              className="modal-dialog-clean university-course-manager"
              onClick={event => event.stopPropagation()}
            >
              <div className="modal-header-clean university-course-header">
                <div>
                  <span className="course-manager-eyebrow">University programme catalogue</span>
                  <h3>{selectedCourseUniversity.name}</h3>
                  <p><CountryDisplay country={selectedCourseUniversity.country} /> · {selectedCourseUniversity.city}</p>
                </div>
                <button type="button" className="drawer-close-btn" onClick={() => setCourseUniversityId(null)}><X size={18} /></button>
              </div>

              <div className="university-course-layout">
                <section className="university-course-list-panel">
                  <header>
                    <div><strong>Courses & degrees</strong><span>{universityCourses(selectedCourseUniversity).length} configured</span></div>
                    <button type="button" className="btn-secondary" onClick={resetCourseEditor}><Plus size={14} /> New course</button>
                  </header>
                  <div className="university-course-list">
                    {universityCourses(selectedCourseUniversity).length === 0 ? (
                      <div className="university-course-empty"><BookOpen size={25} /><strong>No courses configured</strong><span>Add the first programme offered by this university.</span></div>
                    ) : universityCourses(selectedCourseUniversity).map(course => (
                      <article key={course.id} className={editingCourseId === course.id ? "selected" : ""}>
                        <div className="university-course-card-heading">
                          <div><strong>{course.name}</strong><span>{course.qualification}{course.faculty ? ` · ${course.faculty}` : ""}</span></div>
                          <span className={`university-course-status ${course.status.toLowerCase()}`}>{course.status === "ACTIVE" ? "Active" : "Inactive"}</span>
                        </div>
                        <dl>
                          <div><dt>Duration</dt><dd>{course.duration || "—"}</dd></div>
                          <div><dt>Tuition</dt><dd>{course.tuitionFee || "—"}</dd></div>
                          <div><dt>Intakes</dt><dd>{course.intakes || "—"}</dd></div>
                          <div><dt>Entry</dt><dd>{course.minGpa ? `GPA ${course.minGpa}` : "Not set"}</dd></div>
                        </dl>
                        <footer>
                          <button type="button" onClick={() => editUniversityCourse(course)}><Pencil size={13} /> Edit details</button>
                          <button type="button" className="danger" onClick={() => deleteUniversityCourse(course)}><Trash2 size={13} /> Remove</button>
                        </footer>
                      </article>
                    ))}
                  </div>
                </section>

                <form className="university-course-form" onSubmit={saveUniversityCourse}>
                  <header><div><strong>{editingCourseId ? "Edit course" : "Add a course"}</strong><span>Programme, fees, intakes and admission requirements</span></div>{editingCourseId && <button type="button" onClick={resetCourseEditor}>Cancel edit</button>}</header>
                  <div className="university-course-form-body">
                    <div className="form-group course-form-wide"><label>Course / programme name *</label><input required value={courseForm.name} onChange={e => setCourseForm({...courseForm,name:e.target.value})} placeholder="e.g. MSc International Business" /></div>
                    <div className="form-group"><label>Qualification level *</label><select value={courseForm.qualification} onChange={e => setCourseForm({...courseForm,qualification:e.target.value})}><option>Bachelor's Degree</option><option>Master's Degree</option><option>PhD / Doctorate</option><option>Postgraduate Diploma</option><option>Graduate Certificate</option><option>Diploma</option><option>Foundation / Pathway</option><option>Certificate</option></select></div>
                    <div className="form-group"><label>Faculty / school</label><input value={courseForm.faculty} onChange={e => setCourseForm({...courseForm,faculty:e.target.value})} placeholder="Business School" /></div>
                    <div className="form-group"><label>Duration</label><input value={courseForm.duration} onChange={e => setCourseForm({...courseForm,duration:e.target.value})} placeholder="e.g. 2 years" /></div>
                    <div className="form-group"><label>Intakes</label><input value={courseForm.intakes} onChange={e => setCourseForm({...courseForm,intakes:e.target.value})} placeholder="September, January" /></div>
                    <div className="form-group"><label>Annual tuition</label><input value={courseForm.tuitionFee} onChange={e => setCourseForm({...courseForm,tuitionFee:e.target.value})} placeholder="e.g. GBP 18,500" /></div>
                    <div className="form-group"><label>Application fee</label><input value={courseForm.applicationFee} onChange={e => setCourseForm({...courseForm,applicationFee:e.target.value})} placeholder="e.g. GBP 100" /></div>
                    <div className="form-group"><label>Minimum GPA</label><input value={courseForm.minGpa} onChange={e => setCourseForm({...courseForm,minGpa:e.target.value})} placeholder="e.g. 3.0 / 4.0" /></div>
                    <div className="form-group"><label>Minimum IELTS</label><input value={courseForm.minIelts} onChange={e => setCourseForm({...courseForm,minIelts:e.target.value})} placeholder="e.g. 6.5, no band below 6.0" /></div>
                    <div className="form-group"><label>Minimum PTE</label><input value={courseForm.minPte} onChange={e => setCourseForm({...courseForm,minPte:e.target.value})} placeholder="e.g. 58" /></div>
                    <div className="form-group"><label>Course status</label><select value={courseForm.status} onChange={e => setCourseForm({...courseForm,status:e.target.value as UniversityCourse["status"]})}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
                    <div className="form-group course-form-wide"><label>Scholarship information</label><input value={courseForm.scholarship} onChange={e => setCourseForm({...courseForm,scholarship:e.target.value})} placeholder="Scholarship value, eligibility or deadline" /></div>
                    <div className="form-group course-form-wide"><label>Entry requirements & notes</label><textarea value={courseForm.requirements} onChange={e => setCourseForm({...courseForm,requirements:e.target.value})} placeholder="Academic prerequisites, portfolio, work experience and application notes..." /></div>
                  </div>
                  <footer><span>Active courses appear automatically in new university applications.</span><button type="submit" className="btn-primary"><Check size={15} /> {editingCourseId ? "Save changes" : "Add course"}</button></footer>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddUniModal && (
          <div className="modal-backdrop-clean" onClick={() => setShowAddUniModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean"
              style={{ maxWidth: "600px" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean">
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    {editingUniversityId?"Edit Partner University / Institution":"Add Partner University / Institution"}
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Configure university agreements, campus, rankings, and entry requirements
                  </p>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowAddUniModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateUniversity}>
                <div className="modal-body-clean">
                  <div className="form-group">
                    <label>University / College Name *</label>
                    <input
                      type="text"
                      required
                      value={newUniForm.name}
                      onChange={e => setNewUniForm({ ...newUniForm, name: e.target.value })}
                      placeholder="e.g. University of Manchester, Fanshawe College"
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>City & Campus *</label>
                      <input
                        type="text"
                        required
                        value={newUniForm.city}
                        onChange={e => setNewUniForm({ ...newUniForm, city: e.target.value })}
                        placeholder="e.g. Manchester, England"
                      />
                    </div>

                    <div className="form-group">
                      <label>Destination Country *</label>
                      <select
                        value={newUniForm.country}
                        onChange={e => {
                          const destination = destinations.find(item => item.name === e.target.value);
                          setNewUniForm({ ...newUniForm, country: e.target.value, countryCode: destination?.code ?? "" });
                        }}
                      >
                        {destinations.map(d => (
                          <option key={d.code} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Global Rank / Accreditation</label>
                      <input
                        type="text"
                        value={newUniForm.ranking}
                        onChange={e => setNewUniForm({ ...newUniForm, ranking: e.target.value })}
                        placeholder="e.g. Top 100 QS World, DLI #O19395"
                      />
                    </div>

                    <div className="form-group">
                      <label>Annual Tuition Fee *</label>
                      <div className="currency-input"><span>{universityCurrency(newUniForm.country)}</span><input
                        type="text"
                        required
                        value={newUniForm.tuition}
                        onChange={e => setNewUniForm({ ...newUniForm, tuition: e.target.value })}
                        placeholder="e.g. 250,000 / year"
                      /></div>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Minimum PTE Score</label>
                      <input
                        type="text"
                        value={newUniForm.minPte}
                        onChange={e => setNewUniForm({ ...newUniForm, minPte: e.target.value })}
                        placeholder="e.g. 58 (no band < 50)"
                      />
                    </div>

                    <div className="form-group">
                      <label>Minimum IELTS Score</label>
                      <input
                        type="text"
                        value={newUniForm.minIelts}
                        onChange={e => setNewUniForm({ ...newUniForm, minIelts: e.target.value })}
                        placeholder="e.g. 6.0 (5.5 in each band)"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Minimum GPA / Academic Requirement</label>
                    <input
                      type="text"
                      value={newUniForm.minGpa}
                      onChange={e => setNewUniForm({ ...newUniForm, minGpa: e.target.value })}
                      placeholder="e.g. 3.0/4.0, 2.8/4.0, or 60% aggregate"
                    />
                  </div>

                  <div className="form-group">
                    <label>Available Scholarships <small>(optional)</small></label>
                    <input
                      type="text"
                      value={newUniForm.scholarship}
                      onChange={e => setNewUniForm({ ...newUniForm, scholarship: e.target.value })}
                      placeholder="e.g. Up to £4,000 Academic Excellence Grant"
                    />
                  </div>

                  <div className="form-group">
                    <label>Popular Courses (comma separated)</label>
                    <input
                      type="text"
                      value={newUniForm.popularCourses}
                      onChange={e => setNewUniForm({ ...newUniForm, popularCourses: e.target.value })}
                      placeholder="e.g. MSc Data Science, MBA, Cyber Security, Nursing"
                    />
                  </div>
                </div>

                <div className="modal-footer-clean">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAddUniModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    <Building2 size={15} />
                    <span>{editingUniversityId?"Save Changes":"Save Partner University"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Country Detail Drawer Modal */}
      <AnimatePresence>
        {activeCountryDetail && (
          <div className="modal-backdrop-clean" onClick={() => setActiveCountryDetail(null)}>
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: "min(560px, 100vw)",
                background: "var(--bg-card)",
                borderLeft: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow-xl)",
                zIndex: 1500,
                display: "flex",
                flexDirection: "column",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                style={{
                  padding: "18px 22px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-card-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <CountryFlag code={activeCountryDetail.code} size={20} />
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0 }}>
                      {activeCountryDetail.name} Admissions Dossier
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Currency: {activeCountryDetail.currency} · Country Code: {activeCountryDetail.code}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setActiveCountryDetail(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "22px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <div className="destination-dossier-heading">
                    <h4>Destination profile</h4>
                    {!isEditingDestination && <button type="button" className="btn-secondary" onClick={() => beginDestinationEdit(activeCountryDetail)}>Edit details</button>}
                  </div>
                  {isEditingDestination ? (
                    <div className="destination-edit-grid">
                      <label>Destination name<input value={destinationEdit.name} onChange={event => setDestinationEdit({ ...destinationEdit, name: event.target.value })} /></label>
                      <label>ISO code<input value={activeCountryDetail.code} disabled /></label>
                      <label>Currency<input value={destinationEdit.currency} onChange={event => setDestinationEdit({ ...destinationEdit, currency: event.target.value })} /></label>
                      <label>Dialling code<input value={destinationEdit.dialCode} onChange={event => setDestinationEdit({ ...destinationEdit, dialCode: event.target.value })} /></label>
                      <label>Living expenses<input value={destinationEdit.avgLivingCost} onChange={event => setDestinationEdit({ ...destinationEdit, avgLivingCost: event.target.value })} /></label>
                      <label>Post-study work rights<input value={destinationEdit.pswvWorkRights} onChange={event => setDestinationEdit({ ...destinationEdit, pswvWorkRights: event.target.value })} /></label>
                      <label className="destination-edit-wide">Popular intakes<input value={destinationEdit.popularIntakes} onChange={event => setDestinationEdit({ ...destinationEdit, popularIntakes: event.target.value })} placeholder="September 2026, February 2027" /></label>
                      <label className="destination-edit-wide">Accepted English tests<input value={destinationEdit.acceptedEnglishTests} onChange={event => setDestinationEdit({ ...destinationEdit, acceptedEnglishTests: event.target.value })} placeholder="IELTS 6.0+, PTE 58+" /></label>
                      <label className="destination-edit-wide">Overview & highlights<textarea rows={4} value={destinationEdit.keyHighlights} onChange={event => setDestinationEdit({ ...destinationEdit, keyHighlights: event.target.value })} /></label>
                      <div className="destination-edit-actions"><button type="button" className="btn-secondary" onClick={() => setIsEditingDestination(false)}>Cancel</button><button type="button" className="btn-primary" onClick={saveDestinationEdit}><Check size={15} /> Save changes</button></div>
                    </div>
                  ) : (
                    <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-main)", margin: 0 }}>
                      {activeCountryDetail.keyHighlights || "No destination overview has been added yet."}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    fontSize: "12.5px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Partner Universities:</span>
                    <strong>{destinationUniversityCount(activeCountryDetail)} Institutions</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Statutory Living Expenses:</span>
                    <strong>{activeCountryDetail.avgLivingCost}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Post-Study Work Permit:</span>
                    <strong style={{ color: "var(--accent-blue)" }}>{activeCountryDetail.pswvWorkRights}</strong>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "13px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px" }}>
                    Accepted English Language Qualifications
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {activeCountryDetail.acceptedEnglishTests.length > 0 ? (
                      activeCountryDetail.acceptedEnglishTests.map((t, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "12.5px",
                            padding: "6px 10px",
                            borderRadius: "4px",
                            background: "var(--bg-card-subtle)",
                          }}
                        >
                          <BadgeCheck size={15} style={{ color: "var(--success, #059669)" }} />
                          <span>{t}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        No English-test requirements have been configured.
                      </span>
                    )}
                  </div>
                </div>

                <section className="destination-documents-panel">
                  <div className="destination-dossier-heading">
                    <div><h4>Destination documents</h4><p>Brochures, fee sheets, intake guides and partnership files.</p></div>
                    <label className="btn-secondary destination-upload-button"><Upload size={15} /> Upload<input type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={event => { void handleDestinationDocuments(event.target.files); event.currentTarget.value = ""; }} /></label>
                  </div>
                  {(destinationDocuments[activeCountryDetail.code] || []).length === 0 ? (
                    <div className="destination-documents-empty"><FileText size={22} /><span>No files attached to this destination yet.</span></div>
                  ) : (
                    <div className="destination-document-list">
                      {(destinationDocuments[activeCountryDetail.code] || []).map(document => (
                        <div className="destination-document-row" key={document.id}>
                          <FileText size={18} />
                          <div><strong>{document.name}</strong><span>{(document.size / 1024).toFixed(0)} KB · {new Date(document.uploadedAt).toLocaleDateString()}</span></div>
                          <button type="button" title="View document" onClick={() => window.open(document.dataUrl, "_blank", "noopener,noreferrer")}><Eye size={15} /></button>
                          <a title="Download document" href={document.dataUrl} download={document.name}><Download size={15} /></a>
                          <button type="button" title="Remove document" onClick={() => removeDestinationDocument(document.id)}><Trash2 size={15} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="destination-dossier-actions">
                  <button
                    type="button"
                    className="catalog-delete-button"
                    onClick={() => handleDeleteDestination(activeCountryDetail)}
                  >
                    <Trash2 size={15} />
                    <span>Remove destination</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setActiveCountryDetail(null);
                      navigate("/applications", { state: { openApplicationForm: true, country: activeCountryDetail.name, countryCode: activeCountryDetail.code } });
                    }}
                  >
                    <PlaneTakeoff size={15} />
                    <span>Start application</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CounsellingDashboard;
