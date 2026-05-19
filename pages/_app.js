import '../styles/globals.css'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Biriyani Express</title>
        <meta name="description" content="Biriyani Express - Dum Pukht biryani, slow-cooked over real fire." />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
