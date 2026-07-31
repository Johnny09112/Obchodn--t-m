' Spoustec hlidky Cmuchala bez cerneho okna.
'
' PowerShell sam by pri spusteni probliknul konzoli, i s -WindowStyle Hidden.
' Tenhle mustek ho spusti opravdu skryte (posledni parametr 0 = bez okna).
'
' Dvojklik na tenhle soubor = hlidka naskoci mezi ikony u hodin.
'
' Soubor je zamerne bez diakritiky: Windows cte .vbs jako ANSI a ceska
' pismena v UTF-8 by se rozsypala. Ze stejneho duvodu je bez diakritiky
' i cmuchal-fronta.cmd; skript .ps1 to resi znackou kodovani (BOM).

Dim shell, slozka, prikaz
Set shell = CreateObject("WScript.Shell")
slozka = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

prikaz = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & slozka & "\cmuchal-hlidka.ps1"""
shell.Run prikaz, 0, False
