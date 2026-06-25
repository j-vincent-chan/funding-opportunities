/**
 * Coarse federal department / agency groupings for funding filters.
 * Sub-agency checkboxes and HHS patterns live in `department-subcomponents.ts`.
 */

export type DepartmentDef = { id: string; label: string; patterns: string[] };

export type { SubcomponentDef as HhsComponentDef } from "./department-subcomponents";
export {
  HHS_COMPONENTS,
  getAllHhsPatterns,
  isKnownHhsComponentId,
} from "./department-subcomponents";

/** Cabinet / major agencies shown as top-level checkboxes (not NIH-level detail). */
export const TOP_LEVEL_DEPARTMENTS: readonly DepartmentDef[] = [
  {
    id: "hhs",
    label: "Department of Health and Human Services",
    patterns: [],
  },
  {
    id: "dol",
    label: "Department of Labor",
    patterns: ["Department of Labor", "Dept. of Labor", "U.S. Department of Labor"],
  },
  {
    id: "dos",
    label: "Department of State",
    patterns: ["Department of State", "U.S. Department of State", "Dept. of State"],
  },
  {
    id: "usda",
    label: "Department of Agriculture",
    patterns: [
      "Department of Agriculture",
      "U.S. Department of Agriculture",
      "Dept. of Agriculture",
      "USDA",
    ],
  },
  {
    id: "va",
    label: "Department of Veterans Affairs",
    patterns: [
      "Department of Veterans Affairs",
      "Veterans Affairs",
      "U.S. Department of Veterans Affairs",
      "VA Medical",
    ],
  },
  {
    id: "ed",
    label: "Department of Education",
    patterns: ["Department of Education", "U.S. Department of Education", "Dept. of Education"],
  },
  {
    id: "dod",
    label: "Department of Defense",
    patterns: [
      "Department of Defense",
      "U.S. Department of Defense",
      "Dept. of Defense",
      "DOD",
      "Defense Advanced Research",
      "DARPA",
      "Defense Health Agency",
    ],
  },
  {
    id: "treasury",
    label: "Department of the Treasury",
    patterns: ["Department of the Treasury", "U.S. Department of the Treasury", "Dept. of the Treasury"],
  },
  {
    id: "interior",
    label: "Department of the Interior",
    patterns: ["Department of the Interior", "U.S. Department of the Interior", "Dept. of the Interior"],
  },
  {
    id: "justice",
    label: "Department of Justice",
    patterns: ["Department of Justice", "U.S. Department of Justice", "Dept. of Justice", "DOJ"],
  },
  {
    id: "commerce",
    label: "Department of Commerce",
    patterns: ["Department of Commerce", "U.S. Department of Commerce", "Dept. of Commerce"],
  },
  {
    id: "hud",
    label: "Department of Housing and Urban Development",
    patterns: [
      "Department of Housing and Urban Development",
      "Housing and Urban Development",
      "U.S. Department of Housing",
    ],
  },
  {
    id: "dot",
    label: "Department of Transportation",
    patterns: ["Department of Transportation", "U.S. Department of Transportation", "Dept. of Transportation"],
  },
  {
    id: "dhs",
    label: "Department of Homeland Security",
    patterns: [
      "Department of Homeland Security",
      "U.S. Department of Homeland Security",
      "Homeland Security",
    ],
  },
  {
    id: "energy",
    label: "Department of Energy",
    patterns: ["Department of Energy", "U.S. Department of Energy", "Dept. of Energy", "DOE"],
  },
  {
    id: "epa",
    label: "Environmental Protection Agency",
    patterns: ["Environmental Protection Agency", "U.S. EPA"],
  },
  {
    id: "nsf",
    label: "National Science Foundation",
    patterns: ["National Science Foundation", "NSF"],
  },
  {
    id: "nasa",
    label: "National Aeronautics and Space Administration",
    patterns: ["National Aeronautics and Space Administration", "NASA"],
  },
  {
    id: "ssa",
    label: "Social Security Administration",
    patterns: ["Social Security Administration", "SSA"],
  },
  {
    id: "sba",
    label: "Small Business Administration",
    patterns: ["Small Business Administration", "SBA", "U.S. Small Business Administration"],
  },
];

export function isKnownDepartmentId(id: string): boolean {
  return TOP_LEVEL_DEPARTMENTS.some((d) => d.id === id);
}
