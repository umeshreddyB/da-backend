export function getTotalPlanDays(weeks) {
  if (!weeks?.length) return 0;
  return weeks.reduce((n, w) => n + (w.days?.length || 0), 0);
}
