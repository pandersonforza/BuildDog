export const PROJECT_TYPES = [
  "Residential",
  "Commercial",
  "Mixed-Use",
  "Industrial",
] as const;

export const PROJECT_GROUPS = ["Forza", "Harman", "F7B"] as const;

export const PROJECT_STATUSES = [
  "Active",
  "On Hold",
  "Completed",
  "Dead",
] as const;

export const PROJECT_STAGES = [
  "Pre-Development",
  "Design",
  "Permitting",
  "Construction",
  "Closeout",
] as const;

export const CATEGORY_GROUPS = [
  "Land",
  "Soft Costs",
  "Hard Costs",
  "Outside Costs",
  "Financing Costs",
] as const;

export const CATEGORY_GROUP_ORDER: Record<string, number> = {
  "Land": 0,
  "Soft Costs": 1,
  "Soft Cost": 1,
  "Hard Costs": 2,
  "Hard Cost": 2,
  "Outside Costs": 3,
  "Financing Costs": 4,
  "Financing": 4,
};

export const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  "Soft Costs": ["Design Fees", "Entitlements", "Permits & Fees", "Equipment", "Signage"],
  "Hard Costs": ["Construction", "Site", "Building Costs"],
  "Outside Costs": ["Outside Costs"],
  "Financing Costs": ["Loan Fees", "Interest", "Closing Costs"],
  "Land": ["Acquisition", "Due Diligence"],
};

// Subcategory sort order within each group
export const SUBCATEGORY_ORDER: Record<string, string[]> = {
  "Soft Costs": ["Design Fees", "Entitlements", "Permits & Fees", "Equipment", "Signage"],
  "Soft Cost": ["Design Fees", "Entitlements", "Permits & Fees", "Equipment", "Signage"],
  "Hard Costs": ["Construction", "General Conditions", "Site", "Site Costs", "Building Costs"],
  "Hard Cost": ["Construction", "General Conditions", "Site", "Site Costs", "Building Costs"],
  "Outside Costs": ["Outside Costs"],
  "Financing Costs": ["Loan Fees", "Interest", "Closing Costs"],
  "Financing": ["Loan Fees", "Interest", "Closing Costs"],
  "Land": ["Acquisition", "Due Diligence"],
};

// Master line item sort order per subcategory — items not listed sort to the end
export const LINE_ITEM_ORDER: Record<string, string[]> = {
  // Soft Costs > Design Fees
  "Design Fees": [
    "Architectural", "Civil", "Application & Permitting Fees", "Third Party DD",
    "Survey ALTA/TOPO", "Geotechnical", "Environmental/ Asbestos/Lead testing",
    "Traffic Study", "Electircal Services Design Fees", "As-Builts",
    "Site Inspection Report", "Title Report",
  ],
  // Soft Costs > Entitlements
  "Entitlements": [
    "Pre-Application", "Planning Fess/Use approvals",
  ],
  // Soft Costs > Permits & Fees
  "Permits & Fees": [
    "Building Permit", "Civil Permit", "Health Permit", "Sign Permit",
    "Encroachment Permit", "Water Meter Fees", "Water Connection Fees",
    "Sewer Connection Fees", "Sewer Discharge Fees", "City Impact Fees",
    "City Traffic Impact Fees", "Electric Company Fees", "ISP/Telco Fee",
    "City/DOT Bonds",
  ],
  // Soft Costs > Equipment
  "Equipment": [
    "Full Equipment Cost", "Indoor Furnishings", "Outdoor Furniture",
    "Ecolab", "HVAC Units", "Electircal Equipment", "Beverage Install",
    "NUCO2", "Construction Cameras", "Low Voltage (ISP  & Camera)",
  ],
  // Soft Costs > Signage
  "Signage": [
    "Building Sign", "Pylon/Monument Sign", "Site Signage", "Awnings",
  ],
  // Hard Costs > Construction
  "Construction": [
    "General Conditions", "Supervision", "Contractor Overhead", "Site Cameras",
    "Insurance", "Traffic Control Measures", "Fencing", "Temp Utilities",
    "Dumpsters", "Contractor Fee", "Construction Tax",
  ],
  // Hard Costs > Site
  "Site": [
    "Site Demolition", "Import/Export", "Grading rough/finish", "Over Excavation",
    "Concrete Curbing", "Concrete Gutters", "Concrete Flatwork Site",
    "Concrete Flatwork Building", "Paving Asphalt", "Paving Base Rock",
    "Paving Concrete", "Paint Striping", "Seal Coat", "Storm", "Water",
    "Sewer", "Grease Interceptor", "Power", "Gas", "ISP/ Telco",
    "Site CMU Walls", "Site Wood Fences", "Site Metal Fences",
    "Trash Enclosure CMU", "Trash Enclosure Gates/Hardware/Bollards",
    "Site Bollards", "Site Lighting", "Site Furnishings",
    "Site Signage Footings", "Landscape", "Construction Survey",
  ],
  // Hard Costs > Building Costs
  "Building Costs": [
    "Building Demolition", "Building Foundation", "Building Metal Siding",
    "Rough Carpentry", "Building Stucco", "Building Brick", "Building CMU",
    "Building Stone", "Paint Interior", "Paint Exterior", "Roof/Wall Insulation",
    "TPO Roofing", "Building Down Spouts", "Drywall", "FRP",
    "Mechanical Ducting/Grills/Diffusers", "HVAC Units", "Air Curtains",
    "Electrical", "Plumbing", "Flooring Epoxy", "Flooring Tile", "Ceiling",
    "Shelving - Install", "Doors", "Windows", "Bathroom Acc",
    "Ice Machine - Install", "Refrigerators", "SS Tables and Sinks - Install",
    "Signage", "Shelving Install",
  ],
  // Outside Costs
  "Outside Costs": [
    "Legal Fees", "Owners Insurance (GL & Builder Risk)", "Development Fee",
    "Travel", "Acq Fee", "Leasing Commissions", "Tenant Improvements",
    "Contingency", "Property Tax",
  ],
  // Aliases for old subcategory names
  "Site Costs": [
    "Site Demolition", "Import/Export", "Grading rough/finish", "Over Excavation",
    "Concrete Curbing", "Concrete Gutters", "Concrete Flatwork Site",
    "Concrete Flatwork Building", "Paving Asphalt", "Paving Base Rock",
    "Paving Concrete", "Paint Striping", "Seal Coat", "Storm", "Water",
    "Sewer", "Grease Interceptor", "Power", "Gas", "ISP/ Telco",
    "Site CMU Walls", "Site Wood Fences", "Site Metal Fences",
    "Trash Enclosure CMU", "Trash Enclosure Gates/Hardware/Bollards",
    "Site Bollards", "Site Lighting", "Site Furnishings",
    "Site Signage Footings", "Landscape", "Construction Survey",
  ],
  "General Conditions": [
    "General Conditions", "Supervision", "Contractor Overhead", "Site Cameras",
    "Insurance", "Traffic Control Measures", "Fencing", "Temp Utilities",
    "Dumpsters", "Contractor Fee", "Construction Tax",
  ],
};

export const DRAW_STATUSES = [
  "Draft",
  "Submitted",
  "Approved",
  "Funded",
] as const;

export const DOCUMENT_CATEGORIES = [
  "Contracts",
  "Permits",
  "Insurance",
  "Plans",
  "Reports",
] as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  // Project statuses
  Active: { bg: "bg-emerald-900/40", text: "text-emerald-400" },
  "On Hold": { bg: "bg-amber-900/40", text: "text-amber-400" },
  Completed: { bg: "bg-blue-900/40", text: "text-blue-400" },
  Dead: { bg: "bg-red-900/40", text: "text-red-400" },

  // Milestone statuses
  Pending: { bg: "bg-gray-800/50", text: "text-gray-400" },

  // Contract statuses
  Draft: { bg: "bg-gray-800/50", text: "text-gray-400" },
  Executed: { bg: "bg-blue-900/40", text: "text-blue-400" },
  "In Progress": { bg: "bg-emerald-900/40", text: "text-emerald-400" },
  Complete: { bg: "bg-blue-900/40", text: "text-blue-400" },
  Terminated: { bg: "bg-red-900/40", text: "text-red-400" },

  // Draw statuses
  Submitted: { bg: "bg-amber-900/40", text: "text-amber-400" },
  Approved: { bg: "bg-emerald-900/40", text: "text-emerald-400" },
  Funded: { bg: "bg-blue-900/40", text: "text-blue-400" },

  // Vendor statuses
  Inactive: { bg: "bg-gray-800/50", text: "text-gray-400" },
  Preferred: { bg: "bg-purple-900/40", text: "text-purple-400" },

  // Bid statuses
  "Under Review": { bg: "bg-amber-900/40", text: "text-amber-400" },
  Accepted: { bg: "bg-emerald-900/40", text: "text-emerald-400" },

  // Invoice statuses
  "Pending Review": { bg: "bg-amber-900/40", text: "text-amber-400" },
  Rejected: { bg: "bg-red-900/40", text: "text-red-400" },
  Paid: { bg: "bg-indigo-900/40", text: "text-indigo-400" },
};

export const INVOICE_STATUSES = [
  "Pending Review",
  "Submitted",
  "Approved",
  "Rejected",
  "Paid",
] as const;

export const USER_ROLES = ["admin", "user", "viewer"] as const;

export const TASK_STATUSES = ["pending", "completed"] as const;

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  "Pre-Development": { bg: "bg-slate-800/50", text: "text-slate-400" },
  Design: { bg: "bg-violet-900/40", text: "text-violet-400" },
  Permitting: { bg: "bg-amber-900/40", text: "text-amber-400" },
  Construction: { bg: "bg-emerald-900/40", text: "text-emerald-400" },
  Closeout: { bg: "bg-blue-900/40", text: "text-blue-400" },
};
