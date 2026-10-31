resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

locals {
  name = "${var.name_prefix}-${random_string.suffix.result}"
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = var.tags
}

resource "azurerm_cosmosdb_account" "main" {
  name                = "cosmos-${local.name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.cosmos_location
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"
  free_tier_enabled   = true
  tags                = var.tags

  # Caps the account at the free-tier allowance so it can never bill for throughput.
  capacity {
    total_throughput_limit = 1000
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = var.cosmos_location
    failover_priority = 0
  }
}

resource "azurerm_cosmosdb_sql_database" "main" {
  name                = var.cosmos_database_name
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  throughput          = 1000
}

resource "azurerm_cosmosdb_sql_container" "invitations" {
  name                = var.cosmos_container_name
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/id"]
}

resource "random_password" "session_secret" {
  length  = 48
  special = false
}

resource "azurerm_static_web_app" "main" {
  name                = "swa-${local.name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.static_web_app_location
  sku_tier            = "Free"
  sku_size            = "Free"
  tags                = var.tags

  app_settings = merge({
    COSMOS_CONNECTION_STRING = azurerm_cosmosdb_account.main.primary_sql_connection_string
    COSMOS_DATABASE          = azurerm_cosmosdb_sql_database.main.name
    COSMOS_CONTAINER         = azurerm_cosmosdb_sql_container.invitations.name
    SESSION_SECRET           = random_password.session_secret.result
    ADMIN_PASSWORD_HASH      = var.admin_password_hash
  }, var.rsvp_deadline == "" ? {} : { RSVP_DEADLINE = var.rsvp_deadline })
}

resource "azurerm_consumption_budget_resource_group" "main" {
  name              = "budget-${local.name}"
  resource_group_id = azurerm_resource_group.main.id
  amount            = var.budget_amount
  time_grain        = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00Z", timestamp())
  }

  notification {
    enabled        = true
    threshold      = 50
    operator       = "GreaterThan"
    contact_emails = var.budget_contact_emails
  }

  lifecycle {
    ignore_changes = [time_period]
  }
}
