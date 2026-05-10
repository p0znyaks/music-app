Add-Type -AssemblyName System.Security

$pfxPath = "Q:\уник\3 курс\6 сем\ПСКП\курсач\music-app\backend\server.pfx"
$pfxPwd = "musicapp"
$certPath = "Q:\уник\3 курс\6 сем\ПСКП\курсач\music-app\backend\server-cert.pem"
$keyPath = "Q:\уник\3 курс\6 сем\ПСКП\курсач\music-app\backend\server-key.pem"

$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath)
$key = [System.IO.File]::ReadAllBytes($keyPath)

$collection = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2Collection
$collection.Import($certPath, $null, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)

$pkcs12 = $collection.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $pfxPwd)
[System.IO.File]::WriteAllBytes($pfxPath, $pkcs12)

Write-Host "PFX exported. You can import this .pfx file into Firefox."