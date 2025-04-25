import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import "./SignTrainer.css";

const SignTrainer = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const [signs, setSigns] = useState([]);
  const [currentSign, setCurrentSign] = useState("");
  const [lastLandmarks, setLastLandmarks] = useState(null);
  const [matchedSign, setMatchedSign] = useState(null);
  const lastSpokenTimeRef = useRef(0);
  const cameraRef = useRef(null);
  const handsRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingTimeoutRef = useRef(null);
  const [handDetected, setHandDetected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);
  const [recognitionActive, setRecognitionActive] = useState(true);
  const [selectedSign, setSelectedSign] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const handDetectionTimeoutRef = useRef(null);

  useEffect(() => {
    // Load saved signs from localStorage
    const savedSigns = JSON.parse(localStorage.getItem("signs")) || [];
    setSigns(savedSigns);

    // Initialize MediaPipe Hands
    const initializeHandTracking = async () => {
      try {
        // Clear any existing timeouts
        if (handDetectionTimeoutRef.current) {
          clearTimeout(handDetectionTimeoutRef.current);
        }

        const hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        // Store reference to hands for later use
        handsRef.current = hands;

        // Use more permissive settings for better detection
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        // Improved results handling - matching SignTester implementation
        hands.onResults((results) => {
          if (results.multiHandLandmarks?.length > 0) {
            const current = results.multiHandLandmarks;
            setHandDetected(true);
            setLastLandmarks(current);
            
            if (handDetectionTimeoutRef.current) {
              clearTimeout(handDetectionTimeoutRef.current);
              handDetectionTimeoutRef.current = null;
            }
            
            // Detect matches when not recording and recognition is active
            if (!isRecording && recognitionActive) {
              detectMatch(current);
            }
            
            drawHandLandmarks(current);
          } else {
            if (!handDetectionTimeoutRef.current) {
              handDetectionTimeoutRef.current = setTimeout(() => {
                setHandDetected(false);
                clearCanvas();
                setMatchedSign(null);
                setLastLandmarks(null); // Clear landmarks when hand is not detected
                handDetectionTimeoutRef.current = null;
              }, 150);
            }
          }
        });

        // More reliable camera initialization
        const setupCamera = async () => {
          if (!videoRef.current) return;
          
          try {
            // First try to get camera permissions
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "user", width: 640, height: 480 },
              audio: false
            });
            
            // Stop the stream immediately, we just needed permissions
            stream.getTracks().forEach(track => track.stop());
            
            // Now initialize the MediaPipe camera
            const camera = new Camera(videoRef.current, {
              onFrame: async () => {
                if (videoRef.current && handsRef.current) {
                  await handsRef.current.send({ image: videoRef.current });
                }
              },
              width: 640,
              height: 480,
            });
            
            // Start camera after a short delay to ensure everything is ready
            setTimeout(() => {
              camera.start()
                .then(() => {
                  console.log("Camera started successfully");
                  setCameraReady(true);
                  cameraRef.current = camera;
                })
                .catch((err) => {
                  console.error("Error starting camera:", err);
                  setError("Failed to start camera. Please ensure camera permissions are granted.");
                });
            }, 500);
          } catch (err) {
            console.error("Camera permission denied or error:", err);
            setError("Camera access denied. Please grant camera permission and refresh the page.");
          }
        };
        
        setupCamera();
      } catch (err) {
        console.error("Error initializing hand tracking:", err);
        setError("Failed to initialize hand tracking. Please refresh and try again.");
      }
    };

    initializeHandTracking();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (handDetectionTimeoutRef.current) {
        clearTimeout(handDetectionTimeoutRef.current);
      }
    };
  }, []);

  // Effect to draw preview when a sign is selected
  useEffect(() => {
    if (selectedSign && showPreviewModal && previewCanvasRef.current) {
      drawHandLandmarksOnCanvas(selectedSign.landmarks, previewCanvasRef.current);
    }
  }, [selectedSign, showPreviewModal]);

  const drawHandLandmarks = (landmarks) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    drawHandLandmarksOnCanvas(landmarks, canvas);
  };

  // Reusable function to draw landmarks on any canvas - updated to match SignTester
  const drawHandLandmarksOnCanvas = (landmarks, canvas) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    landmarks.forEach((points) => {
      // Draw connections for better visualization
      const connections = [
        // Thumb
        [0, 1], [1, 2], [2, 3], [3, 4],
        // Index finger
        [5, 6], [6, 7], [7, 8],
        // Middle finger
        [9, 10], [10, 11], [11, 12],
        // Ring finger
        [13, 14], [14, 15], [15, 16],
        // Pinky
        [17, 18], [18, 19], [19, 20],
        // Palm connections
        [0, 5], [5, 9], [9, 13], [13, 17]
      ];

      // Draw connections
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      
      connections.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(
          points[i].x * canvas.width,
          points[i].y * canvas.height
        );
        ctx.lineTo(
          points[j].x * canvas.width,
          points[j].y * canvas.height
        );
        ctx.stroke();
      });

      // Draw landmarks as colored dots
      points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(
          point.x * canvas.width,
          point.y * canvas.height,
          index === 0 ? 8 : 5,
          0,
          2 * Math.PI
        );
        
        // Different colors for different parts of the hand
        if (index === 0) ctx.fillStyle = "yellow";
        else if (index <= 4) ctx.fillStyle = "red";
        else if (index <= 8) ctx.fillStyle = "blue";
        else if (index <= 12) ctx.fillStyle = "green";
        else if (index <= 16) ctx.fillStyle = "purple";
        else ctx.fillStyle = "orange";
        
        ctx.fill();
      });
    });

    ctx.restore();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const startRecording = () => {
    if (!currentSign.trim()) {
      alert("Please enter a sign meaning before recording");
      return;
    }
    
    if (!handDetected) {
      alert("No hand detected. Please show your hand to the camera first.");
      return;
    }
    
    // Actually start recording
    setIsRecording(true);
    // Disable recognition during recording
    setRecognitionActive(false);
    
    // Record for 3 seconds then automatically save
    recordingTimeoutRef.current = setTimeout(() => {
      saveSign();
      setIsRecording(false);
      
      // Re-enable recognition after saving
      setTimeout(() => {
        setRecognitionActive(true);
      }, 500);
    }, 3000);
  };

  const cancelRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    setIsRecording(false);
    
    // Re-enable recognition after canceling
    setTimeout(() => {
      setRecognitionActive(true);
    }, 500);
  };

  const saveSign = () => {
    if (currentSign.trim() && lastLandmarks) {
      const newSign = {
        name: currentSign.trim(),
        landmarks: lastLandmarks,
        timestamp: new Date().getTime()
      };
      const updated = [...signs, newSign];
      setSigns(updated);
      localStorage.setItem("signs", JSON.stringify(updated));
      
      // Provide feedback that sign was saved
      speakText(`Sign "${currentSign.trim()}" has been saved`);
      setCurrentSign("");
    } else {
      alert("Please show a hand sign and enter a meaning before saving");
    }
  };

  const deleteSign = (index) => {
    const updated = [...signs];
    updated.splice(index, 1);
    setSigns(updated);
    localStorage.setItem("signs", JSON.stringify(updated));
    
    // If we deleted the currently matched sign, clear the match
    if (matchedSign && matchedSign.name === signs[index].name) {
      setMatchedSign(null);
    }
    
    // Also clear selectedSign if we just deleted it
    if (selectedSign && selectedSign.name === signs[index].name) {
      setSelectedSign(null);
      setShowPreviewModal(false);
    }
  };

  const clearSigns = () => {
    if (window.confirm("Are you sure you want to delete all saved signs?")) {
      localStorage.removeItem("signs");
      setSigns([]);
      setMatchedSign(null);
      setSelectedSign(null);
      setShowPreviewModal(false);
    }
  };

  const speakText = (text) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const detectMatch = (landmarks) => {
    if (signs.length === 0) return; // No signs to match against
    
    const now = Date.now();
    // Only process recognition every 1 second to prevent too frequent speech
    if (now - lastSpokenTimeRef.current < 1000) return;

    // Find the best match
    let bestMatch = null;
    let bestScore = Infinity;

    for (let sign of signs) {
      const score = calculateMatchScore(sign.landmarks, landmarks);
      // Use a threshold of 0.25 for matching - slightly more tolerant
      if (score < 0.25 && score < bestScore) {
        bestScore = score;
        bestMatch = sign;
      }
    }

    if (bestMatch) {
      if (!matchedSign || matchedSign.name !== bestMatch.name) {
        setMatchedSign(bestMatch);
        speakText(bestMatch.name);
        lastSpokenTimeRef.current = now;
      }
    } else {
      setMatchedSign(null);
    }
  };

  // Improved matching algorithm
  const calculateMatchScore = (saved, current) => {
    if (!saved || !current || saved.length !== current.length) return Infinity;

    let totalDistance = 0;
    let pointCount = 0;
    
    for (let i = 0; i < saved.length; i++) {
      // Normalize landmarks to make recognition more robust
      const normalizedSaved = normalizeLandmarks(saved[i]);
      const normalizedCurrent = normalizeLandmarks(current[i]);
      
      // Calculate distance between corresponding points
      for (let j = 0; j < normalizedSaved.length; j++) {
        // Adjust weight for different points (more weight for fingertips)
        let weight = 1.0;
        if (j === 4 || j === 8 || j === 12 || j === 16 || j === 20) {
          weight = 1.5; // Give more weight to fingertips
        } else if (j === 0) {
          weight = 0.5; // Less weight for wrist
        }
        
        const dx = normalizedSaved[j].x - normalizedCurrent[j].x;
        const dy = normalizedSaved[j].y - normalizedCurrent[j].y;
        
        // Z position can be very variable, giving it less weight
        const dz = (normalizedSaved[j].z - normalizedCurrent[j].z) * 0.3;
        
        totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz) * weight;
        pointCount += weight;
      }
    }

    return pointCount > 0 ? totalDistance / pointCount : Infinity;
  };

  // Improved normalization
  const normalizeLandmarks = (points) => {
    if (!points || points.length === 0) return [];
    
    const wrist = points[0]; // Wrist point
    const normalized = [];
    
    // Find the scale factor based on hand size (distance between wrist and middle finger MCP)
    const middleFingerBase = points[9]; // Middle finger MCP
    const baseDistance = Math.sqrt(
      Math.pow(middleFingerBase.x - wrist.x, 2) +
      Math.pow(middleFingerBase.y - wrist.y, 2) +
      Math.pow(middleFingerBase.z - wrist.z, 2)
    );
    
    // Use hand size as scale factor
    const scaleFactor = baseDistance > 0 ? 1 / baseDistance : 1;
    
    for (let i = 0; i < points.length; i++) {
      normalized.push({
        x: (points[i].x - wrist.x) * scaleFactor,
        y: (points[i].y - wrist.y) * scaleFactor,
        z: (points[i].z - wrist.z) * scaleFactor
      });
    }
    
    return normalized;
  };

  const toggleRecognition = () => {
    setRecognitionActive(!recognitionActive);
  };

  const viewSign = (sign) => {
    setSelectedSign(sign);
    setShowPreviewModal(true);
  };

  const downloadSign = (sign) => {
    // Create a temporary canvas to draw the hand landmarks
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400;
    tempCanvas.height = 300;
    
    // Draw the hand landmarks on the temporary canvas
    drawHandLandmarksOnCanvas(sign.landmarks, tempCanvas);
    
    // Convert the canvas to a PNG image data URL
    try {
      const imageUrl = tempCanvas.toDataURL('image/png');
      
      // Create a download link
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `${sign.name.replace(/\s+/g, '_')}_sign.png`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
      }, 0);
    } catch (err) {
      console.error("Error creating PNG:", err);
      alert("Failed to create PNG image. Your browser might have security restrictions.");
    }
  };

  const closePreviewModal = () => {
    setShowPreviewModal(false);
  };

  // Function to reset and restart camera
  const resetCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
    }
    
    setCameraReady(false);
    setError(null);
    
    // Reinitialize after a short delay
    setTimeout(() => {
      if (videoRef.current && handsRef.current) {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        
        camera.start()
          .then(() => {
            setCameraReady(true);
            cameraRef.current = camera;
          })
          .catch((err) => {
            console.error("Error restarting camera:", err);
            setError("Failed to restart camera. Please refresh the page.");
          });
      }
    }, 1000);
  };

  return (
    <div className="sign-container">
      <h1 className="sign-title">Custom Sign Trainer</h1>

      <div className="sign-grid">
        <div className="camera-box">
          <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
          <canvas ref={canvasRef} width={640} height={480} className="video-canvas" />
          
          {error && (
            <div className="error-overlay">
              <div className="error-message">
                {error}
                <button onClick={resetCamera} className="btn blue small">
                  Retry Camera
                </button>
              </div>
            </div>
          )}
          
          {!handDetected && cameraReady && !error && (
            <div className="no-hand-overlay">
              <div className="no-hand-message">
                No hand detected. Please show your hand to the camera.
              </div>
            </div>
          )}
          
          {isRecording && (
            <div className="recording-indicator">
              Recording... <span className="recording-dot"></span>
            </div>
          )}
          
          {matchedSign && !isRecording && (
            <div className="matched-overlay">
              <div className="matched-text">
                <strong>{matchedSign.name}</strong>
              </div>
            </div>
          )}
          
          {handDetected && (
            <div className="hand-detected-indicator">
              Hand detected
            </div>
          )}
        </div>

        <div className="right-panel">
          <div className="status-bar">
            {cameraReady ? (
              <span className="status-ready">Camera active</span>
            ) : (
              <span className="status-loading">Initializing camera...</span>
            )}
            {handDetected && (
              <span className="status-hand-detected">Hand detected</span>
            )}
            <button 
              onClick={toggleRecognition} 
              className={`toggle-btn ${recognitionActive ? 'active' : 'inactive'}`}
            >
              {recognitionActive ? "Recognition: ON" : "Recognition: OFF"}
            </button>
          </div>
          
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter sign meaning"
              value={currentSign}
              onChange={(e) => setCurrentSign(e.target.value)}
              className="input-box"
              disabled={isRecording}
            />
            
            {!isRecording ? (
              <button 
                onClick={startRecording} 
                className="btn blue"
                disabled={!currentSign.trim() || !handDetected}
              >
                Record Sign
              </button>
            ) : (
              <button 
                onClick={cancelRecording} 
                className="btn red"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="training-info">
            {isRecording ? (
              <div className="recording-message">
                Hold your sign steady for 3 seconds...
              </div>
            ) : (
              <div className="help-message">
                {handDetected ? 
                  signs.length > 0 ?
                    matchedSign ?
                      `Recognized: "${matchedSign.name}"` :
                      "Show a saved sign or record a new one" :
                    "Hand detected! Enter a meaning and click 'Record Sign'" : 
                  "Show your hand to the camera to begin"
                }
              </div>
            )}
          </div>

          <div className="saved-signs">
            <div className="signs-header">
              <h2>Saved Signs ({signs.length})</h2>
              {signs.length > 0 && (
                <button onClick={clearSigns} className="btn red small">Clear All</button>
              )}
            </div>
            
            {signs.length === 0 ? (
              <p className="no-signs">No signs saved yet. Make a hand gesture and give it a name.</p>
            ) : (
              <ul className="signs-list">
                {signs.map((sign, idx) => (
                  <li key={idx} className={matchedSign?.name === sign.name ? "matched" : ""}>
                    <span 
                      className="sign-name" 
                      onClick={() => viewSign(sign)}
                      title="Click to view this sign"
                    >
                      {sign.name}
                    </span>
                    <div className="sign-actions">
                      <button 
                        onClick={() => downloadSign(sign)} 
                        className="download-btn"
                        title="Download this sign"
                      >
                        ↓
                      </button>
                      <button 
                        onClick={() => deleteSign(idx)} 
                        className="delete-btn"
                        title="Delete this sign"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="recognition-status">
            <h3>Recognition Status</h3>
            <div className="status-info">
              {recognitionActive ? (
                <p>Recognition active - show your sign to the camera</p>
              ) : (
                <p>Recognition disabled - enable to detect signs</p>
              )}
              
              {matchedSign && recognitionActive && (
                <p className="current-match">
                  Current match: <strong>{matchedSign.name}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="troubleshooting">
            <h3>Troubleshooting Tips:</h3>
            <ul>
              <li>Make sure your hand is clearly visible to the camera</li>
              <li>Ensure good lighting in the room</li>
              <li>Position your hand at a comfortable distance (not too close or far)</li>
              <li>Try moving your hand slowly if detection is inconsistent</li>
              <li>Make sure you've granted camera permissions to this app</li>
              <li>If detection stops working, try clicking the "Retry Camera" button</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sign Preview Modal */}
      {showPreviewModal && selectedSign && (
        <div className="preview-modal">
          <div className="preview-content">
            <div className="preview-header">
              <h2>Sign Preview: {selectedSign.name}</h2>
              <button onClick={closePreviewModal} className="close-btn">×</button>
            </div>
            <div className="preview-body">
              <canvas ref={previewCanvasRef} width={400} height={300} className="preview-canvas"></canvas>
              <div className="preview-actions">
                <button onClick={() => downloadSign(selectedSign)} className="btn blue">
                  Download Sign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignTrainer;