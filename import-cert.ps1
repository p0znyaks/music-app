Add-Type -AssemblyName System.Security

$certPath = "Q:\уник\3 курс\6 сем\ПСКП\курсач\music-app\backend\server-cert.pem"
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
$store.Open("ReadWrite")
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath)
$store.Add($cert)
$store.Close()

Write-Host "Certificate imported successfully!"
Write-Host "Subject: $($cert.Subject)"