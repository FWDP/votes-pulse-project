export const authTenants = [
  {
    id: 'tenant-ramon-de-la-cruz-office',
    slug: 'ramon-de-la-cruz-office',
    name: 'Ramon de la Cruz Office',
    status: 'active',
  },
]

export const authWorkspaces = [
  {
    id: 'workspace-constituent-sentiment',
    tenantId: 'tenant-ramon-de-la-cruz-office',
    slug: 'constituent-sentiment',
    name: 'Constituent Sentiment',
    product: 'votes',
  },
]

export const authUsers = [
  { id: 'user-superadmin-local', email: 'superadmin@example.test', displayName: 'Super Admin', jobTitle: 'Super Administrator', status: 'active' },
  { id: 'user-navotas-local', email: 'navotas@example.test', displayName: 'Navotas User', jobTitle: 'City Analyst', status: 'active' },
  { id: 'user-cavite-local', email: 'cavite@example.test', displayName: 'Cavite User', jobTitle: 'Provincial Analyst', status: 'active' },
  { id: 'user-lucena-local', email: 'lucena@example.test', displayName: 'Lucena City User', jobTitle: 'City Analyst', status: 'active' },
  { id: 'user-marilao-local', email: 'marilao@example.test', displayName: 'Marilao User', jobTitle: 'Municipal Analyst', status: 'active' },
  { id: 'user-quezon-city-local', email: 'quezoncity@example.test', displayName: 'Quezon City User', jobTitle: 'City Analyst', status: 'active' },
]

export const authMemberships = authUsers.map(user => ({
  id: `membership-web-${user.id}`,
  tenantId: authTenants[0].id,
  userId: user.id,
  role: user.id === 'user-superadmin-local' ? 'superadmin' : 'viewer',
  status: 'active',
  workspaceIds: [authWorkspaces[0].id],
}))
