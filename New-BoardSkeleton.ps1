<#
.SYNOPSIS
    Scaffolds a blank perimeter-style board skin JSON (row/col already computed)
    so you only have to fill in name/type/colorGroup/image per space.

.DESCRIPTION
    Standard Monopoly-style boards are a square perimeter: 4 corners + N spaces
    per side. This generates the row/col grid position for every space in
    clockwise order starting at the bottom-right corner (index 0), matching the
    schema documented at the top of app.js.

.PARAMETER SpacesPerSide
    Number of NON-corner spaces along each side. Classic Monopoly uses 9
    (giving 40 total spaces on an 11x11 grid). Total spaces = (SpacesPerSide * 4) + 4.

.PARAMETER Id
    Skin id (used as filename and JSON "id" field).

.PARAMETER Name
    Display name for the skin.

.PARAMETER OutputPath
    Where to write the JSON file. Defaults to .\configs\<Id>.json

.EXAMPLE
    .\New-BoardSkeleton.ps1 -SpacesPerSide 9 -Id "bandmaid-tour" -Name "BAND-MAID Tour"

.EXAMPLE
    # Smaller 6-per-side board (28 total spaces, 8x8 grid)
    .\New-BoardSkeleton.ps1 -SpacesPerSide 6 -Id "mini-board" -Name "Mini Board"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateRange(1, 30)]
    [int]$SpacesPerSide,

    [Parameter(Mandatory)]
    [string]$Id,

    [Parameter(Mandatory)]
    [string]$Name,

    [string]$OutputPath
)

$gridSize = $SpacesPerSide + 2
$totalSpaces = ($SpacesPerSide * 4) + 4

function Get-Coords {
    param([int]$Index, [int]$SpacesPerSide, [int]$GridSize)

    $sideLen = $SpacesPerSide + 1   # spaces per side including the leading corner

    if ($Index -le $sideLen) {
        # bottom row, right to left
        return @{ row = $GridSize; col = $GridSize - $Index }
    }
    elseif ($Index -le ($sideLen * 2)) {
        # left column, bottom to top
        $offset = $Index - $sideLen
        return @{ row = $GridSize - $offset; col = 1 }
    }
    elseif ($Index -le ($sideLen * 3)) {
        # top row, left to right
        $offset = $Index - ($sideLen * 2)
        return @{ row = 1; col = 1 + $offset }
    }
    else {
        # right column, top to bottom
        $offset = $Index - ($sideLen * 3)
        return @{ row = 1 + $offset; col = $GridSize }
    }
}

$spaces = for ($i = 0; $i -lt $totalSpaces; $i++) {
    $c = Get-Coords -Index $i -SpacesPerSide $SpacesPerSide -GridSize $gridSize
    $isCorner = ($i % ($SpacesPerSide + 1) -eq 0)

    [ordered]@{
        index      = $i
        row        = $c.row
        col        = $c.col
        name       = if ($isCorner) { "Corner $i" } else { "Space $i" }
        type       = if ($isCorner) { "corner" } else { "property" }
        colorGroup = $null
        image      = ""
        icon       = ""
        subtext    = ""
    }
}

$config = [ordered]@{
    id        = $Id
    name      = $Name
    gridSize  = $gridSize
    theme     = [ordered]@{
        boardBg     = "#e8e8e0"
        cellBg      = "#faf8f2"
        borderColor = "#000000"
        textColor   = "#1a1a1a"
        accentColor = "#c0392b"
    }
    center    = [ordered]@{
        title    = $Name
        subtitle = ""
        image    = ""
        bg       = ""
    }
    spaces    = $spaces
}

if (-not $OutputPath) {
    $OutputPath = Join-Path -Path (Join-Path $PSScriptRoot "configs") -ChildPath "$Id.json"
}

$json = $config | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "Wrote $totalSpaces spaces on a $gridSize x $gridSize grid -> $OutputPath"
Write-Host "Remember to add this skin to configs/manifest.json so it shows up in the dropdown."
