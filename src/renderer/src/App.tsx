import { Toaster } from 'sonner'
import { Home } from './pages/home'
import { useThemeStore } from './store/theme'

function App(): React.JSX.Element {
  const theme = useThemeStore((state) => state.resolved)

  return (
    <>
      <Home />
      <Toaster theme={theme} position="bottom-right" />
    </>
  )
}

export default App
