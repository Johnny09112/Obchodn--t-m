# Hlídka Čmuchala — ikona u hodin, která hlídá frontu objednávek průzkumu.
#
# Proč PowerShell a ne vlastní aplikace: WinForms je ve Windows už nainstalovaný,
# takže tohle nepřidává žádnou závislost ani instalaci. Ikona se kreslí za běhu,
# aby se nemusel nikam ukládat obrázek.
#
# Spouští se přes `Cmuchal.vbs` (bez černého okna). Ukončit jde kdykoli
# z nabídky pravým tlačítkem na ikoně.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$koren = Split-Path -Parent $PSScriptRoot
$denik = Join-Path $koren "data\cmuchal-hlidka.log"

# Jen jedna hlídka naráz. Dvě by se sice o frontu nepraly (hlídá to zámek
# v databázi), ale dvě ikony u hodin jsou matoucí.
$mutex = New-Object System.Threading.Mutex($false, "Global\CantineroCmuchalHlidka")
if (-not $mutex.WaitOne(0)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Hlídka Čmuchala už běží — podívej se mezi ikony u hodin.",
    "Cantinero") | Out-Null
  return
}

# ── stav

$script:pozastaveno = $false
$script:proces = $null
$script:posledniUrgent = [datetime]::MinValue
$script:posledniPlny = [datetime]::MinValue
$script:posledniHlaska = "zatím nic"

# Řádné denní běhy. Mimo ně se sahá jen po urgentních objednávkách.
$okna = @(8, 13, 19)
$urgentKazdychMin = 10

function Napis([string]$text) {
  $radek = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $text
  Add-Content -Path $denik -Value $radek -Encoding utf8
}

# Ikona se kreslí, ne načítá — kolečko v barvě podle stavu.
function NovaIkona([System.Drawing.Color]$barva, [bool]$vyplnene) {
  $bmp = New-Object System.Drawing.Bitmap 16, 16
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.Clear([System.Drawing.Color]::Transparent)
  if ($vyplnene) {
    $stetec = New-Object System.Drawing.SolidBrush $barva
    $g.FillEllipse($stetec, 2, 2, 12, 12)
    $stetec.Dispose()
  } else {
    $pero = New-Object System.Drawing.Pen $barva, 2
    $g.DrawEllipse($pero, 3, 3, 10, 10)
    $pero.Dispose()
  }
  $g.Dispose()
  $ikona = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
  $bmp.Dispose()
  return $ikona
}

$barvaHlida  = [System.Drawing.Color]::FromArgb(63, 107, 58)    # zelená jako v aplikaci
$barvaBezi   = [System.Drawing.Color]::FromArgb(46, 74, 125)    # razítkově modrá
$barvaStoji  = [System.Drawing.Color]::FromArgb(95, 107, 98)    # tlumená šedá

$ikonaHlida = NovaIkona $barvaHlida $true
$ikonaBezi  = NovaIkona $barvaBezi $true
$ikonaStoji = NovaIkona $barvaStoji $false

# ── ikona u hodin

$ikona = New-Object System.Windows.Forms.NotifyIcon
$ikona.Icon = $ikonaHlida
$ikona.Visible = $true

$nabidka = New-Object System.Windows.Forms.ContextMenuStrip
$ikona.ContextMenuStrip = $nabidka

$polozkaStav = $nabidka.Items.Add("Hlídám frontu")
$polozkaStav.Enabled = $false
$nabidka.Items.Add("-") | Out-Null
$polozkaTed = $nabidka.Items.Add("Prozkoumat frontu teď")
$polozkaPauza = $nabidka.Items.Add("Pozastavit")
$nabidka.Items.Add("-") | Out-Null
$polozkaDenik = $nabidka.Items.Add("Otevřít deník")
$nabidka.Items.Add("-") | Out-Null
$polozkaKonec = $nabidka.Items.Add("Ukončit hlídku")

function Bezi() {
  return ($null -ne $script:proces) -and (-not $script:proces.HasExited)
}

function ObnovVzhled() {
  if (Bezi) {
    $ikona.Icon = $ikonaBezi
    $ikona.Text = "Cantinero — právě prozkoumávám"
    $polozkaStav.Text = "Právě prozkoumávám"
  } elseif ($script:pozastaveno) {
    $ikona.Icon = $ikonaStoji
    $ikona.Text = "Cantinero — pozastaveno"
    $polozkaStav.Text = "Pozastaveno"
  } else {
    $ikona.Icon = $ikonaHlida
    $ikona.Text = "Cantinero — hlídám frontu"
    $polozkaStav.Text = "Hlídám frontu · $($script:posledniHlaska)"
  }
  $polozkaPauza.Text = if ($script:pozastaveno) { "Spustit hlídku" } else { "Pozastavit" }
  $polozkaTed.Enabled = -not (Bezi)
}

# Průzkum se pouští jako samostatný proces a NEČEKÁ se na něj — velké území
# běží desítky minut a hlídka by po tu dobu nešla ani vypnout.
function Spust([bool]$jenUrgentni) {
  if (Bezi) { return }

  $prepinace = if ($jenUrgentni) {
    "pruzkum obsluz --jen-urgentni --nejvyse-objednavek 1"
  } else {
    "pruzkum obsluz --nejvyse-objednavek 3"
  }
  $co = if ($jenUrgentni) { "hlídka urgentů" } else { "řádný běh" }
  Napis "$co — spouštím"
  $script:posledniHlaska = "naposled $(Get-Date -Format 'HH:mm')"

  $script:proces = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run cli -- $prepinace >> `"$denik`" 2>&1" `
    -WorkingDirectory $koren -WindowStyle Hidden -PassThru
  ObnovVzhled
}

# ── obsluha nabídky

$polozkaTed.Add_Click({
  Spust $false
})

$polozkaPauza.Add_Click({
  $script:pozastaveno = -not $script:pozastaveno
  Napis $(if ($script:pozastaveno) { "pozastaveno člověkem" } else { "spuštěno člověkem" })
  ObnovVzhled
})

$polozkaDenik.Add_Click({
  if (Test-Path $denik) { Start-Process notepad.exe $denik }
  else { [System.Windows.Forms.MessageBox]::Show("Deník je zatím prázdný.", "Cantinero") | Out-Null }
})

$polozkaKonec.Add_Click({
  Napis "hlídka ukončena"
  $ikona.Visible = $false
  [System.Windows.Forms.Application]::Exit()
})

# Dvojklik = prozkoumat teď. Stejné jako položka v nabídce, jen po ruce.
$ikona.Add_DoubleClick({ Spust $false })

# ── tikání

$casovac = New-Object System.Windows.Forms.Timer
$casovac.Interval = 60000
$casovac.Add_Tick({
  ObnovVzhled
  if ($script:pozastaveno -or (Bezi)) { return }

  $ted = Get-Date

  # Řádné okno: jednou za den v každou z dohodnutých hodin.
  if ($okna -contains $ted.Hour -and $ted.Minute -lt 5) {
    $klic = $ted.Date.AddHours($ted.Hour)
    if ($script:posledniPlny -ne $klic) {
      $script:posledniPlny = $klic
      Spust $false
      return
    }
  }

  # Urgentní: často, ale bere jen objednávky označené jako spěchající.
  if (($ted - $script:posledniUrgent).TotalMinutes -ge $urgentKazdychMin) {
    $script:posledniUrgent = $ted
    Spust $true
  }
})
$casovac.Start()

Napis "hlídka spuštěna"
ObnovVzhled

# Hlídka žije, dokud ji člověk neukončí z nabídky.
[System.Windows.Forms.Application]::Run()

$ikona.Dispose()
$mutex.ReleaseMutex()
