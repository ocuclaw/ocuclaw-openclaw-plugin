export const RETIRED_LOOK_PROBLEMS                      = new Set(["content_margin"]);

export const isRetiredLookProblem = (problem     ) => RETIRED_LOOK_PROBLEMS.has(problem?.code);

export function withoutRetiredLookProblems   (problems   )    {
  return (Array.isArray(problems) ? problems.filter((problem     ) => !isRetiredLookProblem(problem)) : problems)     ;
}
