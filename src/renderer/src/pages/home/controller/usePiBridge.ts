import { useEffect } from 'react'
import { toast } from 'sonner'
import { chatActions } from '../store/chat'

export function usePiBridge(): void {
  useEffect(
    () =>
      window.api.pi.onEvent((batch) => {
        for (const event of batch.events) {
          if (event.type !== 'extension_ui') continue
          const request = event.request
          if (request.method === 'notify' && request.message) {
            if (request.notifyType === 'error') toast.error(request.message)
            else if (request.notifyType === 'warning') toast.warning(request.message)
            else toast.info(request.message)
          } else if (request.method === 'setTitle' && request.title) {
            document.title = request.title
          }
        }
        chatActions.apply(batch)
      }),
    []
  )
}
