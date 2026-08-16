[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Content", "Format")]
    [string]$Purpose,

    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$WorkspaceRoot,

    [string]$OutputPath,

    [string]$CachePath = "scratch/cache/markitdown",

    [string]$OutputDirectory = "outputs/document-ingestion",

    [switch]$Execute
)

$ErrorActionPreference = "Stop"

function Resolve-WorkspaceRoot {
    param([string]$RequestedRoot)

    $candidate = if ([string]::IsNullOrWhiteSpace($RequestedRoot)) {
        (Get-Location).Path
    } else {
        [IO.Path]::GetFullPath($RequestedRoot)
    }

    while ($true) {
        $marker = Join-Path $candidate "harness/config/local-harness.json"
        if (Test-Path -LiteralPath $marker -PathType Leaf) { return $candidate }
        $parent = Split-Path -Parent $candidate
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $candidate) {
            throw "HARNESS_ROOT_NOT_FOUND: use -WorkspaceRoot with a repository-relative or local path"
        }
        $candidate = $parent
    }
}

function Resolve-InWorkspace {
    param(
        [string]$Candidate,
        [string]$Root,
        [string]$Label
    )

    $full = if ([IO.Path]::IsPathRooted($Candidate)) {
        [IO.Path]::GetFullPath($Candidate)
    } else {
        [IO.Path]::GetFullPath((Join-Path $Root $Candidate))
    }
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd("\") + "\"
    if ($full -ne [IO.Path]::GetFullPath($Root) -and -not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label must stay inside the workspace: $Candidate"
    }
    return $full
}

$root = Resolve-WorkspaceRoot $WorkspaceRoot
$cacheRoot = Resolve-InWorkspace $CachePath $root "cache"
$outputRoot = Resolve-InWorkspace $OutputDirectory $root "output directory"

if ($Purpose -eq "Format") {
    Write-Output "FORMAT_REVIEW_ORIGINAL_REQUIRED"
    Write-Output "MARKITDOWN_NOT_RUN"
    exit 2
}

$input = if ([IO.Path]::IsPathRooted($InputPath)) {
    [IO.Path]::GetFullPath($InputPath)
} else {
    [IO.Path]::GetFullPath((Join-Path (Get-Location).Path $InputPath))
}
if (-not (Test-Path -LiteralPath $input -PathType Leaf)) {
    throw "input file not found: $input"
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

$packageVersion = "0.1.6"
$package = if ($extras.ContainsKey($extension)) {
    "markitdown[$($extras[$extension])]==$packageVersion"
} else {
    "markitdown==$packageVersion"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $safeName = [IO.Path]::GetFileNameWithoutExtension($input) -replace '[^A-Za-z0-9._-]', '_'
    if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "document" }
    $stamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
    $output = Join-Path $outputRoot "$safeName-$stamp.md"
} else {
    $output = Resolve-InWorkspace $OutputPath $root "output"
}
if (-not $output.StartsWith(([IO.Path]::GetFullPath($outputRoot).TrimEnd("\") + "\"), [StringComparison]::OrdinalIgnoreCase)) {
    throw "output must stay inside the configured output directory"
}
if ([IO.Path]::GetExtension($output).ToLowerInvariant() -ne ".md") {
    throw "output must use .md extension"
}
if ($output.Equals($input, [StringComparison]::OrdinalIgnoreCase)) {
    throw "output must not overwrite input"
}

Write-Output "INGESTION_PLAN"
Write-Output "purpose=content"
Write-Output "workspace=$root"
Write-Output "input=$input"
Write-Output "output=$output"
Write-Output "cache=$cacheRoot"
Write-Output "package=$package"
Write-Output "execute=$($Execute.IsPresent.ToString().ToLowerInvariant())"

if (-not $Execute) {
    Write-Output "NO_CHANGES_USE_-Execute"
    exit 0
}

$uvx = Get-Command uvx -ErrorAction SilentlyContinue
if (-not $uvx) { throw "uvx not found on PATH" }
New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null

& $uvx.Source --cache-dir $cacheRoot --no-config --from $package markitdown $input -o $output
if ($LASTEXITCODE -ne 0) { throw "MarkItDown failed with exit code $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw "conversion output missing" }
if ((Get-Item -LiteralPath $output).Length -eq 0) { throw "conversion output is empty" }

Write-Output "INGESTION_COMPLETE"
Write-Output "output=$output"
