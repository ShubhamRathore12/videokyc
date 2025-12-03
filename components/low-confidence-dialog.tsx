// components/low-confidence-dialog.tsx
"use client"

import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LowConfidenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matchConfidence: number
  lowConfidenceReason: string
  lowConfidenceAttempts: number
  maxLowConfidenceAttempts: number
  isRetrying: boolean
  onTryAgain: () => void
}

export default function LowConfidenceDialog({
  open,
  onOpenChange,
  matchConfidence,
  lowConfidenceReason,
  lowConfidenceAttempts,
  maxLowConfidenceAttempts,
  isRetrying,
  onTryAgain,
}: LowConfidenceDialogProps) {
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // If dialog is being closed by clicking outside or pressing ESC
      onTryAgain()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" />
            Face Match Alert
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-3 pt-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-800">Match Score: {matchConfidence}%</p>
                <p className="text-sm text-red-700 mt-1">
                  Required: <span className="font-semibold">80% or higher</span>
                </p>
                <p className="text-sm text-red-700 mt-2">
                  Attempts: <span className="font-semibold">{lowConfidenceAttempts + 1}/{maxLowConfidenceAttempts}</span>
                </p>
              </div>
              
              <p className="text-sm text-gray-700">
                {lowConfidenceReason}
              </p>
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-medium text-blue-800 mb-1">Tips:</p>
                <ul className="text-sm text-blue-700 list-disc pl-4 space-y-1">
                  <li>Ensure you're the registered user</li>
                  <li>Face the camera directly</li>
                  <li>Make sure only one person is in frame</li>
                </ul>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="destructive"
            onClick={onTryAgain}
            className="w-full"
            disabled={isRetrying}
          >
            {isRetrying ? "Resetting..." : `Try Again (${lowConfidenceAttempts + 1}/${maxLowConfidenceAttempts})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}