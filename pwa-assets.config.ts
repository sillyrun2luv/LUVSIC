import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      sizes: [192, 512],
      // padding 让图标在圆形/圆角裁剪时留出安全区
      padding: 0,
      resizeOptions: { background: '#15131A', fit: 'contain' }
    },
    transparent: {
      ...minimal2023Preset.transparent,
      sizes: [192, 512],
      favicons: [[48, 'favicon.ico']]
    }
  },
  images: ['public/icon-source.svg'],
})
