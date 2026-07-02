export const isCampaignRunning = (
  startDate: Date,
  duration: number,
): boolean => {
  const now = new Date();

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + duration);

  return now >= startDate && now <= endDate;
};
