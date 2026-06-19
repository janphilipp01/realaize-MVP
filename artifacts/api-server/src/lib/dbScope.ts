// Thin re-export of the @workspace/db transaction-scoping helper.
// Lives in api-server's lib/ so route handlers don't reach across packages
// for the most common dependency.
export { withUserScope, db } from "@workspace/db";
