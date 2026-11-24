import { Group, Panel, Separator } from 'react-resizable-panels'
import { Chat } from './components/Chat'
import { Sider } from './components/Sider'
import { ViewDiff } from './components/ViewDiff'
import { usePiBridge } from './controller/usePiBridge'
import { useUiStore } from './store/ui'

export function Home(): React.JSX.Element {
  usePiBridge()

  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const diffVisible = useUiStore((state) => state.diffVisible)

  return (
    <Group orientation="horizontal" className="bg-main text-fore h-full">
      {!sidebarCollapsed && (
        <>
          <Panel defaultSize="18%" minSize="12%" maxSize="30%" className="h-full min-w-0">
            <Sider />
          </Panel>
          <Separator className="bg-accent-neutral/20 hover:bg-brand/60 w-px transition-colors" />
        </>
      )}

      <Panel className="h-full min-w-0">
        <Chat />
      </Panel>

      {diffVisible && (
        <>
          <Separator className="bg-accent-neutral/20 hover:bg-brand/60 w-px transition-colors" />
          <Panel defaultSize="30%" minSize="18%" maxSize="50%" className="h-full min-w-0">
            <ViewDiff />
          </Panel>
        </>
      )}
    </Group>
  )
}
