[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Content", "Format")]
    [string]$Purpose,

    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$OutputPath,

    [switch]$Execute
)

$ErrorActionPreference = "Stop"
$WorkspaceRoot = [IO.Path]::GetFullPath("F:\eduHarness")
$CacheRoot = [IO.Path]::GetFullPath("F:\eduHarness\.cache\uv\markitdown")
$OutputRoot = [IO.Path]::GetFullPath("F:\eduHarness\scratch\document-ingestion")
$MarkItDownVersion = "0.1.6"

function Assert-Within([string]$Candidate, [string]$Root, [string]$Label) {
    $full = [IO.Path]::GetFullPath($Candidate)
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd("\") + "\"
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label must stay inside $Root"
    }
    return $full
}

if ($Purpose -eq "Format") {
    Write-Output "FORMAT_REVIEW_ORIGINAL_REQUIRED"
    Write-Output "MARKITDOWN_NOT_RUN"
    exit 2
}

$input = [IO.Path]::GetFullPath($InputPath)
if (-not (Test-Path -LiteralPath $input -PathType Leaf)) {
    throw "input file not found: $input"
}
if ($input.StartsWith("D:\vibeCode\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "frozen D workspace input is forbidden"
}

$leaf = [IO.Path]::GetFileName($input)
if ($leaf -match '(?i)(^\.env($|\.)|api[-_]?key|token|credential|secret|private[-_]?key)') {
    throw "secret-like input is forbidden"
}

$extension = [IO.Path]::GetExtension($input).ToLowerInvariant()
if ($extension -eq ".md") {
    Write-Output "ALREADY_MARKDOWN_READ_DIRECTLY"
    exit 0
}

$extras = @{
    ".docx" = "docx"
    ".pptx" = "pptx"
    ".xlsx" = "xlsx"
    ".xls" = "xls"
    ".pdf" = "pdf"
    ".msg" = "outlook"
}
$baseFormats = @(".html", ".htm", ".csv", ".json", ".xml", ".epub", ".ipynb", ".txt")
if (-not $extras.ContainsKey($extension) -and $extension -notin $baseFormats) {
    throw "unsupported content-ingestion extension: $extension"
}

$package = if ($extras.ContainsKey($extension)) {
    "markitdown[$($extras[$extension])]==$MarkItDownVersion"
} else {
    "markitdown==$MarkItDownVersion"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $safeName = [IO.Path]::GetFileNameWithoutExtension($input) -replace '[^A-Za-z0-9._-]', '_'
    if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "document" }
    $stamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
    $output = Join-Path $OutputRoot "$safeName-$stamp.md"
} else {
    $output = $OutputPath
}
$output = Assert-Within $output $OutputRoot "output"
if ([IO.Path]::GetExtension($output).ToLowerInvariant() -ne ".md") {
    throw "output must use .md extension"
}
if ($output.Equals($input, [StringComparison]::OrdinalIgnoreCase)) {
    throw "output must not overwrite input"
}

Write-Output "INGESTION_PLAN"
Write-Output "purpose=content"
Write-Output "input=$input"
Write-Output "output=$output"
Write-Output "cache=$CacheRoot"
Write-Output "package=$package"
Write-Output "execute=$($Execute.IsPresent.ToString().ToLowerInvariant())"

if (-not $Execute) {
    Write-Output "NO_CHANGES_USE_-Execute"
    exit 0
}

$uvx = Get-Command uvx -ErrorAction SilentlyContinue
if (-not $uvx) { throw "uvx not found on PATH" }
New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null

& $uvx.Source --cache-dir $CacheRoot --no-config --from $package markitdown $input -o $output
if ($LASTEXITCODE -ne 0) { throw "MarkItDown failed with exit code $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw "conversion output missing" }
if ((Get-Item -LiteralPath $output).Length -eq 0) { throw "conversion output is empty" }

Write-Output "INGESTION_COMPLETE"
Write-Output "output=$output"
