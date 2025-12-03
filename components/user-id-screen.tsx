// components/user-id-screen.tsx
"use client";

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface UserIdScreenProps {
  userId: string;
  setUserId: (userId: string) => void;
  userIdError: string;
  isLoading: boolean;
  onVerifyUser: () => void;
  onClose: () => void;
}

export default function UserIdScreen({
  userId,
  setUserId,
  userIdError,
  isLoading,
  onVerifyUser,
  onClose
}: UserIdScreenProps) {
  return (
    <>
      <CardHeader className="text-center pb-2">
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Enter Your User ID</h2>
        <p className="text-gray-600 text-sm">
          Please enter your User ID to continue verification
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter your User ID"
            maxLength={50}
            className="h-12 text-base"
            onKeyPress={(e) => e.key === 'Enter' && onVerifyUser()}
          />
        </div>
        
        <Button
          onClick={onVerifyUser}
          disabled={isLoading}
          className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Continue'
          )}
        </Button>

        {userIdError && (
          <Alert variant="destructive" className="animate-in fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{userIdError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-gray-500 text-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          powered by Shubham
        </div>
      </CardFooter>
    </>
  );
}