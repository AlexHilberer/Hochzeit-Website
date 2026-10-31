#!/usr/bin/env bash
# Writes api/local.settings.json for `npm run dev`, using a separate dev container in the deployed Cosmos DB.
set -euo pipefail
cd "$(dirname "$0")/.."

output() { terraform -chdir=infra output -raw "$1"; }

COSMOS_CONNECTION_STRING="$(output cosmos_connection_string)" \
COSMOS_DATABASE="$(output cosmos_database_name)" \
SESSION_SECRET="$(output session_secret)" \
ADMIN_PASSWORD_HASH="$(output admin_password_hash)" \
node -e '
const keys = ["COSMOS_CONNECTION_STRING", "COSMOS_DATABASE", "SESSION_SECRET", "ADMIN_PASSWORD_HASH"];
const values = { FUNCTIONS_WORKER_RUNTIME: "node", COSMOS_CONTAINER: "invitations-dev" };
for (const key of keys) values[key] = process.env[key];
require("fs").writeFileSync("api/local.settings.json", JSON.stringify({ IsEncrypted: false, Values: values }, null, 2));
'
echo "Wrote api/local.settings.json"
