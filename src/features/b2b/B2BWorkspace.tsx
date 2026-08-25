import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BadgeCheck,
  Building,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  Handshake,
  ImagePlus,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Phone,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CountryFlag } from "../../components/ui/PhoneInput";
import { CountryDisplay } from "../../components/ui/CountryDisplay";
import { COUNTRY_METADATA } from "../../lib/countryMetadata.generated";
import { B2BPartner, B2BService } from "../../services/b2bService";
import { useAuth } from "../auth/AuthProvider";
import { DocumentService } from "../../services/documentService";
import { validateDocumentFiles } from "../../lib/documentUploadPolicy";
import { notifyError, notifySuccess } from "../../components/common/CrmNotifications";

type FilterTab = "All partners" | "Active" | "In progress" | "Follow-ups" | "Inactive";

const WORLD_COUNTRIES = [...COUNTRY_METADATA].sort((a, b) => a[0].localeCompare(b[0]));
export function B2BWorkspace() {
  const { profile } = useAuth();

  const [partners, setPartners] = useState<B2BPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("All partners");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Drawer / Detail Modal
  const [activePartnerDetail, setActivePartnerDetail] = useState<B2BPartner | null>(null);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [savingPartner, setSavingPartner] = useState(false);
  const [partnerFormError, setPartnerFormError] = useState("");
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [interactionError, setInteractionError] = useState("");
  const [interactionSuccess, setInteractionSuccess] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [uploadingAgreement, setUploadingAgreement] = useState(false);

  const uploadPartnerAgreements = async (files: FileList | null) => {
    if (!activePartnerDetail || !files?.length) return;
    const selected = Array.from(files);
    if (!validateDocumentFiles(selected)) return;
    setUploadingAgreement(true);
    try {
      const results = await Promise.allSettled(selected.map(file => DocumentService.uploadB2B({ partnerId: activePartnerDetail.id, partnerCode: activePartnerDetail.code, partnerName: activePartnerDetail.name, file, expiresOn: activePartnerDetail.agreementExpiry })));
      const failed = results.filter(result => result.status === "rejected").length;
      if (failed) throw new Error(`${selected.length-failed} uploaded; ${failed} failed.`);
      notifySuccess(`${selected.length} agreement${selected.length===1?"":"s"} uploaded`, "The files are now available in the central Document Vault under B2B Agreements.");
    } catch (error) { notifyError("Agreement upload failed", error instanceof Error ? error.message : "Unable to upload the selected files."); }
    finally { setUploadingAgreement(false); }
  };

  // Add Partner Form State
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    type: "Sub-Agent / Channel Partner" as B2BPartner["type"],
    country: "",
    countryCode: "",
    city: "",
    photoUrl: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    status: "Active" as B2BPartner["status"],
    commissionTerms: "",
    agreementStatus: "Signed MOU" as B2BPartner["agreementStatus"],
    agreementExpiry: "",
    assignedStaff: profile?.full_name || "",
    nextFollowUp: "",
    referredStudentsCount: 0,
    totalPayoutClaimed: "",
    notes: "",
  });

  const emptyPartnerForm = () => ({
    name: "",
    type: "Sub-Agent / Channel Partner" as B2BPartner["type"],
    country: "",
    countryCode: "",
    city: "",
    photoUrl: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    status: "Active" as B2BPartner["status"],
    commissionTerms: "",
    agreementStatus: "Signed MOU" as B2BPartner["agreementStatus"],
    agreementExpiry: "",
    assignedStaff: profile?.full_name || "",
    nextFollowUp: "",
    referredStudentsCount: 0,
    totalPayoutClaimed: "",
    notes: "",
  });

  const closePartnerModal = () => {
    setShowAddPartnerModal(false);
    setEditingPartnerId(null);
    setPartnerFormError("");
    setShowCountryPicker(false);
    setCountrySearch("");
    setPartnerForm(emptyPartnerForm());
  };

  const cancelPartnerModal = () => {
    const partnerBeingEdited = editingPartnerId
      ? partners.find(partner => partner.id === editingPartnerId) || null
      : null;
    closePartnerModal();
    if (partnerBeingEdited) setActivePartnerDetail(partnerBeingEdited);
  };

  const openCreatePartnerModal = () => {
    setEditingPartnerId(null);
    setPartnerFormError("");
    setPartnerForm(emptyPartnerForm());
    setShowAddPartnerModal(true);
  };

  const openEditPartnerModal = (partner: B2BPartner) => {
    setEditingPartnerId(partner.id);
    setPartnerFormError("");
    setPartnerForm({
      name: partner.name,
      type: partner.type,
      country: partner.country,
      countryCode: partner.countryCode,
      city: partner.city || "",
      photoUrl: partner.photoUrl || "",
      contactPerson: partner.contactPerson,
      contactEmail: partner.contactEmail,
      contactPhone: partner.contactPhone,
      status: partner.status,
      commissionTerms: partner.commissionTerms,
      agreementStatus: partner.agreementStatus,
      agreementExpiry: partner.agreementExpiry || "",
      assignedStaff: partner.assignedStaff,
      nextFollowUp: partner.nextFollowUp || "",
      referredStudentsCount: partner.referredStudentsCount,
      totalPayoutClaimed: partner.totalPayoutClaimed,
      notes: partner.notes,
    });
    setActivePartnerDetail(null);
    setShowAddPartnerModal(true);
  };

  // Interaction / Meeting Log Form
  const [interactionNote, setInteractionNote] = useState({
    type: "Call / WhatsApp",
    date: new Date().toISOString().slice(0, 10),
    summary: "",
    nextFollowUp: "",
  });

  const openInteractionModal = (partner: B2BPartner | null = activePartnerDetail) => {
    if (partner) setActivePartnerDetail(partner);
    setInteractionError("");
    setInteractionNote({ type: "Call / WhatsApp", date: new Date().toISOString().slice(0, 10), summary: "", nextFollowUp: partner?.nextFollowUp || "" });
    setShowInteractionModal(true);
  };

  const handlePartnerPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file (JPG, PNG, WEBP, or GIF).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert("University photos must be 2 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPartnerForm(current => ({ ...current, photoUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const updateActivePartnerPhoto = async (file?: File) => {
    if (!file || !activePartnerDetail) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      window.alert("Choose a JPG, PNG, WEBP, or GIF image no larger than 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const photoUrl = String(reader.result || "");
      const updated = await B2BService.updatePartner(activePartnerDetail.id, { photoUrl });
      if (updated) {
        setActivePartnerDetail(updated);
        await loadPartners();
      }
    };
    reader.readAsDataURL(file);
  };

  // Load partners from service
  const loadPartners = async () => {
    setLoading(true);
    const data = await B2BService.getPartners();
    setPartners(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPartners();
  }, []);

  // Compute 4 Top Metrics
  const totalPartners = partners.length;
  const activePartners = partners.filter(p => p.status === "Active").length;
  const followUpsDue = partners.filter(p => p.status === "Follow-up Due" || (p.nextFollowUp && new Date(p.nextFollowUp) <= new Date("2026-08-25"))).length;
  const agreementsPending = partners.filter(p => p.agreementStatus === "Under Review" || p.agreementStatus === "Draft Pending" || p.status === "Agreement Pending").length;

  // Filtered partners list
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      // Tab filter
      if (activeFilterTab === "Active" && p.status !== "Active") return false;
      if (activeFilterTab === "In progress" && p.status !== "In progress") return false;
      if (activeFilterTab === "Follow-ups" && p.status !== "Follow-up Due") return false;
      if (activeFilterTab === "Inactive" && p.status !== "Inactive") return false;

      // Status dropdown filter
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;

      // Type dropdown filter
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.contactPerson.toLowerCase().includes(q) ||
          p.contactEmail.toLowerCase().includes(q) ||
          p.country.toLowerCase().includes(q) ||
          (p.city && p.city.toLowerCase().includes(q)) ||
          p.commissionTerms.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [partners, activeFilterTab, statusFilter, typeFilter, searchQuery]);

  // Handle Add Partner Submit
  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerForm.name.trim() || !partnerForm.contactPerson.trim()) {
      setPartnerFormError("Partner name and primary contact are required.");
      return;
    }

    setSavingPartner(true);
    setPartnerFormError("");

    // Find country code
    const matchedCountry = WORLD_COUNTRIES.find(country => country[0] === partnerForm.country);
    const countryCode = matchedCountry?.[1] || partnerForm.countryCode || "";

    const payload = {
      name: partnerForm.name.trim(),
      type: partnerForm.type,
      country: partnerForm.country,
      countryCode: countryCode,
      city: partnerForm.city.trim(),
      photoUrl: partnerForm.photoUrl,
      contactPerson: partnerForm.contactPerson.trim(),
      contactEmail: partnerForm.contactEmail.trim(),
      contactPhone: partnerForm.contactPhone.trim(),
      status: partnerForm.status,
      commissionTerms: partnerForm.commissionTerms.trim(),
      agreementStatus: partnerForm.agreementStatus,
      agreementExpiry: partnerForm.agreementExpiry,
      assignedStaff: partnerForm.assignedStaff,
      nextFollowUp: partnerForm.nextFollowUp,
      referredStudentsCount: Number(partnerForm.referredStudentsCount) || 0,
      totalPayoutClaimed: partnerForm.totalPayoutClaimed,
      // Interaction history is append-only and must never be overwritten by profile edits.
      notes: editingPartnerId
        ? (partners.find(partner => partner.id === editingPartnerId)?.notes ?? "")
        : "",
    };

    try {
      if (editingPartnerId) {
        const updated = await B2BService.updatePartner(editingPartnerId, payload);
        if (!updated) throw new Error("The partner record could not be found.");
        setPartners(current => current.map(partner => partner.id === updated.id ? updated : partner));
        setActivePartnerDetail(updated);
        setInteractionSuccess("Partner details updated successfully.");
      } else {
        const created = await B2BService.createPartner(payload);
        setPartners(current => [created, ...current]);
      }
      closePartnerModal();
    } catch (cause) {
      setPartnerFormError(cause instanceof Error ? cause.message : "Unable to save this partner.");
    } finally {
      setSavingPartner(false);
    }
  };

  // Handle Log Interaction Submit
  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePartnerDetail || !interactionNote.summary.trim() || !interactionNote.date) {
      setInteractionError("Choose an interaction date and enter a meaningful summary.");
      return;
    }
    setSavingInteraction(true);
    setInteractionError("");
    try {
      const newEntry = `[${interactionNote.date} · ${interactionNote.type}]\n${interactionNote.summary.trim()}`;
      const newNote = activePartnerDetail.notes ? `${newEntry}\n\n${activePartnerDetail.notes}` : newEntry;
      const updated = await B2BService.updatePartner(activePartnerDetail.id, {
        notes: newNote,
        nextFollowUp: interactionNote.nextFollowUp,
        status: interactionNote.nextFollowUp ? "Follow-up Due" : activePartnerDetail.status,
      });
      if (!updated) throw new Error("The partner record could not be found.");
      setActivePartnerDetail(updated);
      setPartners(current => current.map(partner => partner.id === updated.id ? updated : partner));
      setShowInteractionModal(false);
      setInteractionSuccess("Interaction saved. The meeting log and follow-up schedule are now updated.");
      setInteractionNote({ type: "Call / WhatsApp", date: new Date().toISOString().slice(0, 10), summary: "", nextFollowUp: "" });
    } catch (cause) {
      setInteractionError(cause instanceof Error ? cause.message : "Unable to save this interaction.");
    } finally {
      setSavingInteraction(false);
    }
  };

  // Handle Delete Partner
  const handleDeletePartner = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove partner "${name}"?`)) {
      await B2BService.deletePartner(id);
      if (activePartnerDetail?.id === id) setActivePartnerDetail(null);
      await loadPartners();
    }
  };

  return (
    <div className="page-container">
      {/* 1. Header Row (Matching User Screenshot) */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>B2B partner tracking</h2>
          <p>
            Manage universities, institutions, agents, aggregators, and recruitment partners.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: "flex", gap: "10px" }}>
          {/* Export CSV Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => B2BService.exportCsv(partners)}
          >
            <FileSpreadsheet size={15} />
            <span>Export CSV</span>
          </button>

          {/* + Add Partner Button */}
          <button
            type="button"
            className="btn-primary"
            style={{ background: "#0F172A", borderColor: "#0F172A", color: "#FFFFFF" }}
            onClick={openCreatePartnerModal}
          >
            <Plus size={15} />
            <span>Add partner</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Metric Strip (Matching User Screenshot) */}
      <div className="metrics-grid-4" style={{ marginBottom: "20px" }}>
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Total partners</span>
            <div className="metric-icon-wrap blue">
              <Handshake size={17} />
            </div>
          </div>
          <div className="metric-value">{totalPartners}</div>
          <span className="metric-sub">Registered global network</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Active partners</span>
            <div className="metric-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="metric-value">{activePartners}</div>
          <span className="metric-sub">Commercial agreements live</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Follow-ups due</span>
            <div className="metric-icon-wrap amber">
              <CalendarClock size={17} />
            </div>
          </div>
          <div className="metric-value">{followUpsDue}</div>
          <span className="metric-sub">Urgent attention needed</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Agreements pending</span>
            <div className="metric-icon-wrap purple">
              <FileCheck2 size={17} />
            </div>
          </div>
          <div className="metric-value">{agreementsPending}</div>
          <span className="metric-sub">Contracts awaiting signature</span>
        </div>
      </div>

      {/* 3. Main Data Panel (Matching Screenshot layout) */}
      <div className="crm-panel" style={{ padding: 0, overflow: "hidden" }}>
        {/* Filter Navigation Strip */}
        <div className="partner-directory-toolbar">
          {/* Filter Pills (All partners, Active, In progress, Follow-ups, Inactive) */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {(["All partners", "Active", "In progress", "Follow-ups", "Inactive"] as FilterTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                className={`filter-pill-btn ${activeFilterTab === tab ? "active" : ""}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: activeFilterTab === tab ? "1px solid var(--text-main)" : "1px solid var(--border-subtle)",
                  background: activeFilterTab === tab ? "var(--text-main)" : "var(--bg-card)",
                  color: activeFilterTab === tab ? "var(--bg-card)" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => setActiveFilterTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search bar + Statuses select + Search button */}
          <div className="partner-directory-searches">
            <div className="search-input-wrap">
              <Search size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search partners.."
              />
            </div>

            <select
              className="crm-select"
              style={{ width: "140px" }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="Active">Active</option>
              <option value="In progress">In progress</option>
              <option value="Follow-up Due">Follow-up Due</option>
              <option value="Agreement Pending">Agreement Pending</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="table-wrapper">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Partner organization</th>
                <th>Partnership</th>
                <th>Location</th>
                <th>Primary contact</th>
                <th>Status & follow-up</th>
                <th>Relationship owner</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                      <Handshake size={32} style={{ opacity: 0.35 }} />
                      <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>No partners match this view.</strong>
                      <span style={{ fontSize: "12px" }}>Try adjusting your search query, status filters, or add a new B2B partner.</span>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ marginTop: "6px" }}
                        onClick={() => {
                          setActiveFilterTab("All partners");
                          setSearchQuery("");
                          setStatusFilter("ALL");
                        }}
                      >
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPartners.map(partner => {
                  const initials = partner.name
                    .split(" ")
                    .map(n => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  const statusClass =
                    partner.status === "Active"
                      ? "enrolled"
                      : partner.status === "In progress"
                      ? "new-lead"
                      : partner.status === "Follow-up Due"
                      ? "counselling"
                      : partner.status === "Agreement Pending"
                      ? "purple"
                      : "counselling";

                  return (
                    <tr
                      key={partner.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setActivePartnerDetail(partner)}
                    >
                      {/* Partner Name & City */}
                      <td>
                        <div className="partner-identity-cell">
                          <div className="partner-table-photo">
                            {partner.photoUrl ? (
                              <img src={partner.photoUrl} alt={`${partner.name} campus`} />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div>
                            <span className="partner-code-label">{partner.code}</span>
                            <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>
                              {partner.name}
                            </strong>
                            {partner.city && (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                                <MapPin size={11} />
                                <span>{partner.city}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Partnership */}
                      <td>
                        <div className="partner-relationship-cell">
                          <span>{partner.type}</span>
                          <strong>{partner.commissionTerms}</strong>
                        </div>
                      </td>

                      {/* Country */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <CountryFlag code={partner.countryCode || "NP"} size={16} />
                          <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{partner.country}</span>
                        </div>
                      </td>

                      {/* Contact */}
                      <td>
                        <div style={{ fontSize: "12px" }}>
                          <strong style={{ color: "var(--text-main)" }}>{partner.contactPerson}</strong>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>{partner.contactPhone}</div>
                        </div>
                      </td>

                      {/* Status & Next Follow-Up */}
                      <td>
                        <div className="partner-status-cell">
                          <span className={`badge-status ${statusClass}`}>
                            {partner.status}
                          </span>
                          <span>
                            <Calendar size={13} />
                            {partner.nextFollowUp || "No follow-up set"}
                          </span>
                        </div>
                      </td>

                      {/* Staff */}
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--text-main)" }}>
                          {partner.assignedStaff}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => setActivePartnerDetail(partner)}
                            title="View Dossier"
                          >
                            <Eye size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px", color: "var(--success, #059669)" }}
                            onClick={() => openInteractionModal(partner)}
                            title="Log Meeting / Note"
                          >
                            <MessageSquarePlus size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL: ADD NEW B2B PARTNER
          ========================================================================= */}
      <AnimatePresence>
        {showAddPartnerModal && (
          <div
            className="modal-backdrop-clean"
            onClick={cancelPartnerModal}
            style={{ zIndex: editingPartnerId ? 1700 : 100 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean"
              style={{ maxWidth: "650px" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean">
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    {editingPartnerId ? "Edit B2B Partner / Associate" : "Register New B2B Partner / Associate"}
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {editingPartnerId
                      ? "Update the partner profile, commercial terms, ownership, and follow-up schedule"
                      : "Configure recruitment channels, commercial commission structures, and MOU terms"}
                  </p>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={cancelPartnerModal}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddPartner}>
                <div className="modal-body-clean">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Organization / Partner Name *</label>
                      <input
                        type="text"
                        required
                        value={partnerForm.name}
                        onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })}
                        placeholder="e.g. Oxford International, Apex Education Pokhara"
                      />
                    </div>

                    <div className="form-group">
                      <label>Partner Type *</label>
                      <select
                        value={partnerForm.type}
                        onChange={e => setPartnerForm({ ...partnerForm, type: e.target.value as any })}
                      >
                        <option value="Sub-Agent / Channel Partner">Sub-Agent / Channel Partner</option>
                        <option value="Direct University Partner">Direct University Partner</option>
                        <option value="Aggregator">Aggregator (ApplyBoard, Adventus)</option>
                        <option value="Global Recruiter">Global Recruiter</option>
                        <option value="Language & Test Center">Language & Test Center</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>University / Organization Photo (Optional)</label>
                    <div className="partner-photo-uploader">
                      <div className="partner-photo-preview">
                        {partnerForm.photoUrl ? (
                          <img src={partnerForm.photoUrl} alt="Selected university" />
                        ) : (
                          <ImagePlus size={22} />
                        )}
                      </div>
                      <div>
                        <label className="partner-photo-select">
                          <ImagePlus size={14} />
                          <span>{partnerForm.photoUrl ? "Replace photo" : "Upload photo"}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={event => handlePartnerPhoto(event.target.files?.[0])}
                          />
                        </label>
                        <p>JPG, PNG, WEBP or GIF · maximum 2 MB</p>
                      </div>
                      {partnerForm.photoUrl && (
                        <button
                          type="button"
                          className="partner-photo-remove"
                          onClick={() => setPartnerForm(current => ({ ...current, photoUrl: "" }))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Country *</label>
                      <div className="world-country-picker">
                        <button
                          type="button"
                          className={`world-country-trigger ${showCountryPicker ? "open" : ""}`}
                          aria-expanded={showCountryPicker}
                          onClick={() => {
                            setShowCountryPicker(open => !open);
                            setCountrySearch("");
                          }}
                        >
                          {partnerForm.country ? (
                            <span>
                              <CountryFlag
                                code={WORLD_COUNTRIES.find(country => country[0] === partnerForm.country)?.[1] || ""}
                                size={17}
                              />
                              <strong>{partnerForm.country}</strong>
                            </span>
                          ) : (
                            <span className="world-country-placeholder">Select a country</span>
                          )}
                          <ChevronDown size={15} />
                        </button>
                        {showCountryPicker && (
                          <div className="world-country-menu">
                            <div className="world-country-search">
                              <Search size={14} />
                              <input
                                autoFocus
                                type="search"
                                value={countrySearch}
                                onChange={event => setCountrySearch(event.target.value)}
                                placeholder="Search country or ISO code..."
                              />
                            </div>
                            {WORLD_COUNTRIES.filter(country => {
                              const query = countrySearch.trim().toLowerCase();
                              return !query || country[0].toLowerCase().includes(query) || country[1].toLowerCase().includes(query);
                            }).map(country => (
                              <button
                                type="button"
                                key={country[1]}
                                className={partnerForm.country === country[0] ? "selected" : ""}
                                onClick={() => {
                                  setPartnerForm(current => ({
                                    ...current,
                                    country: country[0],
                                    countryCode: country[1],
                                    contactPhone: `${country[3]} `,
                                  }));
                                  setShowCountryPicker(false);
                                }}
                              >
                                <CountryFlag code={country[1]} size={17} />
                                <span>{country[0]}</span>
                                <small>{country[1]}</small>
                              </button>
                            ))}
                            {WORLD_COUNTRIES.filter(country => {
                              const query = countrySearch.trim().toLowerCase();
                              return !query || country[0].toLowerCase().includes(query) || country[1].toLowerCase().includes(query);
                            }).length === 0 && (
                              <div className="world-country-empty">No matching country found.</div>
                            )}
                          </div>
                        )}
                        <input className="world-country-required" tabIndex={-1} required value={partnerForm.country} onChange={() => {}} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>City / Regional Office *</label>
                      <input
                        type="text"
                        required
                        value={partnerForm.city}
                        onChange={e => setPartnerForm({ ...partnerForm, city: e.target.value })}
                        placeholder="e.g. Pokhara, London, Melbourne"
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Primary Contact Person *</label>
                      <input
                        type="text"
                        required
                        value={partnerForm.contactPerson}
                        onChange={e => setPartnerForm({ ...partnerForm, contactPerson: e.target.value })}
                        placeholder="e.g. Kiran Gurung"
                      />
                    </div>

                    <div className="form-group">
                      <label>Contact Phone / WhatsApp *</label>
                      <input
                        type="text"
                        required
                        value={partnerForm.contactPhone}
                        onChange={e => setPartnerForm({ ...partnerForm, contactPhone: e.target.value })}
                        placeholder="+977 9856012345"
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Official Email *</label>
                      <input
                        type="email"
                        required
                        value={partnerForm.contactEmail}
                        onChange={e => setPartnerForm({ ...partnerForm, contactEmail: e.target.value })}
                        placeholder="partnerships@organization.com"
                      />
                    </div>

                    <div className="form-group">
                      <label>Status *</label>
                      <select
                        value={partnerForm.status}
                        onChange={e => setPartnerForm({ ...partnerForm, status: e.target.value as any })}
                      >
                        <option value="Active">Active</option>
                        <option value="In progress">In progress</option>
                        <option value="Follow-up Due">Follow-up Due</option>
                        <option value="Agreement Pending">Agreement Pending</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Commercial Commission Terms *</label>
                    <input
                      type="text"
                      required
                      value={partnerForm.commissionTerms}
                      onChange={e => setPartnerForm({ ...partnerForm, commissionTerms: e.target.value })}
                      placeholder="e.g. 15% of 1st Year Tuition or 60/40 Sub-Agent split"
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Agreement / MOU Status</label>
                      <select
                        value={partnerForm.agreementStatus}
                        onChange={e => setPartnerForm({ ...partnerForm, agreementStatus: e.target.value as any })}
                      >
                        <option value="Signed MOU">Signed MOU</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Draft Pending">Draft Pending</option>
                        <option value="Expired">Expired</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Next Follow-Up Date</label>
                      <input
                        type="date"
                        value={partnerForm.nextFollowUp}
                        onChange={e => setPartnerForm({ ...partnerForm, nextFollowUp: e.target.value })}
                      />
                    </div>
                  </div>

                  {editingPartnerId && (
                    <div className="b2b-readonly-history-note">
                      <ShieldCheck size={17}/>
                      <div><strong>Interaction history is protected</strong><span>Partnership notes and logged interactions are read-only here. Add a new entry using “Log Interaction” from the partner profile.</span></div>
                    </div>
                  )}
                </div>

                <div className="modal-footer-clean">
                  {partnerFormError && (
                    <div style={{ color: "var(--danger, #DC2626)", fontSize: "12px", marginRight: "auto" }}>
                      {partnerFormError}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={cancelPartnerModal}
                    disabled={savingPartner}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ background: "#0F172A", borderColor: "#0F172A" }}
                    disabled={savingPartner}
                  >
                    <Handshake size={15} />
                    <span>{savingPartner ? "Saving…" : editingPartnerId ? "Save Changes" : "Save B2B Partner"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          DRAWER: PARTNER DETAILS & INTERACTION DOSSIER
          ========================================================================= */}
      <AnimatePresence>
        {activePartnerDetail && (
          <div className="modal-backdrop-clean" onClick={() => setActivePartnerDetail(null)}>
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
                width: "min(580px, 100vw)",
                background: "var(--bg-card)",
                borderLeft: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow-xl)",
                zIndex: 1500,
                display: "flex",
                flexDirection: "column",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Drawer Header */}
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
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="partner-drawer-photo">
                    {activePartnerDetail.photoUrl ? (
                      <img src={activePartnerDetail.photoUrl} alt={activePartnerDetail.name} />
                    ) : (
                      activePartnerDetail.code
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                      {activePartnerDetail.name}
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {activePartnerDetail.type} · <CountryDisplay country={activePartnerDetail.country} size={13}/>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "7px 11px", fontSize: "12px" }}
                    onClick={() => openEditPartnerModal(activePartnerDetail)}
                  >
                    <Pencil size={14} />
                    <span>Edit partner</span>
                  </button>
                  <button
                    type="button"
                    className="drawer-close-btn"
                    onClick={() => setActivePartnerDetail(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div style={{ padding: "22px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div className="partner-photo-management">
                  <div>
                    <strong>University profile photo</strong>
                    <span>Upload or replace the official campus or institution image.</span>
                  </div>
                  <label className="partner-photo-select">
                    <ImagePlus size={14} />
                    <span>{activePartnerDetail.photoUrl ? "Replace photo" : "Upload photo"}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={event => updateActivePartnerPhoto(event.target.files?.[0])}
                    />
                  </label>
                </div>
                <div className="partner-photo-management">
                  <div><strong>Agreements & MOU documents</strong><span>Upload signed agreements to the central Document Vault. Multiple files supported.</span></div>
                  <label className="partner-photo-select">
                    <FileText size={14}/><span>{uploadingAgreement?"Uploading…":"Upload documents"}</span>
                    <input type="file" multiple disabled={uploadingAgreement} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={event=>{void uploadPartnerAgreements(event.target.files);event.currentTarget.value=""}}/>
                  </label>
                </div>
                {/* 3 KPIs */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "10px",
                  }}
                >
                  <div style={{ padding: "12px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      Referred Students
                    </span>
                    <strong style={{ fontSize: "18px", color: "var(--text-main)" }}>
                      {activePartnerDetail.referredStudentsCount}
                    </strong>
                  </div>

                  <div style={{ padding: "12px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      MOU Status
                    </span>
                    <strong style={{ fontSize: "13px", color: "var(--success, #059669)" }}>
                      {activePartnerDetail.agreementStatus}
                    </strong>
                  </div>

                  <div style={{ padding: "12px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                      Payout Claimed
                    </span>
                    <strong style={{ fontSize: "13px", color: "var(--accent-blue)" }}>
                      {activePartnerDetail.totalPayoutClaimed}
                    </strong>
                  </div>
                </div>

                {/* Primary Contact Card */}
                <div
                  style={{
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>
                    Primary Point of Contact
                  </strong>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Contact Person:</span>
                    <strong>{activePartnerDetail.contactPerson}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Email Address:</span>
                    <a href={`mailto:${activePartnerDetail.contactEmail}`} style={{ color: "var(--accent-blue)", fontWeight: 600 }}>
                      {activePartnerDetail.contactEmail}
                    </a>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Direct Phone:</span>
                    <a href={`tel:${activePartnerDetail.contactPhone}`} style={{ color: "var(--accent-blue)", fontWeight: 600 }}>
                      {activePartnerDetail.contactPhone}
                    </a>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Commission Structure:</span>
                    <strong style={{ color: "var(--success-text, #059669)" }}>{activePartnerDetail.commissionTerms}</strong>
                  </div>
                </div>

                {/* Notes & Interaction History */}
                <div>
                  {interactionSuccess && <div className="b2b-interaction-success"><CheckCircle2 size={16}/><span>{interactionSuccess}</span><button type="button" onClick={() => setInteractionSuccess("")}><X size={14}/></button></div>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "13px" }}>Commercial Terms & Meeting Logs</strong>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "11.5px" }}
                      onClick={() => openInteractionModal()}
                    >
                      <Plus size={12} />
                      <span>Log Interaction</span>
                    </button>
                  </div>

                  <div
                    style={{
                      background: "var(--bg-card-subtle)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      padding: "14px",
                      fontSize: "12.5px",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      color: "var(--text-main)",
                    }}
                  >
                    {activePartnerDetail.notes || "No interaction notes logged yet."}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ marginTop: "auto", display: "flex", gap: "10px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, color: "var(--danger, #DC2626)" }}
                    onClick={() => handleDeletePartner(activePartnerDetail.id, activePartnerDetail.name)}
                  >
                    Remove Partner
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1.5 }}
                    onClick={() => openInteractionModal()}
                  >
                    <MessageSquarePlus size={15} />
                    <span>Log Meeting Note</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL: LOG MEETING / INTERACTION NOTE
          ========================================================================= */}
      <AnimatePresence>
        {showInteractionModal && activePartnerDetail && (
          <div className="modal-backdrop-clean" onClick={() => setShowInteractionModal(false)} style={{ zIndex: 1600 }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean"
              style={{ maxWidth: "500px" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean">
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    Log Interaction: {activePartnerDetail.name}
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Record minutes of meeting, student referral updates, and action items
                  </p>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowInteractionModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveInteraction}>
                <div className="modal-body-clean">
                  {interactionError && <div className="case-task-alert"><AlertCircle size={16}/><span>{interactionError}</span></div>}
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Interaction Channel *</label>
                      <select
                        value={interactionNote.type}
                        onChange={e => setInteractionNote({ ...interactionNote, type: e.target.value })}
                      >
                        <option value="In-Person Meeting">In-Person Meeting</option>
                        <option value="Zoom / Online Call">Zoom / Online Call</option>
                        <option value="Call / WhatsApp">Call / WhatsApp</option>
                        <option value="Email Exchange">Email Exchange</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Interaction Date *</label>
                      <input
                        type="date"
                        required
                        value={interactionNote.date}
                        onChange={e => setInteractionNote({ ...interactionNote, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Meeting Summary & Action Items *</label>
                    <textarea
                      rows={4}
                      required
                      value={interactionNote.summary}
                      onChange={e => setInteractionNote({ ...interactionNote, summary: e.target.value })}
                      placeholder="Document discussion on applicant volume, pending commission payouts, or university visits…"
                    />
                  </div>

                  <div className="form-group">
                    <label>Next Follow-Up Date</label>
                    <input
                      type="date"
                      value={interactionNote.nextFollowUp}
                      onChange={e => setInteractionNote({ ...interactionNote, nextFollowUp: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer-clean">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowInteractionModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={savingInteraction}>
                    <Check size={15} />
                    <span>{savingInteraction ? "Saving interaction…" : "Save Interaction"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default B2BWorkspace;
