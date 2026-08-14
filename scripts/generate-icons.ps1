Add-Type -AssemblyName System.Drawing

# 生蚝战士（原 f09 那张，现在改名为 oyster-warrior.png）
$src = "d:\ai\d\public\avatars\oyster-warrior.png"
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

# 奶油色背景（生蚝图原本的底色）
$BG = 0xFFFBF2E4

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
    Save-Resized $img "$dir\ic_launcher.png" $s $BG
    Save-Resized $img "$dir\ic_launcher_round.png" $s $BG
    Save-Resized $img "$dir\ic_launcher_foreground.png" $s $null
}

# PWA / Web 图标
Save-Resized $img "d:\ai\d\public\pwa-192x192.png" 192 $BG
Save-Resized $img "d:\ai\d\public\pwa-512x512.png" 512 $BG
Save-Resized $img "d:\ai\d\public\maskable-icon-192x192.png" 192 $BG
Save-Resized $img "d:\ai\d\public\maskable-icon-512x512.png" 512 $BG
Save-Resized $img "d:\ai\d\public\apple-touch-icon-180x180.png" 180 $BG
Save-Resized $img "d:\ai\d\public\favicon-32.png" 32 $BG

# 设置页预览图
Save-Resized $img "d:\ai\d\public\icon-preview-oyster-192.png" 192 $BG

$img.Dispose()
Write-Host "All oyster icons done."
