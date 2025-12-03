// face-detection.ts - Complete Fixed Version
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

declare global {
  interface Window {
    faceapi: any
  }
}

export interface FaceDetectionResult {
  detections: any[]
  expressions: any
  age: number | null
  gender: string | null
}

export interface VerificationResult {
  isMatch: boolean
  confidence: number
  hasMultipleFaces: boolean
  hasHandOnFace: boolean
  matchingMethod: string
  modelUsed: string
}

// Track initialization state
let initializationPromise: Promise<boolean> | null = null
let modelsLoaded = false
let availableModels: string[] = []
let mediaPipeLoaded = false

// MediaPipe instances
let handLandmarker: HandLandmarker | null = null
let handLandmarkerReady = false

// Initialize all models including MediaPipe for hands only
export async function initializeFaceApi(): Promise<boolean> {
  if (modelsLoaded && mediaPipeLoaded && handLandmarkerReady) {
    return true
  }

  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = (async (): Promise<boolean> => {
    try {
      console.log("[v0] Starting initialization with face-api.js and MediaPipe Hands")

      if (typeof window === "undefined") {
        console.error("[v0] Window object not available")
        return false
      }

      // Load MediaPipe Hands first
      await loadMediaPipeHands()
      
      // Load face-api.js library if not already loaded
      if (!window.faceapi) {
        await loadFaceApiLibrary()
      }

      // Load models from local weights folder with fallback
      await loadModelsWithFallback()
      
      modelsLoaded = true
      console.log("[v0] All models initialized successfully")
      return true
    } catch (error) {
      console.error("[v0] Failed to initialize:", error)
      initializationPromise = null
      modelsLoaded = false
      return false
    }
  })()

  return initializationPromise
}

// Load MediaPipe Hands using npm package - FIXED VERSION
async function loadMediaPipeHands(): Promise<void> {
  try {
    console.log("[v0] Loading MediaPipe Hands...")

    // Use the correct CDN path for MediaPipe
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    console.log("[v0] FilesetResolver loaded, creating HandLandmarker...");

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2
    });

    console.log("[v0] MediaPipe Hands loaded successfully");
    mediaPipeLoaded = true;
    handLandmarkerReady = true;
    
  } catch (error) {
    console.error("[v0] Failed to load MediaPipe Hands:", error);
    
    // Fallback: Try alternative CDN path
    try {
      console.log("[v0] Trying alternative MediaPipe CDN...");
      
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
          delegate: "CPU" // Fallback to CPU if GPU fails
        },
        runningMode: "VIDEO",
        numHands: 2
      });

      console.log("[v0] MediaPipe Hands loaded successfully with alternative CDN");
      mediaPipeLoaded = true;
      handLandmarkerReady = true;
      
    } catch (fallbackError) {
      console.error("[v0] Fallback MediaPipe loading also failed:", fallbackError);
      mediaPipeLoaded = false;
      handLandmarkerReady = false;
    }
  }
}

// Load face-api.js library
async function loadFaceApiLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.faceapi) {
      resolve()
      return
    }

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src*="face-api.min.js"]')
    if (existingScript) {
      console.log("[v0] face-api.js script already exists, waiting for load...")
      let retries = 0
      const checkFaceApi = () => {
        if (window.faceapi) {
          resolve()
        } else if (retries < 50) {
          retries++
          setTimeout(checkFaceApi, 100)
        } else {
          reject(new Error("face-api not available after script load"))
        }
      }
      checkFaceApi()
      return
    }

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js"
    script.async = true
    
    script.onload = () => {
      console.log("[v0] face-api.js library loaded successfully")
      let retries = 0
      const checkFaceApi = () => {
        if (window.faceapi) {
          resolve()
        } else if (retries < 50) {
          retries++
          setTimeout(checkFaceApi, 100)
        } else {
          reject(new Error("face-api not available after script load"))
        }
      }
      checkFaceApi()
    }
    
    script.onerror = () => {
      reject(new Error("Failed to load face-api.js library"))
    }
    
    document.head.appendChild(script)
  })
}

// Load models with local first, CDN fallback
async function loadModelsWithFallback(): Promise<void> {
  const localModelUrl = "/weights/"
  const cdnModelUrl = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"

  if (!window.faceapi) {
    throw new Error("face-api not loaded")
  }

  try {
    console.log("[v0] Attempting to load models from local folder...")
    await loadModelsFromUrl(localModelUrl)
    console.log("[v0] Models loaded successfully from local folder")
  } catch (error) {
    console.warn("[v0] Failed to load models from local folder, trying CDN...", error)
    try {
      await loadModelsFromUrl(cdnModelUrl)
      console.log("[v0] Models loaded successfully from CDN")
    } catch (cdnError) {
      console.error("[v0] Failed to load models from CDN:", cdnError)
      await loadEssentialModelsOnly(cdnModelUrl)
    }
  }
}

// Load only essential models
async function loadEssentialModelsOnly(modelUrl: string): Promise<void> {
  console.log("[v0] Loading essential models only...")
  
  const essentialModels = [
    { name: 'tinyFaceDetector', net: window.faceapi.nets.tinyFaceDetector },
    { name: 'faceLandmark68Net', net: window.faceapi.nets.faceLandmark68Net },
    { name: 'faceRecognitionNet', net: window.faceapi.nets.faceRecognitionNet },
  ]

  for (const model of essentialModels) {
    try {
      if (model.net && typeof model.net.load === 'function') {
        await model.net.load(modelUrl)
        availableModels.push(model.name)
        console.log(`[v0] ✓ Loaded ${model.name}`)
      } else if (model.net && typeof model.net.loadFromUri === 'function') {
        await model.net.loadFromUri(modelUrl)
        availableModels.push(model.name)
        console.log(`[v0] ✓ Loaded ${model.name}`)
      }
    } catch (error) {
      console.warn(`[v0] Failed to load ${model.name}:`, error)
    }
  }

  if (availableModels.length === 0) {
    throw new Error("Could not load any face detection models")
  }

  console.log(`[v0] Loaded ${availableModels.length} essential models:`, availableModels)
}

// Load models from specific URL
async function loadModelsFromUrl(modelUrl: string): Promise<void> {
  console.log("[v0] Loading models from:", modelUrl)
  
  const modelsToLoad = [
    { name: 'tinyFaceDetector', net: window.faceapi.nets.tinyFaceDetector },
    { name: 'ssdMobilenetv1', net: window.faceapi.nets.ssdMobilenetv1 },
    { name: 'faceLandmark68Net', net: window.faceapi.nets.faceLandmark68Net },
    { name: 'faceRecognitionNet', net: window.faceapi.nets.faceRecognitionNet },
    { name: 'faceExpressionNet', net: window.faceapi.nets.faceExpressionNet },
    { name: 'ageGenderNet', net: window.faceapi.nets.ageGenderNet }
  ]

  availableModels = []

  for (const model of modelsToLoad) {
    try {
      if (model.net && typeof model.net.load === 'function') {
        await model.net.load(modelUrl)
        availableModels.push(model.name)
        console.log(`[v0] ✓ Successfully loaded ${model.name}`)
      } else if (model.net && typeof model.net.loadFromUri === 'function') {
        await model.net.loadFromUri(modelUrl)
        availableModels.push(model.name)
        console.log(`[v0] ✓ Successfully loaded ${model.name}`)
      }
    } catch (error) {
      console.warn(`[v0] Failed to load ${model.name}:`, error)
    }
  }

  const essentialModelNames = ['tinyFaceDetector', 'faceLandmark68Net', 'faceRecognitionNet']
  const hasEssentials = essentialModelNames.every(model => availableModels.includes(model))
  
  if (!hasEssentials) {
    throw new Error(`Missing essential models. Loaded: ${availableModels.join(', ')}`)
  }

  console.log(`[v0] Successfully loaded ${availableModels.length} models:`, availableModels)
}

// Check if all models are ready
export function isFaceApiReady(): boolean {
  return modelsLoaded && !!window.faceapi && availableModels.length > 0
}

// Check if MediaPipe Hands is ready
export function isMediaPipeReady(): boolean {
  return mediaPipeLoaded && !!handLandmarker && handLandmarkerReady
}

// Enhanced face detection using face-api.js only
export async function detectFaceInImage(imageElement: HTMLImageElement): Promise<FaceDetectionResult> {
  if (!isFaceApiReady()) {
    throw new Error("Face API not initialized")
  }

  try {
    console.log("[v0] Starting enhanced face detection using face-api.js")
    
    let detections: any[] = []
    let modelUsed = 'tinyFaceDetector'

    // Use SSD Mobilenet for better accuracy
    if (availableModels.includes('ssdMobilenetv1')) {
      try {
        const ssdDetections = await window.faceapi
          .detectAllFaces(imageElement, new window.faceapi.SsdMobilenetv1Options({ 
            minConfidence: 0.5,
            maxResults: 10
          }))
          .withFaceLandmarks()
          .withFaceDescriptors()
        
        if (ssdDetections.length > 0) {
          detections = ssdDetections
          modelUsed = 'ssd_mobilenet'
          console.log("[v0] SSD Mobilenet detection successful - found", detections.length, "faces")
        }
      } catch (ssdError) {
        console.warn("[v0] SSD Mobilenet detection failed:", ssdError)
      }
    }

    // Fallback to TinyFaceDetector
    if (detections.length === 0) {
      detections = await window.faceapi
        .detectAllFaces(imageElement, new window.faceapi.TinyFaceDetectorOptions({ 
          inputSize: 512, 
          scoreThreshold: 0.5,
          maxResults: 10
        }))
        .withFaceLandmarks()
        .withFaceDescriptors()
      console.log("[v0] TinyFaceDetector detection used")
    }

    // Get additional face information
    let expressions = null
    let age = null
    let gender = null

    if (detections.length > 0) {
      if (availableModels.includes('faceExpressionNet')) {
        try {
          const expressionDetections = await window.faceapi
            .detectAllFaces(imageElement, new window.faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions()
          if (expressionDetections.length > 0) {
            expressions = expressionDetections[0].expressions
          }
        } catch (exprError) {
          console.warn("[v0] Face expression detection failed:", exprError)
        }
      }

      if (availableModels.includes('ageGenderNet')) {
        try {
          const ageGenderDetections = await window.faceapi
            .detectAllFaces(imageElement, new window.faceapi.TinyFaceDetectorOptions())
            .withAgeAndGender()
          if (ageGenderDetections.length > 0) {
            age = Math.round(ageGenderDetections[0].age)
            gender = ageGenderDetections[0].gender
          }
        } catch (ageError) {
          console.warn("[v0] Age/gender detection failed:", ageError)
        }
      }
    }

    console.log("[v0] Face detection completed:", {
      detectionsCount: detections.length,
      modelUsed,
      hasDescriptors: detections.length > 0 && !!detections[0].descriptor
    })

    return {
      detections,
      expressions,
      age,
      gender,
    }
  } catch (error) {
    console.error("[v0] Face detection error:", error)
    return {
      detections: [],
      expressions: null,
      age: null,
      gender: null,
    }
  }
}

// Get face descriptor for matching using face-api.js
export async function getFaceDescriptor(imageElement: HTMLImageElement): Promise<Float32Array | null> {
  if (!isFaceApiReady()) {
    throw new Error("Face API not initialized")
  }

  try {
    let detections: any[] = []
    
    if (availableModels.includes('ssdMobilenetv1')) {
      try {
        const ssdDetections = await window.faceapi
          .detectAllFaces(imageElement, new window.faceapi.SsdMobilenetv1Options({ 
            minConfidence: 0.5,
            maxResults: 1
          }))
          .withFaceLandmarks()
          .withFaceDescriptors()
      
        if (ssdDetections.length > 0) {
          detections = ssdDetections
        }
      } catch (ssdError) {
        console.warn("[v0] SSD Mobilenet descriptor extraction failed:", ssdError)
      }
    }

    if (detections.length === 0) {
      detections = await window.faceapi
        .detectAllFaces(imageElement, new window.faceapi.TinyFaceDetectorOptions({ 
          inputSize: 512, 
          scoreThreshold: 0.5,
          maxResults: 1
        }))
        .withFaceLandmarks()
        .withFaceDescriptors()
    }

    if (detections.length === 0) {
      console.warn("[v0] No face detected for descriptor extraction")
      return null
    }

    console.log("[v0] Face descriptor extracted successfully")
    return detections[0].descriptor
  } catch (error) {
    console.error("[v0] Face descriptor error:", error)
    return null
  }
}

// Detect multiple faces using face-api.js only
export async function detectMultipleFacesMediaPipe(videoElement: HTMLVideoElement): Promise<boolean> {
  // Always use face-api.js for face detection
  return detectMultipleFacesFallback(videoElement)
}

// Multiple face detection using face-api.js
async function detectMultipleFacesFallback(videoElement: HTMLVideoElement): Promise<boolean> {
  try {
    const detections = await window.faceapi
      .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions({ 
        scoreThreshold: 0.5,
        maxResults: 5
      }))

    const hasMultipleFaces = detections.length > 1
    console.log("[v0] Face detection (face-api.js):", {
      faceCount: detections.length,
      hasMultipleFaces
    })
    return hasMultipleFaces
  } catch (error) {
    console.warn("[v0] Face detection failed:", error)
    return false
  }
}

// Detect hand on face using MediaPipe Hands - FIXED VERSION
export async function detectHandOnFaceMediaPipe(videoElement: HTMLVideoElement): Promise<boolean> {
  if (!isMediaPipeReady() || !handLandmarker) {
    console.log("[v0] MediaPipe Hands not available");
    return false;
  }

  try {
    // Check if video is ready
    if (videoElement.readyState < 2) {
      console.log("[v0] Video not ready");
      return false;
    }

    // Create offscreen canvas for processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn("[v0] Could not get canvas context");
      return false;
    }

    // Set canvas dimensions to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Get the current time for video mode
    const startTimeMs = performance.now();

    console.log("[v0] Detecting hands in frame...");
    
    // Detect hands in the current frame
    const results = handLandmarker.detectForVideo(canvas, startTimeMs);

    if (!results.landmarks || results.landmarks.length === 0) {
      console.log("[v0] No hands detected");
      return false;
    }

    console.log(`[v0] Detected ${results.landmarks.length} hand(s)`);

    // Check for hand-face overlap
    return await checkHandFaceOverlap(videoElement, results.landmarks);

  } catch (error) {
    console.error("[v0] MediaPipe hand detection error:", error);
    return false;
  }
}

// Enhanced hand-face overlap detection
async function checkHandFaceOverlap(videoElement: HTMLVideoElement, handLandmarks: any[]): Promise<boolean> {
  try {
    // Use face-api.js to detect face
    const faceDetections = await window.faceapi
      .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions({ 
        scoreThreshold: 0.3, // Lower threshold for better detection
        maxResults: 1
      }));

    if (faceDetections.length === 0) {
      console.log("[v0] No face detected for hand-face overlap check");
      // If no face but hands are detected, still return true to be cautious
      return handLandmarks.length > 0;
    }

    const faceDetection = faceDetections[0];
    const faceBox = faceDetection.detection.box;
    
    // Convert face box coordinates to percentages for comparison with hand landmarks
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    
    const faceLeft = faceBox.x / videoWidth;
    const faceRight = (faceBox.x + faceBox.width) / videoWidth;
    const faceTop = faceBox.y / videoHeight;
    const faceBottom = (faceBox.y + faceBox.height) / videoHeight;

    console.log("[v0] Face bounds:", { 
      left: faceLeft.toFixed(2), 
      right: faceRight.toFixed(2), 
      top: faceTop.toFixed(2), 
      bottom: faceBottom.toFixed(2),
      width: faceBox.width,
      height: faceBox.height
    });

    // Check if any hand landmarks are within face bounding box
    let handOnFaceDetected = false;
    
    for (const handLandmarksArray of handLandmarks) {
      let landmarksInFace = 0;
      const totalLandmarks = handLandmarksArray.length;
      
      for (const landmark of handLandmarksArray) {
        const x = landmark.x;
        const y = landmark.y;
        
        // Check if landmark is within face bounds with some padding
        const padding = 0.1; // 10% padding around face
        const paddedFaceLeft = Math.max(0, faceLeft - padding);
        const paddedFaceRight = Math.min(1, faceRight + padding);
        const paddedFaceTop = Math.max(0, faceTop - padding);
        const paddedFaceBottom = Math.min(1, faceBottom + padding);
        
        if (x >= paddedFaceLeft && x <= paddedFaceRight && y >= paddedFaceTop && y <= paddedFaceBottom) {
          landmarksInFace++;
        }
      }
      
      // If more than 20% of landmarks are in face area, consider it hand on face
      const threshold = totalLandmarks * 0.2; // 20% of landmarks
      if (landmarksInFace > threshold) {
        handOnFaceDetected = true;
        console.log(`[v0] ✅ Hand on face detected with ${landmarksInFace}/${totalLandmarks} landmarks in face area`);
        break;
      }
    }

    if (!handOnFaceDetected) {
      console.log("[v0] ✅ No hand on face detected");
    }
    
    return handOnFaceDetected;

  } catch (faceError) {
    console.warn("[v0] Face detection for hand check failed:", faceError);
    // If face detection fails but hands are present, be cautious and return true
    return handLandmarks.length > 0;
  }
}

// Simple hand detection for debugging - FIXED
export async function detectHandsSimple(videoElement: HTMLVideoElement): Promise<boolean> {
  if (!isMediaPipeReady() || !handLandmarker) {
    console.log("[v0] MediaPipe Hands not available for simple detection");
    return false;
  }

  try {
    // Check if video is ready
    if (videoElement.readyState < 2) {
      return false;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return false;
    }

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const startTimeMs = performance.now();
    const results = handLandmarker.detectForVideo(canvas, startTimeMs);

    const handsDetected = !!(results.landmarks && results.landmarks.length > 0);
    console.log(`[v0] Simple hand detection: ${handsDetected} (${results.landmarks?.length || 0} hands)`);
    
    return handsDetected;
  } catch (error) {
    console.warn("[v0] Simple hand detection error:", error);
    return false;
  }
}

// Test hand detection separately
export async function testHandDetection(videoElement: HTMLVideoElement): Promise<any> {
  if (!isMediaPipeReady() || !handLandmarker) {
    return { success: false, error: "MediaPipe not ready" };
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { success: false, error: "Canvas context not available" };
    }

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const startTimeMs = performance.now();
    const results = handLandmarker.detectForVideo(canvas, startTimeMs);

    return {
      success: true,
      handsDetected: !!(results.landmarks && results.landmarks.length > 0),
      handCount: results.landmarks?.length || 0,
      landmarks: results.landmarks,
      handedness: results.handedness
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Calculate face distance
export function calculateFaceDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
  if (!descriptor1 || !descriptor2) return 1

  let sumSquaredDiff = 0
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i]
    sumSquaredDiff += diff * diff
  }
  const distance = Math.sqrt(sumSquaredDiff)

  console.log("[v0] Face distance calculated:", distance.toFixed(4))
  return distance
}

// Convert distance to confidence percentage
export function distanceToConfidence(distance: number): number {
  let confidence: number;
  
  if (distance <= 0.4) {
    confidence = 0.8 + (0.2 * (1 - (distance / 0.4)))
  } else if (distance <= 0.5) {
    confidence = 0.6 + (0.2 * (1 - ((distance - 0.4) / 0.1)))
  } else if (distance <= 0.6) {
    confidence = 0.4 + (0.2 * (1 - ((distance - 0.5) / 0.1)))
  } else {
    confidence = Math.max(0, 0.4 * (1 - ((distance - 0.6) / 0.4)))
  }
  
  const percentage = Math.round(confidence * 100)
  
  console.log("[v0] Distance to confidence:", { 
    distance: distance.toFixed(4), 
    confidence: percentage + '%' 
  })
  
  return percentage
}

// Real-time matching for live detection using face-api.js only
export async function realTimeFaceMatching(
  videoElement: HTMLVideoElement,
  profileDescriptor: Float32Array
): Promise<{ confidence: number; distance: number; modelUsed: string; hasMultipleFaces: boolean; hasHandOnFace: boolean }> {
  if (!isFaceApiReady()) {
    throw new Error("Face API not initialized")
  }

  let bestResult = { 
    confidence: 0, 
    distance: 1, 
    modelUsed: 'tiny_face_detector',
    hasMultipleFaces: false,
    hasHandOnFace: false
  }

  try {
    // Check for multiple faces using face-api.js and hand on face using MediaPipe
    const [hasMultipleFaces, hasHandOnFace] = await Promise.all([
      detectMultipleFacesFallback(videoElement),
      detectHandOnFaceMediaPipe(videoElement)
    ])

    bestResult.hasMultipleFaces = hasMultipleFaces
    bestResult.hasHandOnFace = hasHandOnFace

    // Only proceed with face matching if no issues detected
    if (!hasMultipleFaces && !hasHandOnFace) {
      const detections = await window.faceapi
        .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions({ 
          inputSize: 416, 
          scoreThreshold: 0.5,
          maxResults: 1
        }))
        .withFaceLandmarks()
        .withFaceDescriptors()

      if (detections.length > 0) {
        const liveDescriptor = detections[0].descriptor
        const distance = calculateFaceDistance(profileDescriptor, liveDescriptor)
        const confidence = distanceToConfidence(distance)
        
        bestResult.confidence = confidence
        bestResult.distance = distance
        bestResult.modelUsed = availableModels.includes('ssdMobilenetv1') ? 'ssd_mobilenet' : 'tiny_face_detector'
      }
    }

    console.log("[v0] Real-time matching result:", bestResult)

  } catch (error) {
    console.error("[v0] Real-time matching error:", error)
  }

  return bestResult
}

// Enhanced verification using face-api.js only
export async function verifyFace(
  liveVideoElement: HTMLCanvasElement | HTMLVideoElement,
  profileDescriptor: Float32Array,
): Promise<VerificationResult> {
  if (!isFaceApiReady()) {
    throw new Error("Face API not initialized")
  }

  try {
    const frameResults = []
    const frameCount = 3
    
    for (let i = 0; i < frameCount; i++) {
      try {
        // Check for multiple faces using face-api.js and hand on face using MediaPipe
        const [hasMultipleFaces, hasHandOnFace] = await Promise.all([
          detectMultipleFacesFallback(liveVideoElement as HTMLVideoElement),
          detectHandOnFaceMediaPipe(liveVideoElement as HTMLVideoElement)
        ])

        let confidence = 0

        // Only proceed with face matching if no issues detected
        if (!hasMultipleFaces && !hasHandOnFace) {
          const detections = await window.faceapi
            .detectAllFaces(liveVideoElement, new window.faceapi.SsdMobilenetv1Options({ 
              minConfidence: 0.5,
              maxResults: 5
            }))
            .withFaceLandmarks()
            .withFaceDescriptors()

          if (detections.length > 0) {
            // Use the face with best match
            let bestMatch = { confidence: 0, distance: 1 }
            
            for (const detection of detections) {
              const distance = calculateFaceDistance(profileDescriptor, detection.descriptor)
              const frameConfidence = distanceToConfidence(distance)
              
              if (frameConfidence > bestMatch.confidence) {
                bestMatch = { confidence: frameConfidence, distance }
              }
            }

            confidence = bestMatch.confidence
          }
        }

        frameResults.push({
          confidence,
          hasMultipleFaces,
          hasHandOnFace,
          modelUsed: 'ssd_mobilenet'
        })

        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (frameError) {
        console.warn(`[v0] Frame ${i} verification failed:`, frameError)
      }
    }

    if (frameResults.length === 0) {
      return {
        isMatch: false,
        confidence: 0,
        hasMultipleFaces: false,
        hasHandOnFace: false,
        matchingMethod: "no_faces_detected",
        modelUsed: "none"
      }
    }

    // Calculate averages
    const averageConfidence = frameResults.reduce((sum, frame) => sum + frame.confidence, 0) / frameResults.length
    const hasMultipleFaces = frameResults.some(frame => frame.hasMultipleFaces)
    const hasHandOnFace = frameResults.some(frame => frame.hasHandOnFace)

    const finalConfidence = Math.round(averageConfidence)

    console.log("[v0] Enhanced verification results:", {
      framesChecked: frameResults.length,
      finalConfidence,
      hasMultipleFaces,
      hasHandOnFace
    })

    return {
      isMatch: finalConfidence >= 60 && !hasMultipleFaces && !hasHandOnFace,
      confidence: finalConfidence,
      hasMultipleFaces,
      hasHandOnFace,
      matchingMethod: `enhanced_verification (${frameResults.length} frames)`,
      modelUsed: 'ssd_mobilenet'
    }
  } catch (error) {
    console.error("[v0] Enhanced verification error:", error)
    return {
      isMatch: false,
      confidence: 0,
      hasMultipleFaces: false,
      hasHandOnFace: false,
      matchingMethod: "error",
      modelUsed: "none"
    }
  }
}