export interface NavItem {
  label: string
  to: string
  icon: string
  phase?: string
  badge?: number
}

export interface NavSection {
  title: string
  items: NavItem[]
}
