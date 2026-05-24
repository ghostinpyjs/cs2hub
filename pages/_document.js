import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="COMYCS - Veja suas stats, level, kills, horas e inventário do CS2" />
        <meta name="theme-color" content="#f0a000" />
        <meta property="og:title" content="COMYCS - CS2 Stats & Inventory" />
        <meta property="og:description" content="Veja suas stats e inventário do CS2 em tempo real" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎯</text></svg>" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
