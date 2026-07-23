import '../styles/globals.css'
import Head from 'next/head'
import { AuthProvider } from '../context/AuthContext'
import AuthModal from '../components/AuthModal'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Biriyani Station Patna | Charcoal Kawabs & Dum Biryanis</title>
        <meta name="description" content="Biriyani Station - Dum Pukht biryani & clay-oven tandoori kawabs, slow-cooked over real fire." />
      </Head>
      <Component {...pageProps} />
      <AuthModal />
    </AuthProvider>
  )
}
