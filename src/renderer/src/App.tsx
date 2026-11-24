import { Toaster } from 'sonner'
import { Home } from './pages/home'

function App(): React.JSX.Element {
  return (
    <>
      <Home />
      <Toaster theme="dark" position="bottom-right" />
    </>
  )
}

export default App
