// components/success-screen.tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Sparkles, X } from "lucide-react";
import { CardFooter } from "./ui/card";

interface SuccessScreenProps {
  onComplete: () => void;
  userName?: string;
  isAlreadyVerified?: boolean;
}

export default function SuccessScreen({
  onComplete,
  userName,
  isAlreadyVerified = false,
}: SuccessScreenProps) {
  const [show, setShow] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    setTimeout(() => setShow(true), 100);
    setConfetti(true);
    const timer = setTimeout(() => setConfetti(false), 2000);

    // Disable browser back button
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
      clearTimeout(timer);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleClose = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      {/* Confetti Animation */}
      {confetti && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: ["#10B981", "#3B82F6", "#EF4444", "#F59E0B"][
                  Math.floor(Math.random() * 4)
                ],
              }}
            />
          ))}
        </div>
      )}

      {/* Main Card */}
      <div
        className={`relative w-full max-w-lg transition-all duration-700 ease-out ${
          show
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-50 opacity-0 translate-y-20"
        }`}
      >
        {/* Animated Glow Effect - Outside Card */}
        <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-60 animate-pulse"></div>

        {/* Card Content */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 relative z-20">
          {/* CLOSE BUTTON - Added */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-30"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Success Icon with Animation */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="bg-green-50 rounded-full w-20 h-20 flex items-center justify-center animate-scale-in">
                <CheckCircle className="w-10 h-10 text-green-600 animate-checkmark" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-500 animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-gray-900 mb-2 text-center animate-slide-up">
            {isAlreadyVerified
              ? "Already Verified! ✓"
              : "Verification Complete! 🎉"}
          </h2>

          {/* Personalized Message */}
          <p
            className="text-gray-600 mb-6 text-center animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            {isAlreadyVerified
              ? userName
                ? `${userName}, your account is already verified`
                : "Your account has already been verified"
              : userName
              ? `Welcome back, ${userName}!`
              : "Your identity has been successfully verified"}
          </p>

          {/* Success Message */}
          <div
            className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 mb-4 animate-slide-up border border-green-200"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900">
                {isAlreadyVerified
                  ? "Video KYC Already Completed"
                  : "Video KYC Verified"}
              </h3>
            </div>

            {/* Steps in single line */}
            {!isAlreadyVerified && (
              <div className="flex items-center justify-center gap-2 flex-wrap text-xs sm:text-sm text-emerald-700">
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                    1
                  </span>
                  <span>Face Verified</span>
                </div>
                <span className="text-emerald-400">—</span>
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                    2
                  </span>
                  <span>OTP Verified</span>
                </div>
                <span className="text-emerald-400">—</span>
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                    3
                  </span>
                  <span>Video Uploaded</span>
                </div>
              </div>
            )}

            {isAlreadyVerified && (
              <div className="text-center">
                <p className="text-sm text-emerald-700">
                  No further verification required
                </p>
              </div>
            )}
          </div>

          {/* Email Info Box */}
          {!isAlreadyVerified && (
            <div
              className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 animate-slide-up"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">
                    Check Your Email
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    Further details and verification documents will be sent to
                    your registered email address shortly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isAlreadyVerified && (
            <div
              className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 animate-slide-up"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">
                    Verification Status
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    Your account has been verified previously. All verification
                    documents are on file.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div
            className="text-center animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            <p className="text-gray-500 text-xs sm:text-sm mb-3">
              🔒 Your data is encrypted and secure
            </p>
            <p className="text-gray-400 text-xs italic">
              You can safely close this tab now
            </p>
          </div>

          <CardFooter className="flex flex-col space-y-3 pt-4">
            <div className="text-gray-500 text-xs flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              powered by HyperVerge
            </div>
          </CardFooter>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          70% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes checkmark {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes slide-up {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }
        .animate-scale-in {
          animation: scale-in 0.6s ease-out forwards;
        }
        .animate-checkmark {
          animation: checkmark 0.6s ease-out forwards;
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
