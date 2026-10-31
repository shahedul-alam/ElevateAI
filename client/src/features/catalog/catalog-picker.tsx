import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { searchCatalog, type CatalogKind, type CatalogTerm } from './catalog.api'

type Props = {
  kind: CatalogKind
  placeholder: string
  excludeIds: string[]
  onSelect: (term: CatalogTerm) => void
  /** When set, text with no catalog match can be kept as an unscored entry. */
  onFreeText?: (text: string) => void
  id?: string
}

export function CatalogPicker({ kind, placeholder, excludeIds, onSelect, onFreeText, id }: Props) {
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 200)
    return () => clearTimeout(t)
  }, [text])

  const { data } = useQuery({
    queryKey: ['catalog', kind, debounced],
    queryFn: () => searchCatalog(kind, debounced),
    enabled: open,
    staleTime: 60_000,
  })
  const options = (data ?? []).filter((t) => !excludeIds.includes(t.id))
  const trimmed = text.trim()
  const showFreeText = !!onFreeText && trimmed.length > 0 && options.length === 0

  const reset = () => {
    setText('')
    setDebounced('')
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && (options.length > 0 || showFreeText) && (
        // mousedown (not click) so the input's blur does not close the list before the pick lands.
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md">
          {options.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(t)
                  reset()
                }}
              >
                {t.name}
              </button>
            </li>
          ))}
          {showFreeText && (
            <li>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onFreeText(trimmed)
                  reset()
                }}
              >
                Add “{trimmed}” as an other skill (not scored)
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
