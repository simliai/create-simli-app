import localFont from 'next/font/local'

// Regular font 
export const abcRepro = localFont({
  src: [
    {
      path: './fonts/ABCRepro-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/ABCRepro-Regular.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/ABCRepro-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/ABCRepro-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/ABCRepro-Bold.woff',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/ABCRepro-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/ABCRepro-Black.woff2',
      weight: '800',
      style: 'oblique',
    },
    {
      path: './fonts/ABCRepro-Black.woff',
      weight: '800',
      style: 'oblique',
    },
    {
      path: './fonts/ABCRepro-Black.otf',
      weight: '800',
      style: 'oblique',
    },
  ],
  variable: '--font-abc-repro'
})

// Mono font
export const abcReproMono = localFont({
  src: [
    {
      path: 'fonts/ABCReproMono-Regular.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: 'fonts/ABCReproMono-Bold.woff',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-abc-repro-mono'
})
