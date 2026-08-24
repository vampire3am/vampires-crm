export interface B2BPartner {
  id: string;
  code: string; // e.g. B2B-101
  name: string;
  type: "Aggregator" | "Direct University Partner" | "Sub-Agent / Channel Partner" | "Global Recruiter" | "Language & Test Center";
  country: string;
  countryCode: string;
  city?: string;
  photoUrl?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  status: "Active" | "In progress" | "Agreement Pending" | "Follow-up Due" | "Inactive";
  commissionTerms: string;
  agreementStatus: "Signed MOU" | "Under Review" | "Draft Pending" | "Expired";
  agreementExpiry: string;
  assignedStaff: string;
  nextFollowUp: string;
  referredStudentsCount: number;
  totalPayoutClaimed: string;
  notes: string;
  createdAt: string;
}

const STORAGE_KEY = "aecs_persistent_b2b_partners_v2";

const INITIAL_B2B_PARTNERS: B2BPartner[] = [];

export const B2BService = {
  getPartners: async (): Promise<B2BPartner[]> => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_B2B_PARTNERS;
  },

  savePartners: (partners: B2BPartner[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(partners));
  },

  createPartner: async (partner: Omit<B2BPartner, "id" | "code" | "createdAt">): Promise<B2BPartner> => {
    const current = await B2BService.getPartners();
    const nextNum = current.length + 101;
    const newPartner: B2BPartner = {
      ...partner,
      id: `b2b-${Date.now()}`,
      code: `B2B-${nextNum}`,
      createdAt: new Date().toISOString().split("T")[0],
    };
    const updated = [newPartner, ...current];
    B2BService.savePartners(updated);
    return newPartner;
  },

  updatePartner: async (id: string, patch: Partial<B2BPartner>): Promise<B2BPartner | null> => {
    const current = await B2BService.getPartners();
    const index = current.findIndex(p => p.id === id);
    if (index === -1) return null;
    current[index] = { ...current[index], ...patch };
    B2BService.savePartners(current);
    return current[index];
  },

  deletePartner: async (id: string): Promise<boolean> => {
    const current = await B2BService.getPartners();
    const updated = current.filter(p => p.id !== id);
    B2BService.savePartners(updated);
    return true;
  },

  exportCsv: (partners: B2BPartner[]) => {
    const headers = [
      "ID",
      "Partner Name",
      "Type",
      "Country",
      "City",
      "Contact Person",
      "Contact Email",
      "Contact Phone",
      "Status",
      "Commission Terms",
      "Agreement Status",
      "Agreement Expiry",
      "Staff Owner",
      "Next Follow-up",
      "Referred Students",
      "Payout Claimed",
    ];

    const rows = partners.map(p => [
      `"${p.code}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.type}"`,
      `"${p.country}"`,
      `"${p.city || ""}"`,
      `"${p.contactPerson.replace(/"/g, '""')}"`,
      `"${p.contactEmail}"`,
      `"${p.contactPhone}"`,
      `"${p.status}"`,
      `"${p.commissionTerms.replace(/"/g, '""')}"`,
      `"${p.agreementStatus}"`,
      `"${p.agreementExpiry}"`,
      `"${p.assignedStaff}"`,
      `"${p.nextFollowUp}"`,
      p.referredStudentsCount,
      `"${p.totalPayoutClaimed}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AECS_B2B_Partners_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
