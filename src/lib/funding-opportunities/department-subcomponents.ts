/**
 * Operating units / sub-agencies per cabinet-level department (filter sub-checkboxes).
 * Patterns are matched with ilike on `agency` / `agency_code` (same as HHS).
 */

export type SubcomponentDef = { id: string; label: string; patterns: string[] };

/** NIH / HHS health agencies — same set as previous HHS_COMPONENTS. */
const HHS_SUBS: readonly SubcomponentDef[] = [
  {
    id: "nih",
    label: "National Institutes of Health",
    patterns: [
      "National Institutes of Health",
      "National Institutes for Health",
      "National Institute of Health",
      "NIH",
    ],
  },
  {
    id: "cdc",
    label: "Centers for Disease Control and Prevention",
    patterns: ["Centers for Disease Control", "CDC"],
  },
  {
    id: "fda",
    label: "Food and Drug Administration",
    patterns: ["Food and Drug Administration", "FDA"],
  },
  {
    id: "cms",
    label: "Centers for Medicare & Medicaid Services",
    patterns: ["Centers for Medicare & Medicaid Services", "Centers for Medicare and Medicaid"],
  },
  {
    id: "hrsa",
    label: "Health Resources and Services Administration",
    patterns: ["Health Resources and Services Administration", "HRSA"],
  },
  {
    id: "samhsa",
    label: "Substance Abuse and Mental Health Services Administration",
    patterns: ["Substance Abuse and Mental Health", "SAMHSA"],
  },
  {
    id: "ahrq",
    label: "Agency for Healthcare Research and Quality",
    patterns: ["Agency for Healthcare Research and Quality", "AHRQ"],
  },
  {
    id: "ihs",
    label: "Indian Health Service",
    patterns: ["Indian Health Service", "IHS"],
  },
  {
    id: "acl",
    label: "Administration for Community Living",
    patterns: ["Administration for Community Living", "ACL"],
  },
  {
    id: "aspe",
    label: "Office of the Assistant Secretary for Planning and Evaluation",
    patterns: ["Assistant Secretary for Planning and Evaluation", "ASPE"],
  },
];

export const SUBCOMPONENTS_BY_DEPT: Record<string, readonly SubcomponentDef[]> = {
  hhs: HHS_SUBS,
  dol: [
    {
      id: "osha",
      label: "Occupational Safety and Health Administration (OSHA)",
      patterns: ["Occupational Safety and Health Administration", "OSHA"],
    },
    {
      id: "eta",
      label: "Employment and Training Administration",
      patterns: ["Employment and Training Administration", "ETA"],
    },
    {
      id: "whd",
      label: "Wage and Hour Division",
      patterns: ["Wage and Hour Division", "Wage and Hour"],
    },
    {
      id: "bls",
      label: "Bureau of Labor Statistics",
      patterns: ["Bureau of Labor Statistics", "BLS"],
    },
    {
      id: "odep",
      label: "Office of Disability Employment Policy",
      patterns: ["Office of Disability Employment Policy", "ODEP"],
    },
    {
      id: "ilab",
      label: "Bureau of International Labor Affairs",
      patterns: ["Bureau of International Labor Affairs", "ILAB"],
    },
  ],
  dos: [
    {
      id: "eca",
      label: "Bureau of Educational and Cultural Affairs",
      patterns: ["Educational and Cultural Affairs", "ECA"],
    },
    {
      id: "prm",
      label: "Population, Refugees, and Migration",
      patterns: ["Population, Refugees", "Bureau of Population"],
    },
    {
      id: "inl",
      label: "Bureau of International Narcotics and Law Enforcement",
      patterns: ["International Narcotics and Law Enforcement", "INL"],
    },
    {
      id: "oceans",
      label: "Bureau of Oceans and International Environmental and Scientific Affairs",
      patterns: ["Oceans and International Environmental", "OES"],
    },
  ],
  usda: [
    {
      id: "nifa",
      label: "National Institute of Food and Agriculture",
      patterns: ["National Institute of Food and Agriculture", "NIFA"],
    },
    {
      id: "fs",
      label: "Forest Service",
      patterns: ["Forest Service", "U.S. Forest Service"],
    },
    {
      id: "ars",
      label: "Agricultural Research Service",
      patterns: ["Agricultural Research Service", "ARS"],
    },
    {
      id: "nrcs",
      label: "Natural Resources Conservation Service",
      patterns: ["Natural Resources Conservation Service", "NRCS"],
    },
    {
      id: "fns",
      label: "Food and Nutrition Service",
      patterns: ["Food and Nutrition Service", "FNS"],
    },
    {
      id: "aphis",
      label: "Animal and Plant Health Inspection Service",
      patterns: ["Animal and Plant Health Inspection", "APHIS"],
    },
  ],
  va: [
    {
      id: "vha",
      label: "Veterans Health Administration",
      patterns: ["Veterans Health Administration", "VHA"],
    },
    {
      id: "vba",
      label: "Veterans Benefits Administration",
      patterns: ["Veterans Benefits Administration", "VBA"],
    },
    {
      id: "nca",
      label: "National Cemetery Administration",
      patterns: ["National Cemetery Administration", "NCA"],
    },
    {
      id: "oar",
      label: "Office of Research and Development",
      patterns: ["Office of Research and Development", "VA Office of Research"],
    },
  ],
  ed: [
    {
      id: "oese",
      label: "Office of Elementary and Secondary Education",
      patterns: ["Elementary and Secondary Education", "OESE"],
    },
    {
      id: "ope",
      label: "Office of Postsecondary Education",
      patterns: ["Office of Postsecondary Education", "OPE"],
    },
    {
      id: "osers",
      label: "Office of Special Education and Rehabilitative Services",
      patterns: ["Special Education and Rehabilitative", "OSERS"],
    },
    {
      id: "ies",
      label: "Institute of Education Sciences",
      patterns: ["Institute of Education Sciences", "IES"],
    },
  ],
  dod: [
    {
      id: "darpa",
      label: "Defense Advanced Research Projects Agency",
      patterns: ["Defense Advanced Research Projects", "DARPA"],
    },
    {
      id: "dha",
      label: "Defense Health Agency",
      patterns: ["Defense Health Agency"],
    },
    {
      id: "dhaca",
      label: "Defense Health Agency Contracting Activity",
      patterns: [
        "Defense Health Agency Contracting",
        "DHACA",
        "Congressionally Directed Medical Research",
        "CDMRP",
      ],
    },
    {
      id: "onr",
      label: "Office of Naval Research",
      patterns: ["Office of Naval Research", "ONR"],
    },
    {
      id: "afosr",
      label: "Air Force Office of Scientific Research",
      patterns: ["Air Force Office of Scientific Research", "AFOSR", "Air Force Research Laboratory", "AFRL"],
    },
    {
      id: "aro",
      label: "Army Research Office",
      patterns: ["Army Research Office", "ARO"],
    },
    {
      id: "mda",
      label: "Missile Defense Agency",
      patterns: ["Missile Defense Agency", "MDA"],
    },
    {
      id: "dtra",
      label: "Defense Threat Reduction Agency",
      patterns: ["Defense Threat Reduction Agency", "DTRA"],
    },
    {
      id: "dla",
      label: "Defense Logistics Agency",
      patterns: ["Defense Logistics Agency", "DLA"],
    },
    {
      id: "disa",
      label: "Defense Information Systems Agency",
      patterns: ["Defense Information Systems Agency", "DISA"],
    },
  ],
  treasury: [
    {
      id: "irs",
      label: "Internal Revenue Service",
      patterns: ["Internal Revenue Service", "IRS"],
    },
    {
      id: "fincen",
      label: "Financial Crimes Enforcement Network",
      patterns: ["Financial Crimes Enforcement Network", "FinCEN"],
    },
    {
      id: "occ",
      label: "Office of the Comptroller of the Currency",
      patterns: ["Office of the Comptroller of the Currency", "OCC"],
    },
  ],
  interior: [
    {
      id: "nps",
      label: "National Park Service",
      patterns: ["National Park Service", "NPS"],
    },
    {
      id: "fws",
      label: "U.S. Fish and Wildlife Service",
      patterns: ["Fish and Wildlife Service", "U.S. Fish and Wildlife"],
    },
    {
      id: "blm",
      label: "Bureau of Land Management",
      patterns: ["Bureau of Land Management", "BLM"],
    },
    {
      id: "bia",
      label: "Bureau of Indian Affairs",
      patterns: ["Bureau of Indian Affairs", "BIA"],
    },
    {
      id: "usgs",
      label: "U.S. Geological Survey",
      patterns: ["U.S. Geological Survey", "USGS"],
    },
  ],
  justice: [
    {
      id: "ojp",
      label: "Office of Justice Programs",
      patterns: ["Office of Justice Programs", "OJP"],
    },
    {
      id: "nij",
      label: "National Institute of Justice",
      patterns: ["National Institute of Justice", "NIJ"],
    },
    {
      id: "bja",
      label: "Bureau of Justice Assistance",
      patterns: ["Bureau of Justice Assistance", "BJA"],
    },
    {
      id: "cops",
      label: "Office of Community Oriented Policing Services",
      patterns: ["Community Oriented Policing Services", "COPS"],
    },
  ],
  commerce: [
    {
      id: "nist",
      label: "National Institute of Standards and Technology",
      patterns: ["National Institute of Standards and Technology", "NIST"],
    },
    {
      id: "noaa",
      label: "National Oceanic and Atmospheric Administration",
      patterns: ["National Oceanic and Atmospheric Administration", "NOAA"],
    },
    {
      id: "uspto",
      label: "United States Patent and Trademark Office",
      patterns: ["Patent and Trademark Office", "USPTO"],
    },
    {
      id: "ntia",
      label: "National Telecommunications and Information Administration",
      patterns: ["National Telecommunications and Information Administration", "NTIA"],
    },
  ],
  hud: [
    {
      id: "pih",
      label: "Office of Public and Indian Housing",
      patterns: ["Public and Indian Housing", "PIH"],
    },
    {
      id: "cpd",
      label: "Office of Community Planning and Development",
      patterns: ["Community Planning and Development", "CPD"],
    },
    {
      id: "fha",
      label: "Federal Housing Administration",
      patterns: ["Federal Housing Administration", "FHA"],
    },
  ],
  dot: [
    {
      id: "faa",
      label: "Federal Aviation Administration",
      patterns: ["Federal Aviation Administration", "FAA"],
    },
    {
      id: "fhwa",
      label: "Federal Highway Administration",
      patterns: ["Federal Highway Administration", "FHWA"],
    },
    {
      id: "fta",
      label: "Federal Transit Administration",
      patterns: ["Federal Transit Administration", "FTA"],
    },
    {
      id: "nhtsa",
      label: "National Highway Traffic Safety Administration",
      patterns: ["National Highway Traffic Safety Administration", "NHTSA"],
    },
  ],
  dhs: [
    {
      id: "fema",
      label: "Federal Emergency Management Agency",
      patterns: ["Federal Emergency Management Agency", "FEMA"],
    },
    {
      id: "cbp",
      label: "U.S. Customs and Border Protection",
      patterns: ["Customs and Border Protection", "CBP"],
    },
    {
      id: "tsa",
      label: "Transportation Security Administration",
      patterns: ["Transportation Security Administration", "TSA"],
    },
    {
      id: "uscg",
      label: "United States Coast Guard",
      patterns: ["United States Coast Guard", "U.S. Coast Guard"],
    },
    {
      id: "science",
      label: "Science and Technology Directorate",
      patterns: ["Science and Technology Directorate", "DHS S&T"],
    },
  ],
  energy: [
    {
      id: "arpa_e",
      label: "Advanced Research Projects Agency-Energy",
      patterns: ["Advanced Research Projects Agency-Energy", "ARPA-E", "ARPA-Energy"],
    },
    {
      id: "eere",
      label: "Office of Energy Efficiency and Renewable Energy",
      patterns: ["Energy Efficiency and Renewable Energy", "EERE"],
    },
    {
      id: "science_office",
      label: "Office of Science",
      patterns: ["Office of Science", "DOE Office of Science"],
    },
    {
      id: "nnsa",
      label: "National Nuclear Security Administration",
      patterns: ["National Nuclear Security Administration", "NNSA"],
    },
  ],
  epa: [
    {
      id: "ord",
      label: "Office of Research and Development",
      patterns: ["Office of Research and Development", "EPA Office of Research"],
    },
    {
      id: "water",
      label: "Office of Water",
      patterns: ["Office of Water", "EPA Office of Water"],
    },
    {
      id: "air",
      label: "Office of Air and Radiation",
      patterns: ["Office of Air and Radiation", "Air and Radiation"],
    },
  ],
  nsf: [
    {
      id: "directorates",
      label: "NSF Directorates (general)",
      patterns: ["National Science Foundation", "NSF Directorate", "NSF Division"],
    },
    {
      id: "bio",
      label: "Directorate for Biological Sciences",
      patterns: ["Directorate for Biological Sciences", "NSF BIO"],
    },
    {
      id: "eng",
      label: "Directorate for Engineering",
      patterns: ["Directorate for Engineering", "NSF ENG"],
    },
    {
      id: "cise",
      label: "Directorate for Computer and Information Science",
      patterns: ["Computer and Information Science and Engineering", "NSF CISE"],
    },
  ],
  nasa: [
    {
      id: "smd",
      label: "Science Mission Directorate",
      patterns: ["Science Mission Directorate", "NASA Science"],
    },
    {
      id: "heo",
      label: "Human Exploration and Operations",
      patterns: ["Human Exploration and Operations", "HEOMD"],
    },
    {
      id: "stmd",
      label: "Space Technology Mission Directorate",
      patterns: ["Space Technology Mission Directorate", "STMD"],
    },
    {
      id: "aeronautics",
      label: "Aeronautics Research Mission Directorate",
      patterns: ["Aeronautics Research Mission", "ARMD"],
    },
  ],
  ssa: [
    {
      id: "oasis",
      label: "Office of Analytics, Review, and Oversight",
      patterns: ["Social Security Administration", "SSA Office"],
    },
    {
      id: "disability",
      label: "Office of Disability Adjudication and Review",
      patterns: ["Disability Adjudication", "ODAR"],
    },
  ],
  sba: [
    {
      id: "programs",
      label: "SBA program offices (general)",
      patterns: ["Small Business Administration", "SBA Office"],
    },
    {
      id: "sttr",
      label: "Federal and State Technology Partnership",
      patterns: ["Small Business Innovation Research", "SBIR", "STTR", "Small Business Administration"],
    },
  ],
};

export function getSubcomponentsForDepartment(deptId: string): readonly SubcomponentDef[] {
  return SUBCOMPONENTS_BY_DEPT[deptId] ?? [];
}

/** Map retired DoD sub-ids from older saved searches / URLs to current ids. */
const LEGACY_DOD_SUB_IDS: Record<string, string> = {
  army: "aro",
  navy: "onr",
  air_force: "afosr",
  cdmrp: "dhaca",
};

export function normalizeDepartmentSubId(deptId: string, subId: string): string {
  if (deptId === "dod" && LEGACY_DOD_SUB_IDS[subId]) {
    return LEGACY_DOD_SUB_IDS[subId];
  }
  return subId;
}

export function isKnownDepartmentSubId(deptId: string, subId: string): boolean {
  const normalized = normalizeDepartmentSubId(deptId, subId);
  return getSubcomponentsForDepartment(deptId).some((c) => c.id === normalized);
}

/** @deprecated use isKnownDepartmentSubId("hhs", id) */
export function isKnownHhsComponentId(id: string): boolean {
  return isKnownDepartmentSubId("hhs", id);
}

const HHS_PARENT_PATTERNS = [
  "Department of Health and Human Services",
  "Health and Human Services",
  "U.S. Department of Health and Human",
  "HHS",
];

/** Union of HHS parent + all HHS sub patterns (whole-HHS match). */
export function getAllHhsPatterns(): string[] {
  const fromSubs = HHS_SUBS.flatMap((s) => s.patterns);
  return Array.from(new Set([...HHS_PARENT_PATTERNS, ...fromSubs]));
}

/** Union of patterns when a department is checked with no subcomponents selected. */
export function getAllSubPatternsForDepartment(deptId: string, parentPatterns: string[]): string[] {
  const subs = getSubcomponentsForDepartment(deptId);
  if (subs.length === 0) return parentPatterns;
  const fromSubs = subs.flatMap((s) => s.patterns);
  if (deptId === "hhs") return getAllHhsPatterns();
  return Array.from(new Set([...parentPatterns, ...fromSubs]));
}

export const HHS_COMPONENTS = HHS_SUBS;
