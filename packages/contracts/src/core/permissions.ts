import { definePermissions } from '../permissions.js'

export const corePermissions = definePermissions([
  { key: 'core.workspace.view', label: 'View workspace', scope: 'workspace', defaultRoles: ['owner', 'admin', 'member', 'guest'], dangerous: false },
  { key: 'core.workspace.manage', label: 'Manage workspace settings', scope: 'workspace', defaultRoles: ['owner', 'admin'], dangerous: false },
  { key: 'core.workspace.delete', label: 'Archive / delete workspace', scope: 'workspace', defaultRoles: ['owner'], dangerous: true },
  { key: 'core.members.view', label: 'View members', scope: 'workspace', defaultRoles: ['owner', 'admin', 'member'], dangerous: false },
  { key: 'core.members.invite', label: 'Invite members', scope: 'workspace', defaultRoles: ['owner', 'admin', 'member'], dangerous: false },
  { key: 'core.members.manage', label: 'Manage members, roles and groups', scope: 'workspace', defaultRoles: ['owner', 'admin'], dangerous: false },
  { key: 'core.roles.manage', label: 'Manage roles and permissions', scope: 'workspace', defaultRoles: ['owner', 'admin'], dangerous: true },
  { key: 'core.modules.manage', label: 'Enable/disable modules and their settings', scope: 'workspace', defaultRoles: ['owner', 'admin'], dangerous: false },
  { key: 'core.integrations.manage', label: 'Manage integrations & secrets (SMTP, AI, calls)', scope: 'workspace', defaultRoles: ['owner', 'admin'], dangerous: true },
  { key: 'core.audit.view', label: 'View audit log', scope: 'workspace', defaultRoles: ['owner', 'admin'], dangerous: false },
  { key: 'core.files.upload', label: 'Upload files', scope: 'workspace', defaultRoles: ['owner', 'admin', 'member', 'guest'], dangerous: false },
  { key: 'core.webhooks.manage', label: 'Manage webhooks & API tokens', scope: 'workspace', defaultRoles: ['owner', 'admin'], dangerous: true },
  { key: 'core.export.run', label: 'Export workspace data', scope: 'workspace', defaultRoles: ['owner', 'admin'], dangerous: true },
])
