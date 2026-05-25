import { Html, Head, Main, NextScript } from 'next/document'
export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="COMYCS — CS2 Stats, Inventário e Comunidade" />
        <meta name="theme-color" content="#f5a623" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎯</text></svg>" />
      </Head>
      <body><Main /><NextScript /></body>
    </Html>
  )
}
