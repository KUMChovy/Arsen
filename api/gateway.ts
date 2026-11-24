import { serveAccount } from '../server/auth/accountVercel'
import { serveAdminInvitations } from '../server/auth/adminVercel'
import { serveBackups } from '../server/backups/vercel'
import { serveCleanup } from '../server/backups/maintenanceVercel'
import { serveAdminCatalogDrafts } from '../server/catalog/adminDraftVercel'
import { serveCatalog } from '../server/catalog/vercel'
import { createApiRouter, createRewriteGateway } from '../server/http/apiRouter'

export default { fetch: createRewriteGateway(createApiRouter({ account: serveAccount, backups: serveBackups, admin: serveAdminInvitations, adminCatalog: serveAdminCatalogDrafts, catalog: serveCatalog, cleanup: serveCleanup })) }
