"use client";

import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RecordingPrompt {
  type: string;
  text: string;
  duration: number;
}

interface VideoRecorderProps {
  mediaStream: MediaStream | null;
  userId: string;
  API_BASE: string;
  prompts: RecordingPrompt[];
  currentPromptIndex: number;
  onPromptComplete: () => void;
  onPromptError: () => void;
  isReady: boolean;
  faceDetected?: boolean;
  handDetected?: boolean;
  onError?: (message: string) => void;
  hideStartButton?: boolean;
  // Add these new props:
  isRecording?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onUploadStateChange?: (isUploading: boolean) => void;
  onProcessingStateChange?: (isProcessing: boolean) => void; // Add this
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VideoRecorder = forwardRef<
  { startRecording: () => void },
  VideoRecorderProps
>(
  (
    {
      mediaStream,
      userId,
      API_BASE,
      prompts,
      currentPromptIndex,
      onPromptComplete,
      onPromptError,
      isReady,
      faceDetected = true,
      handDetected = false,
      onError,
      hideStartButton = false,
      isRecording = false,
      onRecordingStateChange,
      onUploadStateChange,
      onProcessingStateChange, // Add this
    },
    ref
  ) => {
    const [recordingTime, setRecordingTime] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<
      "idle" | "uploading" | "success" | "error"
    >("idle");
    const [verificationStatus, setVerificationStatus] = useState<
      "pending" | "verified" | "failed"
    >("pending");
    const [verificationMessage, setVerificationMessage] = useState<string>("");
    const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
    const [showPlayback, setShowPlayback] = useState(false);
    const [recognizedText, setRecognizedText] = useState<string>("");
    const [otpVerified, setOtpVerified] = useState<boolean>(false);
    const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] =
      useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [maxAttempts] = useState(3);
    const [showOtpError, setShowOtpError] = useState(false);
    const [error, setError] = useState<string>("");

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const recordingStartTimeRef = useRef<number>(0);
    const speechRecognitionRef = useRef<any>(null);
    const verificationAttemptedRef = useRef(false);
    const otpVerifiedRef = useRef(false);
    const stopRecordingCalledRef = useRef(false);

    const currentPrompt = prompts[currentPromptIndex];
    const isLastPrompt = currentPromptIndex === prompts.length - 1;

    useEffect(() => {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSpeechRecognitionSupported(!!SpeechRecognition);

      return () => {
        cleanup();
      };
    }, []);

    useEffect(() => {
      setOtpVerified(false);
      otpVerifiedRef.current = false;
      setRecognizedText("");
      verificationAttemptedRef.current = false;
      stopRecordingCalledRef.current = false;
      setIsProcessing(false);
      setAttempts(0);
      setShowOtpError(false);
      setError("");
    }, [currentPromptIndex]);

    const cleanup = () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }

      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }

      recordedChunksRef.current = [];
    };

    const startSpeechRecognition = () => {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsSpeechRecognitionSupported(false);
        return;
      }

      try {
        speechRecognitionRef.current = new SpeechRecognition();
        speechRecognitionRef.current.continuous = true;
        speechRecognitionRef.current.interimResults = true;
        speechRecognitionRef.current.lang = "en-US";
        speechRecognitionRef.current.maxAlternatives = 1;

        speechRecognitionRef.current.onresult = (event: any) => {
          let finalTranscript = "";
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            const currentText = finalTranscript.trim().toLowerCase();
            console.log("Speech recognized:", currentText);
            setRecognizedText(currentText);

            if (currentPrompt.type === "otp" && currentText) {
              verifySpokenOTP(currentText);
            }
          } else if (interimTranscript) {
            setRecognizedText(interimTranscript.trim().toLowerCase());
          }
        };

        speechRecognitionRef.current.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          if (event.error === "not-allowed") {
            setIsSpeechRecognitionSupported(false);
          }
        };

        speechRecognitionRef.current.onend = () => {
          // Restart speech recognition if still recording
          if (isRecording && currentPrompt.type === "otp") {
            try {
              speechRecognitionRef.current.start();
            } catch (error) {
              console.warn("Could not restart speech recognition:", error);
            }
          }
        };

        speechRecognitionRef.current.start();
        console.log("Speech recognition started");
      } catch (error) {
        console.warn("Could not start speech recognition:", error);
        setIsSpeechRecognitionSupported(false);
      }
    };

    const verifySpokenOTP = (spokenText: string) => {
      if (currentPrompt.type !== "otp" || verificationAttemptedRef.current)
        return;

      const expected = currentPrompt.text.toLowerCase();
      const recognized = spokenText.toLowerCase();

      const expectedDigits = expected.replace(/\D/g, "");
      const recognizedDigits = recognized.replace(/\D/g, "");

      console.log("OTP Verification:", {
        expected,
        recognized,
        expectedDigits,
        recognizedDigits,
        isMatch: expectedDigits === recognizedDigits,
      });

      if (recognizedDigits.length > 0) {
        verificationAttemptedRef.current = true;

        const isMatch = expectedDigits === recognizedDigits;

        if (isMatch) {
          setOtpVerified(true);
          otpVerifiedRef.current = true;
          setShowOtpError(false);
          console.log("✅ OTP verified successfully!");

          // Notify parent that OTP verification is starting
          if (onProcessingStateChange) {
            onProcessingStateChange(true);
          }

          // Auto-stop recording after successful OTP verification
          setTimeout(() => {
            if (isRecording && !stopRecordingCalledRef.current) {
              console.log("🔄 Auto-stopping recording after OTP verification");
              stopRecordingCalledRef.current = true;
              stopRecording();
            }
          }, 1000);
        } else {
          setOtpVerified(false);
          otpVerifiedRef.current = false;
          setShowOtpError(true);
          console.log("❌ OTP verification failed");

          // Notify parent that OTP verification failed
          if (onProcessingStateChange) {
            onProcessingStateChange(true);
          }

          setTimeout(() => {
            handleOtpVerificationFailed();
          }, 3000);
        }
      } else {
        // No speech detected
        console.log("❌ No speech detected");

        // Notify parent that processing is happening
        if (onProcessingStateChange) {
          onProcessingStateChange(true);
        }
      }
    };

    const handleOtpVerificationFailed = () => {
      if (!stopRecordingCalledRef.current) {
        stopRecordingCalledRef.current = true;
        stopRecording();
      }
      setShowOtpError(false);

      // Increment attempts
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= maxAttempts) {
        // Max attempts reached, move to next prompt
        console.log(
          `Max attempts (${maxAttempts}) reached, moving to next prompt`
        );
        onPromptError();
      }
    };

    const startRecording = async () => {
      if (!mediaStream) {
        setError("No camera stream available");
        return;
      }

      if (!isReady) {
        setError("Face verification not complete");
        return;
      }

      try {
        recordedChunksRef.current = [];
        setShowPlayback(false);
        setRecordedVideo(null);
        setUploadStatus("idle");
        setVerificationStatus("pending");
        setVerificationMessage("");
        setError("");
        setRecognizedText("");
        setOtpVerified(false);
        otpVerifiedRef.current = false;
        setShowOtpError(false);
        verificationAttemptedRef.current = false;
        stopRecordingCalledRef.current = false;
        setIsProcessing(false);

        // Notify parent that recording is starting
        if (onRecordingStateChange) {
          onRecordingStateChange(true);
        }
        if (onUploadStateChange) {
          onUploadStateChange(false);
        }

        // Start real-time speech recognition for OTP prompts
        if (currentPrompt.type === "otp" && isSpeechRecognitionSupported) {
          startSpeechRecognition();
        }

        // Use WebM format for best browser compatibility
        const formats = [
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=vp9,opus",
          "video/webm",
          "video/mp4",
        ];

        let selectedFormat = "video/webm";

        for (const format of formats) {
          if (MediaRecorder.isTypeSupported(format)) {
            selectedFormat = format;
            console.log("Selected recording format:", format);
            break;
          }
        }

        const mediaRecorder = new MediaRecorder(mediaStream, {
          mimeType: selectedFormat,
          videoBitsPerSecond: 2500000,
        });

        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          console.log("🎥 Recording stopped");

          if (speechRecognitionRef.current) {
            speechRecognitionRef.current.stop();
          }

          setIsProcessing(true);

          // Notify parent that processing is starting
          if (onProcessingStateChange) {
            onProcessingStateChange(true);
          }

          if (recordedChunksRef.current.length > 0) {
            const blob = new Blob(recordedChunksRef.current, {
              type: recordedChunksRef.current[0].type,
            });

            setRecordedVideo(blob);

            if (currentPrompt.type === "otp") {
              // Wait for OTP verification to complete
              const waitForVerification = async () => {
                let waitAttempts = 0;
                const maxWaitAttempts = 20;

                while (
                  waitAttempts < maxWaitAttempts &&
                  !otpVerifiedRef.current &&
                  !verificationAttemptedRef.current
                ) {
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  waitAttempts++;
                }

                if (otpVerifiedRef.current) {
                  // OTP verified - upload directly
                  console.log("✅ OTP verified - uploading video directly");
                  setIsProcessing(false);
                  await handleAutoUpload(blob);
                } else if (
                  verificationAttemptedRef.current &&
                  !otpVerifiedRef.current
                ) {
                  const newAttempts = attempts + 1;
                  setAttempts(newAttempts);

                  if (newAttempts >= maxAttempts) {
                    setError(
                      `OTP verification failed after ${maxAttempts} attempts. Moving to next prompt.`
                    );
                    setVerificationStatus("failed");
                    setVerificationMessage(
                      `Maximum attempts reached. Expected: "${
                        currentPrompt.text
                      }", Heard: "${recognizedText || "Nothing detected"}"`
                    );
                    // Notify parent that processing is complete
                    if (onProcessingStateChange) {
                      onProcessingStateChange(false);
                    }
                    // Notify parent that upload failed
                    if (onUploadStateChange) {
                      onUploadStateChange(false);
                    }
                    if (onRecordingStateChange) {
                      onRecordingStateChange(false);
                    }
                    setTimeout(() => {
                      onPromptError();
                    }, 3000);
                  } else {
                    setError(
                      `OTP verification failed. Attempt ${newAttempts}/${maxAttempts}. Please try again.`
                    );
                    setVerificationStatus("failed");
                    setVerificationMessage(
                      `Expected: "${currentPrompt.text}", Heard: "${
                        recognizedText || "Nothing detected"
                      }"`
                    );
                    // Notify parent that processing is complete
                    if (onProcessingStateChange) {
                      onProcessingStateChange(false);
                    }
                    // Notify parent that upload failed
                    if (onUploadStateChange) {
                      onUploadStateChange(false);
                    }
                    if (onRecordingStateChange) {
                      onRecordingStateChange(false);
                    }
                  }
                  setIsProcessing(false);
                } else {
                  const newAttempts = attempts + 1;
                  setAttempts(newAttempts);

                  if (newAttempts >= maxAttempts) {
                    setError(
                      `No OTP detected after ${maxAttempts} attempts. Moving to next prompt.`
                    );
                    setVerificationStatus("failed");
                    setVerificationMessage(
                      "No speech detected. Please speak the OTP clearly."
                    );
                    // Notify parent that processing is complete
                    if (onProcessingStateChange) {
                      onProcessingStateChange(false);
                    }
                    // Notify parent that upload failed
                    if (onUploadStateChange) {
                      onUploadStateChange(false);
                    }
                    if (onRecordingStateChange) {
                      onRecordingStateChange(false);
                    }
                    setTimeout(() => {
                      onPromptError();
                    }, 3000);
                  } else {
                    setError(
                      `No OTP detected. Attempt ${newAttempts}/${maxAttempts}. Please try again.`
                    );
                    setVerificationStatus("failed");
                    setVerificationMessage(
                      "No speech detected. Please speak the OTP clearly."
                    );
                    // Notify parent that processing is complete
                    if (onProcessingStateChange) {
                      onProcessingStateChange(false);
                    }
                    // Notify parent that upload failed
                    if (onUploadStateChange) {
                      onUploadStateChange(false);
                    }
                    if (onRecordingStateChange) {
                      onRecordingStateChange(false);
                    }
                  }
                  setIsProcessing(false);
                }
              };

              waitForVerification();
            } else {
              // For non-OTP prompts, show playback
              setShowPlayback(true);
              setIsProcessing(false);
              // Notify parent that processing is complete
              if (onProcessingStateChange) {
                onProcessingStateChange(false);
              }
            }
          } else {
            setError("No video data recorded");
            setIsProcessing(false);
            // Notify parent that processing is complete
            if (onProcessingStateChange) {
              onProcessingStateChange(false);
            }
            // Notify parent that upload failed
            if (onUploadStateChange) {
              onUploadStateChange(false);
            }
            if (onRecordingStateChange) {
              onRecordingStateChange(false);
            }
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error("MediaRecorder error:", event);
          setError("Recording error occurred");
          // Notify parent that recording failed
          if (onRecordingStateChange) {
            onRecordingStateChange(false);
          }
          if (onUploadStateChange) {
            onUploadStateChange(false);
          }
        };

        recordingStartTimeRef.current = Date.now();
        mediaRecorder.start(1000);
        setRecordingTime(currentPrompt.duration);

        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime((time) => {
            if (time <= 1) {
              if (!stopRecordingCalledRef.current) {
                stopRecordingCalledRef.current = true;
                stopRecording();
              }
              return 0;
            }
            return time - 1;
          });
        }, 1000);
      } catch (error) {
        console.error("Error starting recording:", error);
        setError("Failed to start recording");
        // Notify parent that recording failed
        if (onRecordingStateChange) {
          onRecordingStateChange(false);
        }
        if (onUploadStateChange) {
          onUploadStateChange(false);
        }
      }
    };

    const stopRecording = () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
        // Notify parent that recording stopped
        if (onRecordingStateChange) {
          onRecordingStateChange(false);
        }
      } else {
        // Notify parent that recording stopped
        if (onRecordingStateChange) {
          onRecordingStateChange(false);
        }
      }
    };

    const getRecordingDuration = () => {
      if (!recordingStartTimeRef.current) return currentPrompt.duration;
      return Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
    };

    const handleAutoUpload = async (videoBlob: Blob) => {
      // Notify parent that upload is starting
      if (onUploadStateChange) {
        onUploadStateChange(true);
      }

      setUploadStatus("uploading");
      setVerificationStatus("pending");
      setVerificationMessage("");

      try {
        const result = await uploadAndVerifyVideo(videoBlob, currentPrompt);

        if (result.success) {
          setUploadStatus("success");
          setVerificationStatus("verified");
          setVerificationMessage(result.message);

          // Check if this is the last prompt
          const isLastPrompt = currentPromptIndex === prompts.length - 1;

          if (isLastPrompt) {
            // If it's the last prompt, trigger the full success screen
            console.log(
              "🎉 All OTP prompts completed - showing success screen"
            );
            // Notify parent that processing is complete
            if (onProcessingStateChange) {
              onProcessingStateChange(false);
            }
            // Notify parent that upload is complete
            if (onUploadStateChange) {
              onUploadStateChange(false);
            }
            onPromptComplete();
          } else {
            // If there are more prompts, show brief success and move to next
            setTimeout(() => {
              // Notify parent that processing is complete
              if (onProcessingStateChange) {
                onProcessingStateChange(false);
              }
              // Notify parent that upload is complete
              if (onUploadStateChange) {
                onUploadStateChange(false);
              }
              onPromptComplete();
              resetState();
            }, 1500);
          }
        } else {
          setUploadStatus("error");
          setVerificationStatus("failed");
          setVerificationMessage(result.message || "Verification failed");
          setIsProcessing(false);
          // Notify parent that processing is complete
          if (onProcessingStateChange) {
            onProcessingStateChange(false);
          }
          // Notify parent that upload failed
          if (onUploadStateChange) {
            onUploadStateChange(false);
          }
        }
      } catch (error) {
        console.error("Upload error:", error);
        setUploadStatus("error");
        setVerificationStatus("failed");
        setVerificationMessage("Failed to upload video. Please try again.");
        setIsProcessing(false);
        // Notify parent that processing is complete
        if (onProcessingStateChange) {
          onProcessingStateChange(false);
        }
        // Notify parent that upload failed
        if (onUploadStateChange) {
          onUploadStateChange(false);
        }
        if (onError) onError("Upload failed: " + error);
      }
    };

    const uploadAndVerifyVideo = async (
      videoBlob: Blob,
      prompt: RecordingPrompt
    ) => {
      try {
        // Determine file extension and MIME type
        let fileExtension = "webm";
        let mimeType = "video/webm";

        // Check blob type and set appropriate values
        if (videoBlob.type) {
          if (videoBlob.type.includes("mp4")) {
            fileExtension = "mp4";
            mimeType = "video/mp4";
          } else if (
            videoBlob.type.includes("quicktime") ||
            videoBlob.type.includes("mov")
          ) {
            fileExtension = "mov";
            mimeType = "video/quicktime";
          } else if (videoBlob.type.includes("webm")) {
            fileExtension = "webm";
            mimeType = "video/webm";
          } else {
            // If blob has unknown type, force it to webm
            console.warn(
              "Unknown blob type, defaulting to webm:",
              videoBlob.type
            );
            mimeType = "video/webm";
          }
        } else {
          // If blob has no type, default to webm
          console.warn("Blob has no type, defaulting to webm");
          mimeType = "video/webm";
        }

        const fileName = `kyc_video_${Date.now()}.${fileExtension}`;

        // Create File with explicit MIME type
        const videoFile = new File([videoBlob], fileName, {
          type: mimeType,
        });

        const videoFormData = new FormData();
        videoFormData.append("video", videoFile);
        videoFormData.append("prompt", prompt.text);

        console.log("Uploading video:", {
          fileName,
          originalBlobType: videoBlob.type,
          fileMimeType: videoFile.type,
          size: videoBlob.size,
          extension: fileExtension,
        });

        // 1. Upload video file
        const videoResponse = await fetch(
          `${API_BASE}/users/${userId}/video-kyc/upload`,
          {
            method: "POST",
            body: videoFormData,
          }
        );

        if (!videoResponse.ok) {
          let errorMessage = "Video upload failed";
          try {
            const errorData = await videoResponse.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = `${errorMessage}: ${videoResponse.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const videoData = await videoResponse.json();
        console.log("Video upload response:", videoData);

        // 2. Update metadata
        const metadataResponse = await fetch(
          `${API_BASE}/users/${userId}/video-kyc`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoKycTranscript: recognizedText || prompt.text,
              videoKycRecVideo: videoData.data?.filename || fileName,
              verificationMethod: prompt.type,
              videoKycMeta: {
                duration: getRecordingDuration(),
                prompt: prompt.text,
                faceDetected: faceDetected,
                handDetected: handDetected,
                recordingDate: new Date().toISOString(),
                otpVerified:
                  prompt.type === "otp" ? otpVerifiedRef.current : undefined,
                attempts: attempts + 1,
              },
            }),
          }
        );

        if (!metadataResponse.ok) {
          const error = await metadataResponse.json();
          throw new Error(
            "Metadata update failed: " + (error.error || "Unknown error")
          );
        }

        // 3. Verify KYC
        const verifyResponse = await fetch(
          `${API_BASE}/users/${userId}/video-kyc/verify`,
          { method: "POST" }
        );

        if (!verifyResponse.ok) {
          const error = await verifyResponse.json();
          throw new Error(
            "KYC verification failed: " + (error.error || "Unknown error")
          );
        }

        const verifyData = await verifyResponse.json();

        return {
          success: true,
          message: "KYC verification completed successfully",
          data: verifyData,
        };
      } catch (error) {
        console.error("Upload and verify error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    };

    const resetState = () => {
      setShowPlayback(false);
      setRecordedVideo(null);
      setUploadStatus("idle");
      setVerificationStatus("pending");
      setVerificationMessage("");
      setError("");
      setRecognizedText("");
      setOtpVerified(false);
      otpVerifiedRef.current = false;
      setShowOtpError(false);
      verificationAttemptedRef.current = false;
      stopRecordingCalledRef.current = false;
      setIsProcessing(false);
      setAttempts(0);
    };

    useImperativeHandle(ref, () => ({
      startRecording,
    }));

    return (
      <div className="space-y-3">
        {/* Real-time OTP Recognition Display */}
        {isRecording && currentPrompt.type === "otp" && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800 text-sm">
                Real-time OTP Recognition Active
              </span>
            </div>

            {recognizedText && (
              <>
                <div className="font-medium text-blue-800 mb-1 text-sm">
                  Recognized Speech:
                </div>
                <div
                  className={`text-sm font-mono p-2 rounded border ${
                    recognizedText.toLowerCase().replace(/\D/g, "") ===
                    currentPrompt.text.toLowerCase().replace(/\D/g, "")
                      ? "bg-green-100 text-green-900 border-green-300"
                      : "bg-white text-blue-900 border-blue-300"
                  }`}
                >
                  {recognizedText}
                </div>
              </>
            )}

            {otpVerified && (
              <div className="flex items-center gap-2 mt-2 text-green-600 animate-in fade-in">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  OTP Verified Successfully ✓
                </span>
              </div>
            )}
          </div>
        )}

        {/* OTP Error Alert */}
        {showOtpError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Incorrect OTP, please try again
              </span>
            </div>
          </div>
        )}

        {/* Browser Support Warning */}
        {currentPrompt.type === "otp" && !isSpeechRecognitionSupported && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Real-time OTP verification is not supported in your browser.
                Please speak the OTP clearly.
              </span>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {currentPrompt.type === "otp"
                  ? "Processing OTP verification..."
                  : "Processing recording..."}
              </span>
            </div>
          </div>
        )}

        {/* Recording Status */}
        {isRecording && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-red-800 text-sm">
                Recording: Speak "{currentPrompt.text}" clearly
                {attempts > 0 && (
                  <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                    Attempt {attempts + 1}/{maxAttempts}
                  </span>
                )}
              </span>
              <span className="text-sm font-bold text-red-600">
                {recordingTime}s
              </span>
            </div>
            <div className="w-full bg-red-200 rounded-full h-1.5 mt-2">
              <div
                className="h-1.5 rounded-full bg-red-500 transition-all duration-300"
                style={{
                  width: `${
                    ((currentPrompt.duration - recordingTime) /
                      currentPrompt.duration) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* OTP Verified Success */}
        {otpVerified && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="font-medium text-green-800 text-sm">
                OTP verified successfully!
              </p>
            </div>
          </div>
        )}

        {/* NO RECORDING CONTROLS - They're in verification-screen.tsx */}
        {/* The Start button is handled by the parent component */}
      </div>
    );
  }
);

VideoRecorder.displayName = "VideoRecorder";

export default VideoRecorder;
