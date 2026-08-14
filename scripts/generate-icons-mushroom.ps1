Add-Type -AssemblyName System.Drawing

$src = "d:\ai\d\public\avatars\mushroom-warrior.jpg"
$img = [System.Drawing.Image]::FromFile($src)

function Save-Resized([System.Drawing.Image]$srcImg, [string]$path, [int]$size, [nullable[int]]$bgColor) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    if ($bgColor.HasValue) {
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($bgColor.Value))
        $g.FillRectangle($brush, 0, 0, $size, $size)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }
    $ratio = [Math]::Min($size / $srcImg.Width, $size / $srcImg.Height)
    $w = [int]($srcImg.Width * $ratio)
    $h = [int]($srcImg.Height * $ratio)
    $x = [int](($size - $w) / 2)
    $y = [int](($size - $h) / 2)
    $g.DrawImage($srcImg, $x, $y, $w, $h)
    $dir = Split-Path $path -Parent
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Saved $path ($size x $size)"
}

$BG_ARGB = 0xFFF1DCC2

$pairs = @(
    @("mdpi", 48),
    @("hdpi", 72),
    @("xhdpi", 96),
    @("xxhdpi", 144),
    @("xxxhdpi", 192)
)

foreach ($p in $pairs) {
    $k = $p[0]
    $s = $p[1]
    $dir = "d:\ai\d\android\app\src\main\res\mipmap-$k"
    Save-Resized $img "$dir\ic_mushroom_launcher.png" $s $BG_ARGB
    Save-Resized $img "$dir\ic_mushroom_launcher_round.png" $s $BG_ARGB
    Save-Resized $img "$dir\ic_mushroom_launcher_foreground.png" $s $null
}

Save-Resized $img "d:\ai\d\public\icon-preview-mushroom-192.png" 192 $BG_ARGB

$img.Dispose()
Write-Host "All mushroom icons done."
