export const notificationsSeed = [
  {
    id: "N1",
    title: "New job assigned",
    details: "Connaught Place → Gurgaon",
    time: "2 min ago",
    unread: true,
  },
  {
    id: "N2",
    title: "Payment received",
    details: "Payment credited to your wallet",
    time: "1 hr ago",
    unread: true,
  },
  {
    id: "N3",
    title: "Reminder",
    details: "Upload proof for completed job #DP1258",
    time: "Yesterday",
    unread: false,
  },
];

export const getUnreadNotificationCount = () =>
  notificationsSeed.filter((item) => item.unread).length;
