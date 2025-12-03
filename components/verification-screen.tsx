"use client";

import { useState, useEffect, useRef } from "react";
import { CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  X,
  AlertCircle,
  CheckCircle,
  UserX,
  Loader2,
  Mic,
} from "lucide-react";
import { toast } from "sonner";
import {
  isMediaPipeReady,
  detectMultipleFacesMediaPipe,
  detectHandOnFaceMediaPipe,
  realTimeFaceMatching,
} from "@/lib/face-detection";
import VideoRecorder from "./video-recorder";
import LowConfidenceDialog from "./low-confidence-dialog";
import BlockedDialog from "./blocked-dialog";

interface VerificationScreenProps {
  onBack: () => void;
  onClose: () => void;
  onComplete: () => void;
  profileDescriptor: Float32Array | null;
  isInitialized: boolean;
  isInitializing: boolean;
  userId: string;
  API_BASE: string;
}

interface RecordingPrompt {
  type: string;
  text: string;
  duration: number;
}

export default function VerificationScreen({
  onBack,
  onClose,
  onComplete,
  profileDescriptor,
  isInitialized,
  isInitializing,
  userId,
  API_BASE,
}: VerificationScreenProps) {
  const [faceStatus, setFaceStatus] = useState("Loading...");
  const [faceStatusType, setFaceStatusType] = useState<
    "loading" | "detected" | "not-detected" | "partial" | "no-face"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [matchConfidence, setMatchConfidence] = useState(0);
  const [currentModel, setCurrentModel] = useState("Initializing...");
  const [hasMultipleFaces, setHasMultipleFaces] = useState(false);
  const [hasHandOnFace, setHasHandOnFace] = useState(false);
  const [noFaceDetected, setNoFaceDetected] = useState(false);
  const [matchingComplete, setMatchingComplete] = useState(false);
  const [highConfidenceFrames, setHighConfidenceFrames] = useState(0);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [allRecordingsComplete, setAllRecordingsComplete] = useState(false);
  const [otpErrorOccurred, setOtpErrorOccurred] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [maxAttemptsPerOtp] = useState(2);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [showLowConfidenceDialog, setShowLowConfidenceDialog] = useState(false);
  const [lowConfidenceReason, setLowConfidenceReason] = useState("");
  const [lowConfidenceAttempts, setLowConfidenceAttempts] = useState(0);
  const [userBlocked, setUserBlocked] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isProcessingOtp, setIsProcessingOtp] = useState(false);

  // New states for recording control
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const safetyCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const faceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const highConfidenceFramesRef = useRef(0);
  const wasInterruptedRef = useRef(false);
  const shouldStopProfileMatchingRef = useRef(false);
  const toastIdRef = useRef<string | number | null>(null);
  const noFaceFramesRef = useRef(0);
  const lastFaceConfidenceRef = useRef(0);
  const lowConfidenceFramesRef = useRef(0);
  const dialogOpenRef = useRef(false);
  const dialogClosingRef = useRef(false);
  const maxLowConfidenceAttempts = 3;
  const stableVerificationFramesRef = useRef(0); // Track stable verification frames
  const verificationCompleteRef = useRef(false); // Track if verification is truly complete

  const videoRecorderRef = useRef<{ startRecording: () => void } | null>(null);

  const prompts: RecordingPrompt[] = [
    { type: "otp", text: "1 - 2 - 3 - 4", duration: 4 },
  ];

  const backupPrompts: RecordingPrompt[] = [
    { type: "otp", text: "5 - 6 - 7 - 8", duration: 4 },
    { type: "otp", text: "9 - 0 - 1 - 2", duration: 4 },
  ];

  useEffect(() => {
    dialogOpenRef.current = showLowConfidenceDialog;
  }, [showLowConfidenceDialog]);

  const showToast = (
    message: string,
    type: "info" | "success" | "error" = "info"
  ) => {
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    toastIdRef.current = toast[type](message, {
      duration: 2000,
    });
  };

  useEffect(() => {
    initializeVerification();

    return () => {
      cleanup();
    };
  }, []);

  const handleLowConfidenceTryAgain = () => {
    setIsRetrying(true);
    dialogClosingRef.current = true;

    const newAttempt = lowConfidenceAttempts + 1;
    setLowConfidenceAttempts(newAttempt);

    if (newAttempt >= maxLowConfidenceAttempts) {
      setUserBlocked(true);
      setShowBlockedDialog(true);
      cleanup();
      setShowLowConfidenceDialog(false);
      dialogOpenRef.current = false;
      dialogClosingRef.current = false;
      setIsRetrying(false);
      return;
    }

    setShowLowConfidenceDialog(false);
    dialogOpenRef.current = false;

    resetVerificationState();

    setTimeout(() => {
      restartVerification();

      showToast(
        `Attempt ${newAttempt}/${maxLowConfidenceAttempts}. Please position your face properly.`,
        "info"
      );

      dialogClosingRef.current = false;
      setIsRetrying(false);
    }, 300);
  };

  const resetVerificationState = () => {
    lowConfidenceFramesRef.current = 0;
    shouldStopProfileMatchingRef.current = false;
    setMatchingComplete(false);
    setHighConfidenceFrames(0);
    highConfidenceFramesRef.current = 0;
    stableVerificationFramesRef.current = 0;
    verificationCompleteRef.current = false;
    setMatchConfidence(0);
    setFaceStatusType("not-detected");
    setFaceStatus("Adjust Position");
    setHasMultipleFaces(false);
    setHasHandOnFace(false);
    setNoFaceDetected(false);
    setWasInterrupted(false);
    wasInterruptedRef.current = false;
  };

  const restartVerification = () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      if (!safetyCheckIntervalRef.current) {
        safetyCheckIntervalRef.current = setInterval(async () => {
          await performSafetyCheck();
        }, 300);
      }

      if (!detectionIntervalRef.current && isInitialized && profileDescriptor) {
        detectionIntervalRef.current = setInterval(async () => {
          await performFaceDetection();
        }, 500);
      }

      if (!faceCheckIntervalRef.current) {
        faceCheckIntervalRef.current = setInterval(async () => {
          await checkFacePresence();
        }, 500);
      }
    } else {
      try {
        startCamera();
      } catch (error) {
        setErrorMessage("Failed to restart camera. Please refresh the page.");
        setShowError(true);
      }
    }
  };

  const handleBlockedClose = () => {
    setShowBlockedDialog(false);
    onClose();
  };

  const initializeVerification = async () => {
    try {
      setCameraLoading(true);
      await startCamera();
    } catch (error) {
      setErrorMessage("Failed to initialize verification");
      setShowError(true);
      showToast("Failed to initialize verification", "error");
    } finally {
      setCameraLoading(false);
    }
  };

  const cleanup = () => {
    stopAllIntervals();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  const stopAllIntervals = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (safetyCheckIntervalRef.current) {
      clearInterval(safetyCheckIntervalRef.current);
      safetyCheckIntervalRef.current = null;
    }
    if (faceCheckIntervalRef.current) {
      clearInterval(faceCheckIntervalRef.current);
      faceCheckIntervalRef.current = null;
    }
  };

  const stopFaceDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
      console.log("Face detection stopped - verification complete");
    }
  };

  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });

        try {
          await videoRef.current.play();
        } catch (playError) {
          // Silent catch for play errors
        }

        startSafetyChecks();
        startFaceDetection();
        startFacePresenceCheck();
      }
    } catch (err) {
      setErrorMessage("Camera access denied. Please allow camera permissions.");
      setShowError(true);
      showToast("Camera access denied", "error");
      throw err;
    }
  };

  const startFaceDetection = () => {
    if (
      !detectionIntervalRef.current &&
      isInitialized &&
      profileDescriptor &&
      !verificationCompleteRef.current
    ) {
      detectionIntervalRef.current = setInterval(async () => {
        await performFaceDetection();
      }, 500);
    }
  };

  const startSafetyChecks = () => {
    if (!safetyCheckIntervalRef.current) {
      safetyCheckIntervalRef.current = setInterval(async () => {
        await performSafetyCheck();
      }, 300);
    }
  };

  const startFacePresenceCheck = () => {
    if (!faceCheckIntervalRef.current) {
      faceCheckIntervalRef.current = setInterval(async () => {
        await checkFacePresence();
      }, 500);
    }
  };

  const checkFacePresence = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;

    try {
      if (window.faceapi) {
        const faceDetections = await window.faceapi.detectAllFaces(
          videoRef.current,
          new window.faceapi.TinyFaceDetectorOptions({
            scoreThreshold: 0.3,
            maxResults: 1,
          })
        );

        const hasFace = faceDetections.length > 0;

        if (!hasFace) {
          noFaceFramesRef.current++;

          if (noFaceFramesRef.current >= 3) {
            setNoFaceDetected(true);

            if (verificationCompleteRef.current) {
              // If verification was complete but face left, reset verification
              console.log("Face left after verification - resetting");
              resetVerificationState();
              startFaceDetection();
            }

            setFaceStatusType("no-face");
            setFaceStatus("No Face Detected");
            showToast("Please position your face in frame", "error");
          }
        } else {
          noFaceFramesRef.current = 0;
          setNoFaceDetected(false);

          if (faceStatusType === "no-face") {
            setFaceStatusType("not-detected");
            setFaceStatus("Adjust Position");
            showToast("Face detected, please position properly", "info");
          }
        }
      }
    } catch (error) {
      // Silent catch for face presence check errors
    }
  };

  const performSafetyCheck = async () => {
    if (
      !isMediaPipeReady() ||
      !videoRef.current ||
      videoRef.current.readyState < 2
    )
      return;

    try {
      const [multipleFaces, handOnFace] = await Promise.all([
        detectMultipleFacesMediaPipe(videoRef.current),
        detectHandOnFaceMediaPipe(videoRef.current),
      ]);

      setHasMultipleFaces(multipleFaces);
      setHasHandOnFace(handOnFace);

      if (multipleFaces || handOnFace) {
        setFaceStatusType("not-detected");

        if (multipleFaces) {
          setFaceStatus("Multiple Faces");
          showToast("Only one person should be in frame", "error");
        } else if (handOnFace) {
          setFaceStatus("Hand on Face");
          showToast("Keep hands away from your face", "error");
        }

        // If verification was complete but issues detected, reset
        if (verificationCompleteRef.current) {
          console.log("Safety issue detected after verification - resetting");
          resetVerificationState();
          startFaceDetection();
        } else {
          shouldStopProfileMatchingRef.current = true;
        }

        wasInterruptedRef.current = true;
        setWasInterrupted(true);
      } else {
        if (wasInterruptedRef.current) {
          wasInterruptedRef.current = false;
          setWasInterrupted(false);
          setFaceStatus("Adjust Position");
          showToast("Position your face in the circle", "info");

          if (
            !detectionIntervalRef.current &&
            !verificationCompleteRef.current
          ) {
            startFaceDetection();
          }
        }
      }
    } catch (error) {
      // Silent catch for safety check errors
    }
  };

  const performFaceDetection = async () => {
    if (userBlocked || showBlockedDialog || isRetrying) {
      return;
    }

    if (dialogOpenRef.current || dialogClosingRef.current) {
      return;
    }

    if (
      !videoRef.current ||
      !profileDescriptor ||
      !isInitialized ||
      videoRef.current.readyState < 2
    ) {
      return;
    }

    try {
      if (noFaceDetected) {
        return;
      }

      // If verification is already complete, don't run face detection
      if (verificationCompleteRef.current) {
        return;
      }

      if (!hasMultipleFaces && !hasHandOnFace && !wasInterruptedRef.current) {
        const result = await realTimeFaceMatching(
          videoRef.current,
          profileDescriptor
        );

        setMatchConfidence(result.confidence);
        lastFaceConfidenceRef.current = result.confidence;
        setCurrentModel(result.modelUsed);

        if (result.confidence < 50 && result.confidence > 5) {
          lowConfidenceFramesRef.current++;

          if (lowConfidenceFramesRef.current >= 2) {
            if (!dialogOpenRef.current && !userBlocked) {
              setLowConfidenceReason(getLowConfidenceReason(result.confidence));
              setShowLowConfidenceDialog(true);
              dialogOpenRef.current = true;
              stopAllIntervals();
              return;
            }
          }
        } else {
          lowConfidenceFramesRef.current = 0;
        }

        if (result.confidence >= 80) {
          // Increment high confidence frames
          if (highConfidenceFramesRef.current < 3) {
            highConfidenceFramesRef.current++;
            setHighConfidenceFrames(highConfidenceFramesRef.current);

            // Show "Ready to record OTP" message when first reaching high confidence
            if (highConfidenceFramesRef.current === 1) {
              showToast("Ready to record OTP", "success");
            }
          }

          // Always show as detected when confidence is high
          setFaceStatusType("detected");
          setFaceStatus(`Verified ✓ (${result.confidence}%)`);

          // When we reach exactly 3 frames, trigger matching complete
          if (highConfidenceFramesRef.current >= 3) {
            // Start counting stable frames
            stableVerificationFramesRef.current++;

            // After 2 stable frames (total of 5 frames with high confidence), complete verification
            if (stableVerificationFramesRef.current >= 2) {
              completeVerification();
            }
          } else {
            // Reset stable frames if not at 3 high confidence frames yet
            stableVerificationFramesRef.current = 0;
          }
        } else if (result.confidence < 60) {
          // Reset everything if confidence drops very low
          resetVerificationProgress();
          setFaceStatusType("not-detected");
          setFaceStatus("Adjust Position");
        } else {
          // Confidence between 60-80% - keep progress but don't advance
          setFaceStatusType("detected");
          setFaceStatus(`Verified ✓ (${result.confidence}%)`);
          stableVerificationFramesRef.current = 0; // Reset stable frames
        }
      } else {
        // If interrupted, reset progress
        resetVerificationProgress();
      }
    } catch (err) {
      console.error("Face detection error:", err);
    }
  };

  const completeVerification = () => {
    setMatchingComplete(true);
    shouldStopProfileMatchingRef.current = true;
    verificationCompleteRef.current = true;

    // Stop face detection - verification is complete!
    stopFaceDetection();

    // Ensure we show exactly 3/3
    setHighConfidenceFrames(3);
    highConfidenceFramesRef.current = 3;

    showToast(
      "Face verified successfully! Click Start to record OTP",
      "success"
    );
    console.log(
      "✅ Face verification complete - Start button should stay visible"
    );
  };

  const resetVerificationProgress = () => {
    // Only reset if verification wasn't already completed
    if (!verificationCompleteRef.current) {
      highConfidenceFramesRef.current = 0;
      setHighConfidenceFrames(0);
      stableVerificationFramesRef.current = 0;
      shouldStopProfileMatchingRef.current = false;
    }
  };

  const getLowConfidenceReason = (confidence: number): string => {
    if (confidence < 20) {
      return "The face doesn't match your profile picture. Please ensure you're the correct person.";
    } else if (confidence < 35) {
      return "Very low similarity with your profile picture.";
    } else {
      return "Low similarity detected with your profile picture.";
    }
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setIsUploading(false);
    setIsProcessingOtp(false); // Reset processing state
    videoRecorderRef.current?.startRecording();
  };

  const handleRecordingComplete = () => {
    setIsRecording(false);
    setIsUploading(true);
    setIsProcessingOtp(true); // Mark as processing
    setAllRecordingsComplete(true);
    showToast("Verification successful", "success");

    cleanup();

    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  const handleRecordingError = () => {
    setIsRecording(false);
    setIsUploading(false);
    setIsProcessingOtp(false); // Reset processing
    setOtpErrorOccurred(true);
    const newAttempt = currentAttempt + 1;
    setCurrentAttempt(newAttempt);

    if (newAttempt >= maxAttemptsPerOtp) {
      if (currentPromptIndex < backupPrompts.length) {
        showToast("Using backup OTP", "info");
        setTimeout(() => {
          setCurrentPromptIndex((prev) => prev + 1);
          setCurrentAttempt(0);
          setOtpErrorOccurred(false);
        }, 1500);
      } else {
        setAllRecordingsComplete(true);
        showToast("Verification completed", "success");
        cleanup();
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } else {
      showToast(`Attempt ${newAttempt + 1}/${maxAttemptsPerOtp}`, "info");
      setTimeout(() => {
        setOtpErrorOccurred(false);
      }, 1500);
    }
  };

  const getVideoBorderClass = () => {
    if (hasMultipleFaces || hasHandOnFace || noFaceDetected)
      return "border-red-500";
    if (faceStatusType === "detected") return "border-green-500";
    if (faceStatusType === "not-detected") return "border-red-500";
    if (faceStatusType === "no-face") return "border-red-500";
    return "border-gray-300";
  };

  const getStatusBadgeClass = () => {
    if (hasMultipleFaces || hasHandOnFace || noFaceDetected || errorMessage)
      return "bg-red-500 text-white";
    if (faceStatusType === "detected") return "bg-green-500 text-white";
    return "bg-blue-500 text-white";
  };

  const getStatusText = () => {
    if (errorMessage) return errorMessage;
    if (hasMultipleFaces) return "Multiple Faces Detected";
    if (hasHandOnFace) return "Hand on Face Detected";
    if (noFaceDetected) return "No Face Detected";
    return faceStatus;
  };

  const isRecordingReady = () => {
    return (
      matchingComplete &&
      !hasMultipleFaces &&
      !hasHandOnFace &&
      !noFaceDetected &&
      !wasInterrupted &&
      !otpErrorOccurred &&
      !errorMessage &&
      !showLowConfidenceDialog &&
      !userBlocked &&
      !isRetrying &&
      verificationCompleteRef.current &&
      !isRecording &&
      !isUploading &&
      !isProcessingOtp && // Add this condition
      !allRecordingsComplete // Add this condition
    );
  };
  const getCurrentPrompt = () => {
    if (currentPromptIndex === 0) {
      return prompts[0];
    } else {
      return backupPrompts[currentPromptIndex - 1];
    }
  };

  const currentPrompt = getCurrentPrompt();

  return (
    <>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            disabled={userBlocked || isRecording || isUploading}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold text-center flex-1">
            OTP Verification
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={userBlocked || isRecording || isUploading}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {userBlocked ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <div className="h-6 w-6 text-red-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-bold text-red-700 mb-2">
              Verification Blocked
            </h3>
            <p className="text-red-600 mb-4">
              Too many failed attempts. Please contact support for assistance.
            </p>
            <Button
              variant="outline"
              onClick={handleBlockedClose}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="relative w-64 h-64">
                {(isInitializing || cameraLoading) && (
                  <div className="absolute inset-0 bg-gray-200 rounded-full flex flex-col items-center justify-center z-10 animate-pulse">
                    <div className="w-12 h-12 bg-gray-300 rounded-full mb-2"></div>
                    <div className="h-4 bg-gray-300 rounded w-24"></div>
                  </div>
                )}

                <div
                  className={`w-full h-full rounded-full border-4 overflow-hidden relative transition-all duration-300 ${getVideoBorderClass()} ${
                    faceStatusType === "detected"
                      ? "shadow-lg shadow-green-500/20"
                      : ""
                  }`}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  <div
                    className={`absolute top-3 left-1/2 transform -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm max-w-[90%] text-center ${getStatusBadgeClass()}`}
                  >
                    <div className="flex items-center gap-1.5 justify-center">
                      {hasMultipleFaces && (
                        <AlertCircle className="h-3 w-3 shrink-0" />
                      )}
                      {hasHandOnFace && (
                        <AlertCircle className="h-3 w-3 shrink-0" />
                      )}
                      {noFaceDetected && <UserX className="h-3 w-3 shrink-0" />}
                      {faceStatusType === "detected" && !errorMessage && (
                        <CheckCircle className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{getStatusText()}</span>
                    </div>
                  </div>

                  {!errorMessage &&
                    !noFaceDetected &&
                    !showLowConfidenceDialog && (
                      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full text-xs font-medium bg-black/70 text-white backdrop-blur-sm">
                        {matchConfidence}% match
                      </div>
                    )}
                </div>
              </div>
            </div>

            {!matchingComplete &&
              !errorMessage &&
              !noFaceDetected &&
              !showLowConfidenceDialog && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-blue-800 text-sm">
                      Face Verification
                    </span>
                    <span className="text-xs text-blue-600">
                      {Math.min(highConfidenceFrames, 3)}/3
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          (highConfidenceFrames / 3) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

            {noFaceDetected && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-600 shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 text-sm">
                      No Face Detected
                    </p>
                    <p className="text-xs text-red-700">
                      Please position your face in the frame
                    </p>
                  </div>
                </div>
              </div>
            )}

            {matchingComplete &&
              !noFaceDetected &&
              !showLowConfidenceDialog &&
              verificationCompleteRef.current && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg animate-in fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <div>
                        <p className="font-medium text-green-800 text-sm">
                          Face Verified
                        </p>
                        <p className="text-xs text-green-700">
                          {isRecording
                            ? "Recording in progress..."
                            : isUploading
                            ? "Processing verification..."
                            : "Ready to record OTP"}
                        </p>
                      </div>
                    </div>

                    {isRecording ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full animate-pulse">
                        <Mic className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Recording...
                        </span>
                      </div>
                    ) : isUploading ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">
                          Processing...
                        </span>
                      </div>
                    ) : (
                      !allRecordingsComplete && (
                        <Button
                          onClick={handleRecordingStart}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                          disabled={!isRecordingReady()}
                        >
                          Start Recording
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}

            <VideoRecorder
              ref={videoRecorderRef}
              mediaStream={mediaStreamRef.current}
              userId={userId}
              API_BASE={API_BASE}
              prompts={[currentPrompt]}
              currentPromptIndex={0}
              onPromptComplete={handleRecordingComplete}
              onPromptError={handleRecordingError}
              isReady={isRecordingReady()}
              faceDetected={faceStatusType === "detected"}
              handDetected={hasHandOnFace}
              onError={setErrorMessage}
              hideStartButton={matchingComplete}
              isRecording={isRecording}
              onRecordingStateChange={setIsRecording}
              onUploadStateChange={setIsUploading}
              onProcessingStateChange={setIsProcessingOtp} // Add this prop
            />
          </>
        )}
      </CardContent>

      <CardFooter className="flex flex-col space-y-3 pt-4">
        <div className="text-gray-500 text-xs flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
          powered by Shubham
        </div>
      </CardFooter>

      {/* Low Confidence Dialog */}
      <LowConfidenceDialog
        open={showLowConfidenceDialog}
        onOpenChange={setShowLowConfidenceDialog}
        matchConfidence={matchConfidence}
        lowConfidenceReason={lowConfidenceReason}
        lowConfidenceAttempts={lowConfidenceAttempts}
        maxLowConfidenceAttempts={maxLowConfidenceAttempts}
        isRetrying={isRetrying}
        onTryAgain={handleLowConfidenceTryAgain}
      />

      {/* Blocked Dialog */}
      <BlockedDialog
        open={showBlockedDialog}
        onOpenChange={setShowBlockedDialog}
        onClose={handleBlockedClose}
      />
    </>
  );
}
