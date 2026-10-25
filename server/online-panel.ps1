# Battle Report 40k – status panel of the online server on this PC (Online-Panel.cmd).
# A small always-available window + tray icon (green = everything up, yellow = partly, red = down) that checks every
# 10 seconds: the supervised server (127.0.0.1:8420), the https front (443), the public address through the internet
# (DNS + port forwarding + certificate) and, every 30 seconds, the supervisor's status (games, memory, next restart).
# Buttons start the two server windows, open the admin page and the public site. Closing the window hides it to the
# tray; "Beenden" in the tray menu quits the panel (the servers keep running).
param([string]$Root = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Console]::OutputEncoding = [Text.Encoding]::UTF8   # node's status text (en dashes) comes in as UTF-8

$PUBLIC = 'https://battlereport.jlpicture.de'
$LOCAL = 'http://127.0.0.1:8420'
$FRONT = 'https://127.0.0.1:443'

function Probe($url, $hostHeader) {
  try {
    $req = [System.Net.HttpWebRequest]::Create($url + '/api/session')
    $req.Timeout = 4000; $req.Method = 'GET'; $req.UserAgent = 'BR40k-panel'
    if ($hostHeader) { $req.Host = $hostHeader; $req.ServerCertificateValidationCallback = { $true } }
    $res = $req.GetResponse(); $code = [int]$res.StatusCode; $res.Close()
    return ($code -ge 200 -and $code -lt 500)
  } catch { return $false }
}
function Status() {
  try {
    $out = & node "$Root\server\online-admin.mjs" status 2>&1 | Out-String
    return $out.Trim()
  } catch { return "status: $_" }
}
function MakeIcon($color) {
  $bmp = New-Object System.Drawing.Bitmap 16, 16
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $color), 1, 1, 14, 14)
  $g.Dispose()
  return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}
$icons = @{ green = MakeIcon ([System.Drawing.Color]::FromArgb(46, 204, 113)); yellow = MakeIcon ([System.Drawing.Color]::FromArgb(241, 196, 15)); red = MakeIcon ([System.Drawing.Color]::FromArgb(231, 76, 60)) }

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Battle Report 40k - Online-Server'
$form.Size = New-Object System.Drawing.Size 520, 420
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point 40, 40
$form.TopMost = $false
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(24, 27, 33)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font 'Segoe UI', 10

$rows = @()
$labels = @('Server (127.0.0.1:8420)', 'https-Front (Port 443)', 'Öffentlich (battlereport.jlpicture.de)')
$y = 16
foreach ($t in $labels) {
  $dot = New-Object System.Windows.Forms.Label
  $dot.Text = '●'; $dot.Font = New-Object System.Drawing.Font 'Segoe UI', 16
  $dot.Location = New-Object System.Drawing.Point 14, ($y - 6); $dot.Size = New-Object System.Drawing.Size 30, 32
  $dot.ForeColor = [System.Drawing.Color]::Gray
  $lab = New-Object System.Windows.Forms.Label
  $lab.Text = $t; $lab.Location = New-Object System.Drawing.Point 46, $y; $lab.Size = New-Object System.Drawing.Size 300, 26
  $val = New-Object System.Windows.Forms.Label
  $val.Text = 'prüfe …'; $val.Location = New-Object System.Drawing.Point 350, $y; $val.Size = New-Object System.Drawing.Size 150, 26
  $val.ForeColor = [System.Drawing.Color]::Silver
  $form.Controls.AddRange(@($dot, $lab, $val))
  $rows += ,@($dot, $val)
  $y += 34
}
$box = New-Object System.Windows.Forms.TextBox
$box.Multiline = $true; $box.ReadOnly = $true; $box.ScrollBars = 'Vertical'
$box.Location = New-Object System.Drawing.Point 14, ($y + 6); $box.Size = New-Object System.Drawing.Size 478, 170
$box.BackColor = [System.Drawing.Color]::FromArgb(16, 18, 22); $box.ForeColor = [System.Drawing.Color]::Gainsboro
$box.Font = New-Object System.Drawing.Font 'Consolas', 9
$box.Text = 'Supervisor-Status wird geladen …'
$form.Controls.Add($box)

$by = $y + 186
function AddButton($text, $x, $action) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text; $b.Location = New-Object System.Drawing.Point $x, $by; $b.Size = New-Object System.Drawing.Size 112, 32
  $b.FlatStyle = 'Flat'; $b.ForeColor = [System.Drawing.Color]::White
  $b.Add_Click($action) | Out-Null
  $form.Controls.Add($b)
}
AddButton 'Server starten' 14 { Start-Process -FilePath "$Root\Online-Server.cmd" -WorkingDirectory $Root }
AddButton 'Front starten' 134 { Start-Process -FilePath "$Root\Online-Https.cmd" -WorkingDirectory $Root }
AddButton 'Admin-Seite' 254 { Start-Process "$LOCAL/admin" }
AddButton 'Website' 374 { Start-Process $PUBLIC }

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icons.red; $tray.Text = 'Battle Report 40k - Online-Server'; $tray.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$menu.Items.Add('Panel anzeigen', $null, { $form.Show(); $form.WindowState = 'Normal'; $form.Activate() }) | Out-Null
$menu.Items.Add('Beenden', $null, { $script:quit = $true; $tray.Visible = $false; $form.Close() }) | Out-Null
$tray.ContextMenuStrip = $menu
$tray.Add_DoubleClick({ $form.Show(); $form.WindowState = 'Normal'; $form.Activate() }) | Out-Null
$script:quit = $false
$form.Add_FormClosing({ param($s, $e) if (-not $script:quit) { $e.Cancel = $true; $form.Hide(); $tray.ShowBalloonTip(1500, 'Battle Report 40k', 'Das Panel läuft im Infobereich weiter.', 'Info') } })

$script:tick = 0
function Refresh() {
  $srv = Probe $LOCAL $null
  $front = Probe $FRONT 'battlereport.jlpicture.de'
  $pub = Probe $PUBLIC $null
  $states = @($srv, $front, $pub)
  for ($i = 0; $i -lt 3; $i++) {
    $ok = $states[$i]
    $rows[$i][0].ForeColor = $(if ($ok) { [System.Drawing.Color]::FromArgb(46, 204, 113) } else { [System.Drawing.Color]::FromArgb(231, 76, 60) })
    $rows[$i][1].Text = $(if ($ok) { 'läuft' } else { 'nicht erreichbar' })
  }
  $up = ($states | Where-Object { $_ }).Count
  $tray.Icon = $(if ($up -eq 3) { $icons.green } elseif ($up -gt 0) { $icons.yellow } else { $icons.red })
  $tray.Text = "Battle Report 40k - Server: $(if ($srv) {'läuft'} else {'AUS'}), Front: $(if ($front) {'läuft'} else {'AUS'}), öffentlich: $(if ($pub) {'ok'} else {'nein'})"
  $form.Text = "Battle Report 40k - Online-Server  ($(Get-Date -Format 'HH:mm:ss'))"
  if ($script:tick % 3 -eq 0) { $box.Text = $(if ($srv) { Status } else { 'Server läuft nicht - "Server starten" drücken (Online-Server.cmd).' }) }
  $script:tick++
}
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.Add_Tick({ Refresh }) | Out-Null
$form.Add_Shown({ Refresh; $timer.Start() }) | Out-Null
[System.Windows.Forms.Application]::Run($form)
$tray.Visible = $false
