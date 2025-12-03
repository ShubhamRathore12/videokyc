// components/blocked-dialog.tsx
"use client";

import { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export default function BlockedDialog({
  open,
  onOpenChange,
  onClose,
}: BlockedDialogProps) {
  useEffect(() => {
    if (open) {
      // Disable browser back button when dialog is open
      const disableBackButton = () => {
        window.history.pushState(null, "", window.location.href);
      };

      // Push initial state
      window.history.pushState(null, "", window.location.href);

      // Listen for back button and prevent navigation
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, "", window.location.href);
      };

      window.addEventListener("popstate", handlePopState);

      // Prevent user from leaving the page
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "";
        return "";
      };

      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogContent
        className="sm:max-w-sm" // Smaller dialog width
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* CLOSE BUTTON - Added */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-30"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 justify-center">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-lg">Face Mismatch Detected</span>
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-3 pt-4">
              {/* Main Alert - Simplified */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800 mb-1">
                      Profile Picture Doesn't Match
                    </p>
                    <p className="text-sm text-red-700">
                      Your face doesn't match the registered profile picture.
                      This could be due to:
                    </p>
                    <ul className="text-xs text-red-600 mt-2 space-y-1 pl-2">
                      <li>• Outdated profile picture</li>
                      <li>• Poor lighting conditions</li>
                      <li>• Face not properly positioned</li>
                      <li>• Significant appearance changes</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Simple Next Steps */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold text-blue-900 mb-2 text-sm">
                  What to do next:
                </p>
                <div className="space-y-2 text-xs text-blue-800">
                  <p>1. Update your profile picture if it's outdated</p>
                  <p>2. Ensure proper lighting and camera setup</p>
                  <p>3. Try again with better conditions</p>
                  <p className="text-xs text-blue-600 mt-2">
                    Contact support if you need assistance
                  </p>
                </div>
              </div>

              {/* Contact Support - Simplified */}
              <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <p className="text-xs text-gray-600">
                  Need help? 📧 support@example.com
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
