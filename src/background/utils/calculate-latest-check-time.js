export function calculateLatestCheckTime(filters) {
  if (!filters || filters.length === 0) {
    return 0;
  }

  const checkTimes = filters.map((filter) => {
    const lastCheckTime = filter.lastCheckTime || 0;
    const lastScheduledCheckTime = filter.lastScheduledCheckTime || 0;
    return Math.max(lastCheckTime, lastScheduledCheckTime);
  });

  return Math.max(...checkTimes);
}
