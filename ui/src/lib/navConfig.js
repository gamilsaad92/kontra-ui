export const slug = str => str.toLowerCase().replace(/\s+/g, '-');
export const toPath = label => (label === 'Dashboard' ? '/' : `/${slug(label)}`);

export const departmentNav = {
  finance: [
    { label: 'Dashboard', icon: '🏠' },
    { label: 'Loans', icon: '💰' },
    { label: 'Application', icon: '📝', sub: ['New Application', 'Application List'] },
    { label: 'Underwriting', icon: '✅', sub: ['Underwriting Board', 'Decisions'] },
    { label: 'Escrow Setup', icon: '💼', sub: ['Escrows'] },
    { label: 'Servicing', icon: '🛠️', sub: ['Payment Portal', 'Self Service Payment', 'Prepayment Calculator'] },
    { label: 'Risk Monitoring', icon: '📈', sub: ['Troubled Assets', 'Revived Sales'] },
    { label: 'Investor Reporting', icon: '📊', sub: ['Reports', 'Investor Reports'] },
    { label: 'Market Analysis', icon: '🏙️' },
    { label: 'Live Analytics', icon: '📈' },
    { label: 'Trades', icon: '🔄', flag: 'trading' },
    { label: 'Loan Exchange', icon: '🔁', to: '/exchange' },
    { label: 'Collections', icon: '💵', sub: ['Collections'] },
    { label: 'Settings', icon: '⚙️' },
    { label: 'Docs', icon: '📄', href: 'https://github.com/kontra-ui/docs' }
  ],
  hospitality: [
    { label: 'Dashboard', icon: '🏨' },
    { label: 'Guest CRM', icon: '👥' },
    { label: 'Guest Chat', icon: '💬' },
    { label: 'Guest Reservations', icon: '🛏️', flag: 'hospitality' },
    { label: 'Booking Calendar', icon: '📅', flag: 'hospitality' },
    { label: 'Restaurant Menu', icon: '🍽️' },
    { label: 'Restaurant Dashboard', icon: '📊' },
    { label: 'Settings', icon: '⚙️' },
    { label: 'Docs', icon: '📄', href: 'https://github.com/kontra-ui/docs' }
  ]
};

// Flattened list of unique sidebar links used across the app
export const navLinks = Array.from(
  new Map(
    Object.values(departmentNav)
      .flat()
      .flatMap(item => {
        if (item.href) return [];
        const labels = item.sub || [item.label];
           return labels.map(label => [
          label,
          { label, to: item.to || toPath(label) }
        ]);
      })
  ).values()
);
