import { Bell, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AppNotification } from './notifications.api'
import {
  useClearNotifications,
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from './use-notifications'

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

function timeAgo(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, ms] of UNITS) if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit)
  return 'just now'
}

// The server builds links, but only follow a plain in-app path anyway.
const isInternal = (link: string) => link.startsWith('/') && !link.startsWith('//')

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const navigate = useNavigate()
  const count = useUnreadCount()
  const list = useNotifications(open)
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const remove = useDeleteNotification()
  const clear = useClearNotifications()
  const unread = count.data ?? 0
  const items = list.data?.pages.flatMap((p) => p.notifications) ?? []

  const openItem = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id)
    if (isInternal(n.link)) navigate(n.link)
  }

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications, ${unread} unread`}
        >
          <Bell />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-medium text-white"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          <span className="flex gap-3">
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-normal underline disabled:opacity-50"
                disabled={markAll.isPending}
                onClick={() => markAll.mutate(undefined)}
              >
                Mark all as read
              </button>
            )}
            {items.length > 0 && (
              <button
                type="button"
                className="text-xs font-normal underline"
                onClick={() => {
                  // The dialog lives outside the menu, so close the menu first.
                  setOpen(false)
                  setConfirmingClear(true)
                }}
              >
                Clear all
              </button>
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.isPending ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading...</p>
        ) : list.isError ? (
          <p className="px-2 py-3 text-sm text-destructive">Could not load notifications.</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} className="items-start gap-2" onSelect={() => openItem(n)}>
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-primary'}`}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={n.readAt ? 'text-sm' : 'text-sm font-medium'}>
                  {n.title}
                  {!n.readAt && <span className="sr-only"> (unread)</span>}
                </span>
                <span className="text-xs text-muted-foreground">{n.body}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </span>
              <button
                type="button"
                aria-label="Delete notification"
                className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={(e) => {
                  // Do not trigger the item's select (mark read and navigate).
                  e.stopPropagation()
                  e.preventDefault()
                  remove.mutate(n.id)
                }}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </DropdownMenuItem>
          ))
        )}
        {list.hasNextPage && (
          <DropdownMenuItem
            disabled={list.isFetchingNextPage}
            // Keep the menu open while the next page loads.
            onSelect={(e) => {
              e.preventDefault()
              list.fetchNextPage()
            }}
          >
            {list.isFetchingNextPage ? 'Loading...' : 'Load more'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmDialog
      open={confirmingClear}
      onOpenChange={setConfirmingClear}
      title="Delete all notifications?"
      description="This removes every notification in your inbox and cannot be undone."
      confirmLabel="Delete all"
      pendingLabel="Deleting..."
      pending={clear.isPending}
      destructive
      onConfirm={() => clear.mutate(undefined, { onSettled: () => setConfirmingClear(false) })}
    />
    </>
  )
}
