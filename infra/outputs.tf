output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "website_url" {
  value = "https://${azurerm_static_web_app.main.default_host_name}"
}

output "deployment_token" {
  value     = azurerm_static_web_app.main.api_key
  sensitive = true
}

output "cosmos_connection_string" {
  value     = azurerm_cosmosdb_account.main.primary_sql_connection_string
  sensitive = true
}

output "session_secret" {
  value     = random_password.session_secret.result
  sensitive = true
}

output "cosmos_database_name" {
  value = azurerm_cosmosdb_sql_database.main.name
}

output "admin_password_hash" {
  value     = var.admin_password_hash
  sensitive = true
}
