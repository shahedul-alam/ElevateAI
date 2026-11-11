import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Permanent delete: the admin must type the user's email. Same pending rules as ConfirmDialog. */
export function DeleteUserDialog({
  open,
  onOpenChange,
  name,
  email,
  role,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  email: string
  role: string
  pending: boolean
  onConfirm: (confirmEmail: string) => void
}) {
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === email.toLowerCase()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        if (!next) setTyped('')
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name} permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. Their account, sessions, notifications and AI results are deleted
            {role === 'candidate'
              ? ', along with their resume versions and applications.'
              : ', along with their company page, their jobs and every application to those jobs (other candidates lose them too).'}{' '}
            The action is recorded in the audit log. To keep the data, suspend instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-confirm-email">Type {email} to confirm</Label>
          <Input
            id="delete-confirm-email"
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || !matches}
            onClick={(e) => {
              e.preventDefault()
              onConfirm(typed.trim())
            }}
          >
            {pending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
