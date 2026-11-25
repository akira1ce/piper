import { FilePenLine } from 'lucide-react'
import type { JSX } from 'react'
import type { TurnChanges } from '@shared/piProtocol'
import { Button } from '@renderer/components/ui/button'
import { FilePathLabel } from '../FilePathLabel'
import { reviewActions } from '../../store/review'
import { uiActions } from '../../store/ui'

interface ChangeSummaryCardProps {
  changes: TurnChanges
}

export function ChangeSummaryCard({ changes }: ChangeSummaryCardProps): JSX.Element {
  const allCreated = changes.files.every((file) => file.status === 'created')

  return (
    <div className="border-accent-neutral/20 overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 px-3 py-2">
        <FilePenLine className="text-accent-neutral size-4 shrink-0" />
        <span className="text-xs">
          {allCreated ? '已创建' : '已编辑'} {changes.files.length} 个文件
        </span>
        <span className="text-accent-emerald text-xs">+{changes.additions}</span>
        <span className="text-accent-rose text-xs">-{changes.deletions}</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            reviewActions.open(changes)
            uiActions.showDiff()
          }}
        >
          审阅
        </Button>
      </div>
      <div className="border-accent-neutral/10 border-t">
        {changes.files.map((file) => (
          <button
            key={file.path}
            type="button"
            onClick={() => {
              reviewActions.open(changes, file.path)
              uiActions.showDiff()
            }}
            className="hover:bg-card-hover flex w-full items-center gap-2 px-3 py-1.5 text-left"
          >
            <FilePathLabel path={file.path} className="flex-1 text-[11px]" />
            <span className="text-accent-emerald text-[11px]">+{file.additions}</span>
            <span className="text-accent-rose text-[11px]">-{file.deletions}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
