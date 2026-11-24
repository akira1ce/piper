import { Command } from 'cmdk'
import { Check, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { JSX } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { cn } from '@renderer/lib/utils'
import { chatActions, useChatStore } from '../../store/chat'

export function ModelPicker(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const model = useChatStore((state) => state.model)
  const modelList = useChatStore((state) => state.modelList)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return modelList
    return modelList.filter((item) => `${item.provider}/${item.id}`.toLowerCase().includes(needle))
  }, [modelList, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-accent-neutral hover:text-fore focus-visible:ring-ring/50 flex max-w-56 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] outline-none focus-visible:ring-2"
          title={model ? `${model.provider}/${model.id}` : '选择模型'}
        >
          <span className="truncate">{model?.id ?? '选择模型'}</span>
          <ChevronDown className="size-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command shouldFilter={false} className="flex flex-col">
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="搜索模型…"
            className="placeholder:text-accent-neutral border-accent-neutral/20 w-full border-b bg-transparent px-3 py-2 text-xs outline-none"
          />
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="text-accent-neutral px-2 py-3 text-xs">
              无匹配模型
            </Command.Empty>
            {filtered.map((item) => {
              const active = model?.provider === item.provider && model?.id === item.id
              return (
                <Command.Item
                  key={`${item.provider}/${item.id}`}
                  value={`${item.provider}/${item.id}`}
                  onSelect={() => {
                    void chatActions.setModel(item.provider, item.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'data-[selected=true]:bg-card-hover flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs',
                    active && 'text-fore'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.id}</span>
                  <span className="text-accent-neutral text-[10px]">{item.provider}</span>
                  {active && <Check className="text-accent-emerald size-3" />}
                </Command.Item>
              )
            })}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
