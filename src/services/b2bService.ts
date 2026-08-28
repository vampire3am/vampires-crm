import { supabase } from "../lib/supabase";
import { generateUuid } from "../lib/generateUuid";

export interface B2BPartner {
  id: string; code: string; name: string;
  type: "Aggregator" | "Direct University Partner" | "Sub-Agent / Channel Partner" | "Global Recruiter" | "Language & Test Center";
  country: string; countryCode: string; city?: string; photoUrl?: string;
  contactPerson: string; contactEmail: string; contactPhone: string;
  status: "Active" | "In progress" | "Agreement Pending" | "Follow-up Due" | "Inactive";
  commissionTerms: string;
  agreementStatus: "Signed MOU" | "Under Review" | "Draft Pending" | "Expired";
  agreementExpiry: string; assignedStaff: string; nextFollowUp: string;
  referredStudentsCount: number; totalPayoutClaimed: string; notes: string; createdAt: string;
}

const LEGACY_STORAGE_KEY = "aecs_persistent_b2b_partners_v2";
type PartnerRow = Record<string, any>;

const toRow = (partner: Partial<B2BPartner>) => ({
  id: partner.id, code: partner.code, name: partner.name, partner_type: partner.type,
  country: partner.country, country_code: partner.countryCode, city: partner.city,
  photo_url: partner.photoUrl, contact_person: partner.contactPerson,
  contact_email: partner.contactEmail, contact_phone: partner.contactPhone,
  status: partner.status, commission_terms: partner.commissionTerms,
  agreement_status: partner.agreementStatus,
  agreement_expiry: partner.agreementExpiry || undefined,
  assigned_staff: partner.assignedStaff, next_follow_up: partner.nextFollowUp || undefined,
  referred_students_count: partner.referredStudentsCount,
  total_payout_claimed: partner.totalPayoutClaimed, notes: partner.notes,
  created_at: partner.createdAt ? `${partner.createdAt}T00:00:00Z` : undefined,
});

const cleanRow = (row: PartnerRow) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));

const fromRow = (row: PartnerRow): B2BPartner => ({
  id: row.id, code: row.code, name: row.name, type: row.partner_type,
  country: row.country, countryCode: row.country_code, city: row.city || "", photoUrl: row.photo_url || "",
  contactPerson: row.contact_person, contactEmail: row.contact_email, contactPhone: row.contact_phone,
  status: row.status, commissionTerms: row.commission_terms, agreementStatus: row.agreement_status,
  agreementExpiry: row.agreement_expiry || "", assignedStaff: row.assigned_staff,
  nextFollowUp: row.next_follow_up || "", referredStudentsCount: Number(row.referred_students_count || 0),
  totalPayoutClaimed: row.total_payout_claimed || "NPR 0", notes: row.notes || "",
  createdAt: String(row.created_at).slice(0, 10),
});

async function migrateLegacyPartners() {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw) as B2BPartner[];
    if (!legacy.length) { localStorage.removeItem(LEGACY_STORAGE_KEY); return; }
    const { error } = await supabase.from("b2b_partners").upsert(legacy.map(item => cleanRow(toRow(item))), { onConflict: "id" });
    if (error) throw error;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch { /* Keep the legacy copy when migration fails. */ }
}

export const B2BService = {
  async getPartners(): Promise<B2BPartner[]> {
    await migrateLegacyPartners();
    const { data, error } = await supabase.from("b2b_partners").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(fromRow);
  },
  async createPartner(partner: Omit<B2BPartner, "id" | "code" | "createdAt">): Promise<B2BPartner> {
    const record = { ...partner, id: generateUuid(), code: `B2B-${Date.now().toString().slice(-7)}`, createdAt: new Date().toISOString().slice(0, 10) };
    const { data, error } = await supabase.from("b2b_partners").insert(cleanRow(toRow(record))).select("*").single();
    if (error) throw error;
    return fromRow(data);
  },
  async updatePartner(id: string, patch: Partial<B2BPartner>): Promise<B2BPartner | null> {
    const row = cleanRow(toRow(patch)); delete row.id; delete row.code; delete row.created_at;
    const { data, error } = await supabase.from("b2b_partners").update(row).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  },
  async deletePartner(id: string): Promise<boolean> {
    const { error } = await supabase.from("b2b_partners").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
  exportCsv(partners: B2BPartner[]) {
    const headers = ["ID","Partner Name","Type","Country","City","Contact Person","Contact Email","Contact Phone","Status","Commission Terms","Agreement Status","Agreement Expiry","Staff Owner","Next Follow-up","Referred Students","Payout Claimed"];
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = partners.map(p => [p.code,p.name,p.type,p.country,p.city,p.contactPerson,p.contactEmail,p.contactPhone,p.status,p.commissionTerms,p.agreementStatus,p.agreementExpiry,p.assignedStaff,p.nextFollowUp,p.referredStudentsCount,p.totalPayoutClaimed].map(quote));
    const url = URL.createObjectURL(new Blob([[headers.join(","), ...rows.map(row => row.join(","))].join("\n")], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = `AECS_B2B_Partners_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  },
};
