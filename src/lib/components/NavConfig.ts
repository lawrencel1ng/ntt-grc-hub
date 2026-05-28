import {
  LayoutDashboard, FileBarChart, Radio, Building2,
  AlertTriangle, Grid3x3, ListChecks, ShieldAlert,
  Library, ShieldCheck, FileLock2, ClipboardCheck, Antenna, ScrollText,
  Building, FileQuestion, GitFork,
  UserLock, Leaf, BrainCircuit, Calculator, LifeBuoy,
  Bot, History, Workflow, Plug,
  Users, KeyRound, FileSearch, Settings,
  type Icon
} from 'lucide-svelte';

export interface NavItem { label: string; href: string; icon: typeof Icon; badge?: string; }
export interface NavSection { title: string; items: NavItem[]; }

export const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Risk Cockpit', href: '/', icon: LayoutDashboard },
      { label: 'Board Pack', href: '/board', icon: FileBarChart },
      { label: 'Agent Stream', href: '/stream', icon: Radio, badge: 'LIVE' },
      { label: 'Tenant Compare', href: '/tenants-compare', icon: Building2, badge: 'MSSP' }
    ]
  },
  {
    title: 'Enterprise Risk',
    items: [
      { label: 'ERM Register', href: '/risk', icon: AlertTriangle },
      { label: 'Heatmap & FAIR', href: '/heatmap', icon: Grid3x3 },
      { label: 'Issues & Incidents', href: '/issues', icon: ListChecks },
      { label: 'Op Resilience', href: '/resilience', icon: ShieldAlert, badge: 'DORA' }
    ]
  },
  {
    title: 'Compliance',
    items: [
      { label: 'Frameworks', href: '/frameworks', icon: Library, badge: '35+' },
      { label: 'Controls', href: '/controls', icon: ShieldCheck },
      { label: 'Evidence Vault', href: '/evidence', icon: FileLock2 },
      { label: 'Audit Mgmt', href: '/audits', icon: ClipboardCheck },
      { label: 'Reg Horizon', href: '/regwatch', icon: Antenna, badge: 'AI' },
      { label: 'Policy Mgmt', href: '/policies', icon: ScrollText }
    ]
  },
  {
    title: 'Third-Party',
    items: [
      { label: 'Vendors / TPRM', href: '/vendors', icon: Building },
      { label: 'Questionnaires', href: '/questionnaires', icon: FileQuestion },
      { label: '4th-Party Map', href: '/fourth-party', icon: GitFork }
    ]
  },
  {
    title: 'Specialized',
    items: [
      { label: 'Privacy', href: '/privacy', icon: UserLock },
      { label: 'ESG', href: '/esg', icon: Leaf },
      { label: 'AI Governance', href: '/ai-gov', icon: BrainCircuit, badge: 'ISO 42001' },
      { label: 'SOX', href: '/sox', icon: Calculator },
      { label: 'BCM / DR', href: '/bcm', icon: LifeBuoy }
    ]
  },
  {
    title: 'Agentic OS',
    items: [
      { label: 'Agent Fleet', href: '/agents', icon: Bot, badge: '10' },
      { label: 'Decisions', href: '/decisions', icon: History },
      { label: 'Workflows', href: '/workflows', icon: Workflow },
      { label: 'Connectors', href: '/connectors', icon: Plug, badge: '40+' }
    ]
  },
  {
    title: 'Admin',
    items: [
      { label: 'Tenants', href: '/admin/tenants', icon: Building2 },
      { label: 'Users & RBAC', href: '/admin/users', icon: Users },
      { label: 'Audit Log', href: '/admin/audit', icon: FileSearch },
      { label: 'Settings', href: '/admin/settings', icon: Settings }
    ]
  }
];
