export type MechanismType = "small_grant" | "large_grant" | "center_like" | "training" | "unknown";

export type CollaborationComplexity = "single_pi" | "multi_pi" | "center_like" | "unknown";

export type HumanSubjectsRelevance = "true" | "false" | "unknown";

const CENTER_LIKE =
  /\b(sbcor|p30|p50|u54|u19|um1|center|core|infrastructure|consortium|team science|multi-?project|mpg|program project|spoke|hub)\b/i;

const SMALL_GRANT = /\b(r03|r21|r34|pilot|exploratory|small grant|area of research|aor)\b/i;

const LARGE_GRANT = /\b(r01|u01|dp1|dp2|dp5|sc1|rm1|u19|p01|program project|multi-?pi|mpi)\b/i;

const TRAINING = /\b(t32|t35|f30|f31|f32|k12|k99|r25|d43|training grant|career development)\b/i;

const MULTI_PI = /\b(multi-?pi|multiple principal|mpi|team-based|consortium|collaborative (award|grant))\b/i;

const HUMAN_SUBJECTS =
  /\b(irb|human subjects|clinical trial|patient-?reported|clinical study|informed consent|hipaa|phi\b|cohort of patients)\b/i;

export function inferMechanismType(title: string, description: string): MechanismType {
  const blob = `${title}\n${description}`;
  if (TRAINING.test(blob)) return "training";
  if (CENTER_LIKE.test(blob)) return "center_like";
  if (LARGE_GRANT.test(blob) && !SMALL_GRANT.test(blob)) return "large_grant";
  if (SMALL_GRANT.test(blob) && !LARGE_GRANT.test(blob)) return "small_grant";
  if (LARGE_GRANT.test(blob) && SMALL_GRANT.test(blob)) return "large_grant";
  return "unknown";
}

export function inferCollaborationComplexity(title: string, description: string): CollaborationComplexity {
  const blob = `${title}\n${description}`;
  if (CENTER_LIKE.test(blob)) return "center_like";
  if (MULTI_PI.test(blob)) return "multi_pi";
  if (/\bsingle\s+pi\b|\bone\s+principal\b/i.test(blob)) return "single_pi";
  return "unknown";
}

export function inferHumanSubjectsRelevance(title: string, description: string): HumanSubjectsRelevance {
  const blob = `${title}\n${description}`;
  if (HUMAN_SUBJECTS.test(blob)) return "true";
  return "unknown";
}
