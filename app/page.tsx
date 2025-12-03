// page.tsx (Updated with user ID input screen)
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { API_BASE } from "@/lib/config";
import { Loader2 } from "lucide-react";

// Import components
import UserIdScreen from "@/components/user-id-screen";
import VerificationScreen from "@/components/verification-screen";
import SuccessScreen from "@/components/success-screen";

// Import face detection functions
import { initializeFaceApi } from "@/lib/face-detection";

export default function VideoVerification() {
  const [currentScreen, setCurrentScreen] = useState<
    "user-id" | "loading" | "verify" | "success"
  >("user-id");
  const [userId, setUserId] = useState<string>("");
  const [userIdError, setUserIdError] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [profileDescriptor, setProfileDescriptor] =
    useState<Float32Array | null>(null);
  const [error, setError] = useState<string>("");

  // Initialize face detection on mount
  useEffect(() => {
    const initFaceDetection = async () => {
      setIsInitializing(true);
      try {
        const success = await initializeFaceApi();
        setIsInitialized(success);
      } catch (err) {
        console.error("Failed to initialize face detection:", err);
        setError(
          "Failed to initialize face detection. Please refresh the page."
        );
      } finally {
        setIsInitializing(false);
      }
    };

    initFaceDetection();
  }, []);

  const handleVerifyUser = async () => {
    // Validate user ID
    if (!userId.trim()) {
      setUserIdError("Please enter a User ID");
      return;
    }

    if (userId.length < 3) {
      setUserIdError("User ID must be at least 3 characters");
      return;
    }

    setUserIdError("");
    setCurrentScreen("loading");

    try {
      await fetchUserData(userId.trim());
    } catch (err: any) {
      console.error("Failed to fetch user:", err);
      setError(err.message || "Failed to load user data");
      setCurrentScreen("user-id");
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/users/${userId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "User not found");
      }
      const userData = await response.json();
      setCurrentUser(userData.data);

      // Check if user is already verified
      if (
        userData.data?.videoKycStatus === "verified" ||
        userData.data?.isVerified === true
      ) {
        console.log("User is already verified, showing success screen");
        setCurrentScreen("success");
        return;
      }

      // Load profile picture and get descriptor
      if (userData.data?.profilePic) {
        await loadProfileDescriptor(userData.data.profilePic);
      }

      // Move to verification screen
      setCurrentScreen("verify");
    } catch (error: any) {
      console.error("Failed to fetch user:", error);
      throw error;
    }
  };

  const loadProfileDescriptor = async (profilePicPath: string) => {
    try {
      const imageUrl = `${API_BASE}/users/files/${profilePicPath}`;

      const response = await fetch(imageUrl, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        headers: { Accept: "image/jpeg,image/png,image/*" },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load profile picture: HTTP ${response.status}`
        );
      }

      const blob = await response.blob();

      // Compute face descriptor
      const { getFaceDescriptor, isFaceApiReady } = await import(
        "@/lib/face-detection"
      );

      if (!isFaceApiReady()) {
        console.warn("Face API not ready for descriptor computation");
        return;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = URL.createObjectURL(blob);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const descriptor = await getFaceDescriptor(img);

      // Clean up the temporary object URL
      URL.revokeObjectURL(img.src);

      setProfileDescriptor(descriptor);
      console.log("Profile descriptor loaded successfully:", !!descriptor);
    } catch (error) {
      console.error("Error loading profile descriptor:", error);
    }
  };

  const handleClose = () => {
    // Reset to user ID screen
    setCurrentScreen("user-id");
    setUserId("");
    setUserIdError("");
    setCurrentUser(null);
    setProfileDescriptor(null);
    setError("");
  };

  const handleVerificationComplete = () => {
    // Show success screen when verification is complete
    setCurrentScreen("success");
  };

  const handleSuccessComplete = () => {
    // Reset to user ID screen
    handleClose();
  };

  return (
    <>
      {/* Success Screen (Fullscreen Overlay) */}
      {currentScreen === "success" && (
        <SuccessScreen
          onComplete={handleSuccessComplete}
          userName={currentUser?.name || currentUser?.userId || "User"}
          isAlreadyVerified={
            currentUser?.videoKycStatus === "verified" ||
            currentUser?.isVerified === true
          }
        />
      )}

      {/* Main Content */}
      <div
        className={`min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4 ${
          currentScreen === "success" ? "hidden" : ""
        }`}
      >
        <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          {/* User ID Screen */}
          {currentScreen === "user-id" && (
            <UserIdScreen
              userId={userId}
              setUserId={setUserId}
              userIdError={userIdError}
              isLoading={isInitializing}
              onVerifyUser={handleVerifyUser}
              onClose={handleClose}
            />
          )}

          {/* Loading Screen */}
          {currentScreen === "loading" && (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              {error ? (
                <>
                  <div className="text-red-500 text-center">
                    <p className="font-semibold mb-2">Error</p>
                    <p className="text-sm">{error}</p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Go Back
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                  <p className="text-gray-600 font-medium">
                    Loading user data...
                  </p>
                </>
              )}
            </div>
          )}

          {/* Verification Screen */}
          {currentScreen === "verify" && currentUser && (
            <VerificationScreen
              onBack={handleClose}
              onClose={handleClose}
              onComplete={handleVerificationComplete}
              profileDescriptor={profileDescriptor}
              isInitialized={isInitialized}
              isInitializing={isInitializing}
              API_BASE={API_BASE}
              userId={userId}
            />
          )}
        </Card>
      </div>
    </>
  );
}
