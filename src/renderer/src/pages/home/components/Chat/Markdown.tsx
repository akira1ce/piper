import { code } from '@streamdown/code'
import { memo } from 'react'
import { Streamdown } from 'streamdown'

interface MarkdownProps {
  text: string
  streaming?: boolean
}

export const Markdown = memo(function Markdown({ text, streaming }: MarkdownProps) {
  return (
    <Streamdown className="prose prose-sm" plugins={{ code }} isAnimating={streaming}>
      {text}
    </Streamdown>
  )
})
