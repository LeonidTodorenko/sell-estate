[CmdletBinding()]
param(
    [switch]$CheckGitHub,
    [string[]]$Path = @()
)

$ErrorActionPreference = 'Stop'
$testRoot = 'C:\App'
$primaryRoot = 'C:\Data\sell_estate\sell-estate'

function Invoke-GitRead {
    param([string]$Root, [string[]]$Arguments)
    & git --no-optional-locks -c core.longpaths=true -C $Root @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git failed in $Root ($LASTEXITCODE)."
    }
}

foreach ($root in @($testRoot, $primaryRoot)) {
    Write-Output "=== $root ==="
    $actualRoot = Invoke-GitRead $root @('rev-parse', '--show-toplevel')
    if ([IO.Path]::GetFullPath($actualRoot) -ne $root) {
        throw "Unexpected checkout root: $actualRoot"
    }
    Invoke-GitRead $root @('rev-parse', 'HEAD')
    Invoke-GitRead $root @('status', '--short', '--branch', '--untracked-files=normal')
    Invoke-GitRead $root @('worktree', 'list')
}

if ($CheckGitHub) {
    Write-Output '=== GitHub refs ==='
    Invoke-GitRead $primaryRoot @('ls-remote', '--heads', 'origin', 'main', 'release/ownersclub-30.8.5')
}

foreach ($relative in $Path) {
    if ($relative -notmatch '^[\w.-]+([/\\][\w.-]+)*$' -or
        ($relative -split '[/\\]') -contains '..' -or
        ($relative -split '[/\\]') -contains '.git') {
        throw "Expected a repository-relative source path: $relative"
    }

    $digests = foreach ($root in @($testRoot, $primaryRoot)) {
        $candidate = Join-Path $root $relative
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $item = Get-Item -LiteralPath $candidate
            while ($item.FullName -ne $root) {
                if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                    throw "Linked path is outside comparison scope: $($item.FullName)"
                }
                $item = Get-Item -LiteralPath (Split-Path -Parent $item.FullName)
            }
            (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash
        } else {
            'missing'
        }
    }
    [pscustomobject]@{
        Path = $relative
        Test = $digests[0]
        Primary = $digests[1]
        ByteIdentical = $digests[0] -ne 'missing' -and $digests[0] -eq $digests[1]
    }
}
