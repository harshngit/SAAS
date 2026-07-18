const weekDates = ['2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']

export const attendance = [
  {
    userId: 'usr-2',
    name: 'Anita Sharma',
    role: 'admin',
    records: [
      { date: weekDates[0], status: 'Present', checkIn: '09:28', checkOut: '18:35' },
      { date: weekDates[1], status: 'Week Off', checkIn: null, checkOut: null },
      { date: weekDates[2], status: 'Present', checkIn: '09:31', checkOut: '18:29' },
      { date: weekDates[3], status: 'Present', checkIn: '09:25', checkOut: '18:40' },
      { date: weekDates[4], status: 'Present', checkIn: '09:33', checkOut: '18:31' },
      { date: weekDates[5], status: 'On Leave', checkIn: null, checkOut: null },
      { date: weekDates[6], status: 'Present', checkIn: '09:29', checkOut: '18:33' },
    ],
  },
  {
    userId: 'usr-3',
    name: 'Vikram Singh',
    role: 'sales_officer',
    records: [
      { date: weekDates[0], status: 'Present', checkIn: '09:45', checkOut: '19:10' },
      { date: weekDates[1], status: 'Week Off', checkIn: null, checkOut: null },
      { date: weekDates[2], status: 'Present', checkIn: '09:50', checkOut: '19:05' },
      { date: weekDates[3], status: 'Present', checkIn: '09:40', checkOut: '19:15' },
      { date: weekDates[4], status: 'Half Day', checkIn: '09:48', checkOut: '14:00' },
      { date: weekDates[5], status: 'Present', checkIn: '09:42', checkOut: '19:00' },
      { date: weekDates[6], status: 'Present', checkIn: '09:38', checkOut: '19:20' },
    ],
  },
  {
    userId: 'usr-4',
    name: 'Suresh Kumar',
    role: 'delivery_partner',
    records: [
      { date: weekDates[0], status: 'Present', checkIn: '08:00', checkOut: '20:15' },
      { date: weekDates[1], status: 'Week Off', checkIn: null, checkOut: null },
      { date: weekDates[2], status: 'Present', checkIn: '08:05', checkOut: '20:00' },
      { date: weekDates[3], status: 'Present', checkIn: '07:55', checkOut: '20:30' },
      { date: weekDates[4], status: 'Present', checkIn: '08:10', checkOut: '19:45' },
      { date: weekDates[5], status: 'Present', checkIn: '08:02', checkOut: '20:05' },
      { date: weekDates[6], status: 'Present', checkIn: '07:58', checkOut: '20:20' },
    ],
  },
  {
    userId: 'usr-5',
    name: 'Priya Nair',
    role: 'accountant',
    records: [
      { date: weekDates[0], status: 'Present', checkIn: '09:32', checkOut: '18:20' },
      { date: weekDates[1], status: 'Week Off', checkIn: null, checkOut: null },
      { date: weekDates[2], status: 'Present', checkIn: '09:29', checkOut: '18:25' },
      { date: weekDates[3], status: 'Absent', checkIn: null, checkOut: null },
      { date: weekDates[4], status: 'Present', checkIn: '09:35', checkOut: '18:22' },
      { date: weekDates[5], status: 'Present', checkIn: '09:30', checkOut: '18:28' },
      { date: weekDates[6], status: 'Present', checkIn: '09:27', checkOut: '18:30' },
    ],
  },
]
