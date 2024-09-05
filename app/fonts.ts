import localFont from 'next/font/local'

export const abcReproMono = localFont({
  src: [
    {
      path: 'fonts/ABCReproMono-Regular.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: 'fonts/ABCReproMono-Bold.woff',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-abc-repro-mono'
})

export const abcRepro = localFont({
  src: [
    {
      path: 'fonts/ABCRepro-Regular.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: 'fonts/ABCRepro-Bold.woff',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-abc-repro'
})