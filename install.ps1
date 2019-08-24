#!/usr/bin/env pwsh

$ErrorActionPreference = 'Stop'

if ($args.Length -gt 0) {
  $Version = $args.Get(0)
}

if ($PSVersionTable.PSEdition -ne 'Core') {
  $IsWindows = $true
  $IsMacOS = $false
}

$BinDir = if ($IsWindows) {
  "$Home\.locize-cli\bin"
} else {
  "$Home/.locize-cli/bin"
}

$Zip = if ($IsWindows) {
  'zip'
} else {
  'gz'
}

$LocizeExe = if ($IsWindows) {
  "$BinDir\locize.exe"
} else {
  "$BinDir/locize"
}

$OS = if ($IsWindows) {
  'win.exe'
} else {
  if ($IsMacOS) {
    'macos'
  } else {
    'linux'
  }
}

$FILENAME = if ($IsWindows) {
  'locize.exe'
} else {
  'locize'
}

# GitHub requires TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$DenoUri = if (!$Version) {
  $Response = Invoke-WebRequest 'https://github.com/locize/locize-cli/releases' -UseBasicParsing
  if ($PSVersionTable.PSEdition -eq 'Core') {
    $Response.Links |
      Where-Object { $_.href -like "/locize/locize-cli/releases/download/*/locize-${OS}" } |
      ForEach-Object { 'https://github.com' + $_.href } |
      Select-Object -First 1
  } else {
    $HTMLFile = New-Object -Com HTMLFile
    if ($HTMLFile.IHTMLDocument2_write) {
      $HTMLFile.IHTMLDocument2_write($Response.Content)
    } else {
      $ResponseBytes = [Text.Encoding]::Unicode.GetBytes($Response.Content)
      $HTMLFile.write($ResponseBytes)
    }
    $HTMLFile.getElementsByTagName('a') |
      Where-Object { $_.href -like "about:/locize/locize-cli/releases/download/*/locize-${OS}" } |
      ForEach-Object { $_.href -replace 'about:', 'https://github.com' } |
      Select-Object -First 1
  }
} else {
  "https://github.com/locize/locize-cli/releases/download/$Version/locize-${OS}"
}

if (!(Test-Path $BinDir)) {
  New-Item $BinDir -ItemType Directory | Out-Null
}

if ($IsWindows) {
  Invoke-WebRequest $DenoUri -OutFile "$BinDir\$FILENAME" -UseBasicParsing
} else {
  Invoke-WebRequest $DenoUri -OutFile "$BinDir/$FILENAME" -UseBasicParsing
}

if ($IsWindows) {
  $User = [EnvironmentVariableTarget]::User
  $Path = [Environment]::GetEnvironmentVariable('Path', $User)
  if (!(";$Path;".ToLower() -like "*;$BinDir;*".ToLower())) {
    [Environment]::SetEnvironmentVariable('Path', "$Path;$BinDir", $User)
    $Env:Path += ";$BinDir"
  }
  Write-Output "locize-cli (locize) was installed successfully to $LocizeExe"
  Write-Output "Run 'locize --help' to get started"
} else {
  chmod +x "$BinDir/locize"
  Write-Output "locize-cli (locize) was installed successfully to $LocizeExe"
  if (Get-Command locize -ErrorAction SilentlyContinue) {
    Write-Output "Run 'locize --help' to get started"
  } else {
    Write-Output "Manually add the directory to your `$HOME/.bash_profile (or similar)"
    Write-Output "  export PATH=`"${BinDir}:`$PATH`""
    Write-Output "Run '$LocizeExe --help' to get started"
  }
}