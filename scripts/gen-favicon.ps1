Add-Type -AssemblyName System.Drawing

$src = "d:\ai\d\public\avatars\oyster-warrior.png"
$srcImg = [System.Drawing.Image]::FromFile($src)
$BG = 0xFFFBF2E4

function Make-Bmp([System.Drawing.Image]$s, [int]$sz) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($BG))
    $g.FillRectangle($brush, 0, 0, $sz, $sz)
    $brush.Dispose()
    $ratio = [Math]::Min($sz / $s.Width, $sz / $s.Height)
    $w = [int]($s.Width * $ratio)
    $h = [int]($s.Height * $ratio)
    $x = [int](($sz - $w) / 2)
    $y = [int](($sz - $h) / 2)
    $g.DrawImage($s, $x, $y, $w, $h)
    $g.Dispose()
    return $bmp
}

$iconPath = "d:\ai\d\public\favicon.ico"
$fs = New-Object System.IO.FileStream($iconPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

$sizes = @(256, 128, 64, 48, 32, 16)
$bmps = @()
$pngs = @()

foreach ($sz in $sizes) {
    $b = Make-Bmp $srcImg $sz
    $bmps += $b
    $ms = New-Object System.IO.MemoryStream
    $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs += , $ms.ToArray()
}

# ICONDIR
$bw.Write([UInt16]0)       # reserved
$bw.Write([UInt16]1)       # type=1 icon
$bw.Write([UInt16]$sizes.Count) # count

$imgOffset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $w = if ($sz -eq 256) { 0 } else { [byte]$sz }
    $h = if ($sz -eq 256) { 0 } else { [byte]$sz }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)     # color count
    $bw.Write([byte]0)     # reserved
    $bw.Write([UInt16]1)   # color planes
    $bw.Write([UInt16]32)  # bits per pixel
    $bw.Write([UInt32]$pngs[$i].Length)
    $bw.Write([UInt32]$imgOffset)
    $imgOffset += $pngs[$i].Length
}

foreach ($png in $pngs) {
    $bw.Write($png)
}

$bw.Close()
$fs.Close()

foreach ($b in $bmps) { $b.Dispose() }
$srcImg.Dispose()

Write-Host "Saved $iconPath"
