param(
  [Parameter(Mandatory = $true)]
  [string]$DbPassword
)

$ErrorActionPreference = "Stop"

$projectRef = "ohdvqqgfebwseeudtwae"
$backupFile = "supabase\nexus-backup-before-prod-reset.sql"
$resetFile = "supabase\reset-prod-data.sql"
$seedFile = "supabase\seed.prod.sql"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [string[]]$Command
  )

  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Command[0] $Command[1..($Command.Length - 1)]
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Label"
  }
}

Invoke-Step "Link nexus-app" @("supabase", "link", "--project-ref", $projectRef, "--password", $DbPassword)
Invoke-Step "Backup current schema" @("supabase", "db", "dump", "--linked", "-f", $backupFile)
Invoke-Step "Reset production data" @("supabase", "db", "query", "--linked", "-f", $resetFile, "-o", "json")
Invoke-Step "Apply production seed" @("supabase", "db", "query", "--linked", "-f", $seedFile, "-o", "json")
Invoke-Step "Verify organizations" @("supabase", "db", "query", "--linked", "select count(*) as organizations from public.organizations;", "-o", "json")
Invoke-Step "Verify plans" @("supabase", "db", "query", "--linked", "select count(*) as subscription_plans from public.subscription_plans;", "-o", "json")
Invoke-Step "Verify profiles" @("supabase", "db", "query", "--linked", "select count(*) as profiles from public.profiles;", "-o", "json")
Invoke-Step "Verify system users" @("supabase", "db", "query", "--linked", "select count(*) as system_users from public.system_users;", "-o", "json")

Write-Host "nexus-app production bootstrap complete." -ForegroundColor Green
