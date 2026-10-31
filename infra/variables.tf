variable "subscription_id" {
  description = "Azure subscription to deploy into. Changing it deploys a fresh copy elsewhere."
  type        = string
}

variable "name_prefix" {
  description = "Prefix for all resource names (lowercase letters and digits)."
  type        = string
  default     = "rsvptest"

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,15}$", var.name_prefix))
    error_message = "name_prefix must be 3-16 lowercase letters/digits, starting with a letter."
  }
}

variable "location" {
  description = "Region for the resource group and Cosmos DB."
  type        = string
  default     = "westeurope"
}

variable "cosmos_location" {
  description = "Region for Cosmos DB; West Europe often rejects new accounts due to capacity."
  type        = string
  default     = "germanywestcentral"
}

variable "static_web_app_location" {
  description = "Region for the Static Web App (only a few regions support it)."
  type        = string
  default     = "westeurope"
}

variable "cosmos_database_name" {
  type    = string
  default = "rsvp"
}

variable "cosmos_container_name" {
  type    = string
  default = "invitations"
}

variable "admin_password_hash" {
  description = "Output of `npm run hash-password` in api/."
  type        = string
  sensitive   = true
}

variable "rsvp_deadline" {
  description = "ISO date after which guests can no longer change answers, e.g. 2027-05-01T00:00:00+02:00. Empty = no deadline."
  type        = string
  default     = ""
}

variable "budget_amount" {
  description = "Monthly budget in the subscription currency that triggers an alert email."
  type        = number
  default     = 1
}

variable "budget_contact_emails" {
  description = "Who receives budget alert emails."
  type        = list(string)
}

variable "tags" {
  type    = map(string)
  default = { project = "rsvp", environment = "test" }
}
