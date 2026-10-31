#!/usr/bin/env bash
# Creates/updates the Azure resources and uploads the website.
set -euo pipefail
cd "$(dirname "$0")/.."

terraform -chdir=infra init -input=false
terraform -chdir=infra apply
token=$(terraform -chdir=infra output -raw deployment_token)

npm --prefix api ci --omit=dev
npx swa deploy src --api-location api --api-language node --api-version 20 \
  --deployment-token "$token" --env production
npm --prefix api ci

echo "Website: $(terraform -chdir=infra output -raw website_url)"
