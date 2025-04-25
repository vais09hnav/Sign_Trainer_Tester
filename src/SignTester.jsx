import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import "./SignTester.css";

const SignTester = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [signs, setSigns] = useState([]);
  const [lastLandmarks, setLastLandmarks] = useState(null);
  const [matchedSign, setMatchedSign] = useState(null);
  const lastSpokenTimeRef = useRef(0);
  const cameraRef = useRef(null);
  const [handDetected, setHandDetected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [testMode, setTestMode] = useState(true);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [signToTest, setSignToTest] = useState(null);
  const [testInProgress, setTestInProgress] = useState(false);
  const [testCorrect, setTestCorrect] = useState(null);
  const [recognitionActive, setRecognitionActive] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.2);
  const testTimeoutRef = useRef(null);
  const handDetectionTimeoutRef = useRef(null);
  const correctMatchCountRef = useRef(0);
  const testResultsTimeoutRef = useRef(null);

  // Load saved signs and initialize test results
  useEffect(() => {
    const savedSigns = JSON.parse(localStorage.getItem("signs")) || [];
    setSigns(savedSigns);

    // Initialize test results, ensuring all signs have an entry
    const savedTestResults = JSON.parse(localStorage.getItem("testResults")) || [];
    const initialTestResults = savedSigns.map(sign => {
      const existingResult = savedTestResults.find(r => r.name === sign.name);
      return existingResult || {
        name: sign.name,
        tested: 0,
        correct: 0,
        accuracy: 0,
        lastTested: null
      };
    });
    setTestResults(initialTestResults);
  }, []);

  // Save test results when they change
  useEffect(() => {
    if (testResults.length > 0) {
      localStorage.setItem("testResults", JSON.stringify(testResults));
    }
  }, [testResults]);

  // Sync test results when signs change
  useEffect(() => {
    setTestResults(prev => {
      const updatedResults = signs.map(sign => {
        const existingResult = prev.find(r => r.name === sign.name);
        return existingResult || {
          name: sign.name,
          tested: 0,
          correct: 0,
          accuracy: 0,
          lastTested: null
        };
      });
      return updatedResults;
    });
  }, [signs]);

  // Initialize MediaPipe Hands
  useEffect(() => {
    const initializeHandTracking = async () => {
      try {
        const hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
          if (results.multiHandLandmarks?.length > 0) {
            const current = results.multiHandLandmarks;
            setHandDetected(true);
            setLastLandmarks(current);
            
            if (handDetectionTimeoutRef.current) {
              clearTimeout(handDetectionTimeoutRef.current);
              handDetectionTimeoutRef.current = null;
            }
            
            if (recognitionActive) {
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
                correctMatchCountRef.current = 0;
                handDetectionTimeoutRef.current = null;
              }, 150);
            }
          }
        });

        if (videoRef.current) {
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                await hands.send({ image: videoRef.current });
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
              console.error("Error starting camera:", err);
              setError("Failed to start camera. Please ensure camera permissions are granted.");
            });
        }
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
      
      if (testTimeoutRef.current) {
        clearTimeout(testTimeoutRef.current);
      }
      
      if (handDetectionTimeoutRef.current) {
        clearTimeout(handDetectionTimeoutRef.current);
      }
      
      if (testResultsTimeoutRef.current) {
        clearTimeout(testResultsTimeoutRef.current);
      }
    };
  }, [recognitionActive]); // Added recognitionActive as dependency

  // Drawing functions
  const drawHandLandmarks = (landmarks) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    landmarks.forEach((points) => {
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [5, 6], [6, 7], [7, 8],
        [9, 10], [10, 11], [11, 12],
        [13, 14], [14, 15], [15, 16],
        [17, 18], [18, 19], [19, 20],
        [0, 5], [5, 9], [9, 13], [13, 17]
      ];

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

      points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(
          point.x * canvas.width,
          point.y * canvas.height,
          index === 0 ? 8 : 5,
          0,
          2 * Math.PI
        );
        
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

  // Match detection algorithm
  const detectMatch = (landmarks) => {
    if (signs.length === 0) return;
    
    const now = Date.now();
    const shouldSpeak = now - lastSpokenTimeRef.current >= 1500;

    let bestMatch = null;
    let bestScore = Infinity;

    for (let sign of signs) {
      const score = calculateMatchScore(sign.landmarks, landmarks);
      
      if (score < confidenceThreshold && score < bestScore) {
        bestScore = score;
        bestMatch = sign;
      }
    }

    if (bestMatch) {
      const newMatch = !matchedSign || matchedSign.name !== bestMatch.name;
      setMatchedSign(bestMatch);
      
      if (testMode && testInProgress && signToTest) {
        if (bestMatch.name === signToTest.name) {
          correctMatchCountRef.current += 1;
          
          if (correctMatchCountRef.current >= 5 && testCorrect === null) {
            handleCorrectTest();
          }
        } else {
          correctMatchCountRef.current = 0;
        }
      }
      
      if (newMatch && shouldSpeak && speechEnabled) {
        if (!testInProgress) {
          speakText(bestMatch.name);
        }
        lastSpokenTimeRef.current = now;
      }
    } else {
      setMatchedSign(null);
      correctMatchCountRef.current = 0;
    }
  };

  // Handle correct test answer
  const handleCorrectTest = () => {
    if (!signToTest) return;
    
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }
    
    setTestCorrect(true);
    
    updateTestResults(signToTest.name, true);
    
    speakText("Correct!");
    
    testResultsTimeoutRef.current = setTimeout(() => {
      setTestInProgress(false);
      setSignToTest(null);
      setTestCorrect(null);
      correctMatchCountRef.current = 0;
    }, 2000);
  };

  // Handle incorrect test answer
  const handleIncorrectTest = () => {
    if (!signToTest) return;
    
    setTestCorrect(false);
    
    updateTestResults(signToTest.name, false);
    
    speakText("Time's up. Try again.");
    
    testResultsTimeoutRef.current = setTimeout(() => {
      setTestInProgress(false);
      setSignToTest(null);
      setTestCorrect(null);
      correctMatchCountRef.current = 0;
    }, 2000);
  };

  const calculateMatchScore = (saved, current) => {
    if (!saved || !current || saved.length !== current.length) return Infinity;

    let totalDistance = 0;
    let pointCount = 0;
    
    for (let i = 0; i < saved.length; i++) {
      const normalizedSaved = normalizeLandmarks(saved[i]);
      const normalizedCurrent = normalizeLandmarks(current[i]);
      
      for (let j = 0; j < normalizedSaved.length; j++) {
        const dx = normalizedSaved[j].x - normalizedCurrent[j].x;
        const dy = normalizedSaved[j].y - normalizedCurrent[j].y;
        const dz = (normalizedSaved[j].z - normalizedCurrent[j].z) * 0.5;
        
        totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
        pointCount++;
      }
    }

    return pointCount > 0 ? totalDistance / pointCount : Infinity;
  };

  const normalizeLandmarks = (points) => {
    if (!points || points.length === 0) return [];
    
    const wrist = points[0];
    const normalized = [];
    
    let maxDist = 0;
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - wrist.x;
      const dy = points[i].y - wrist.y;
      const dz = points[i].z - wrist.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > maxDist) maxDist = dist;
    }
    
    const scaleFactor = maxDist > 0 ? 1 / maxDist : 1;
    
    for (let i = 0; i < points.length; i++) {
      normalized.push({
        x: (points[i].x - wrist.x) * scaleFactor,
        y: (points[i].y - wrist.y) * scaleFactor,
        z: (points[i].z - wrist.z) * scaleFactor
      });
    }
    
    return normalized;
  };

  const speakText = (text) => {
    if (!speechEnabled) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const startTest = (sign) => {
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
    }
    
    if (testResultsTimeoutRef.current) {
      clearTimeout(testResultsTimeoutRef.current);
    }
    
    setSignToTest(sign);
    setTestInProgress(true);
    setTestCorrect(null);
    setMatchedSign(null);
    correctMatchCountRef.current = 0;
    
    speakText(`Show me the sign for "${sign.name}"`);
    
    testTimeoutRef.current = setTimeout(() => {
      if (testInProgress && signToTest?.name === sign.name && testCorrect === null) {
        handleIncorrectTest();
      }
    }, 7000);
  };

  // Add function to compare current landmarks with saved signs
  const checkForMatch = () => {
    if (!lastLandmarks || !recognitionActive) return;
    detectMatch(lastLandmarks);
  };

  // Use lastLandmarks state when recognition is toggled
  useEffect(() => {
    if (recognitionActive && lastLandmarks) {
      detectMatch(lastLandmarks);
    } else if (!recognitionActive) {
      setMatchedSign(null);
    }
  }, [recognitionActive]);

  const updateTestResults = (signName, isCorrect) => {
    setTestResults(prev => {
      const updated = prev.map(result => {
        if (result.name === signName) {
          const tested = result.tested + 1;
          const correct = isCorrect ? result.correct + 1 : result.correct;
          const accuracy = tested > 0 ? (correct / tested) * 100 : 0;
          
          return {
            ...result,
            tested,
            correct,
            accuracy,
            lastTested: new Date().toLocaleString()
          };
        }
        return { ...result };
      });
      
      return [...updated];
    });
  };

  const toggleSpeech = () => {
    setSpeechEnabled(!speechEnabled);
  };

  const toggleTestMode = () => {
    setTestMode(!testMode);
    setTestInProgress(false);
    setSignToTest(null);
    setTestCorrect(null);
    setMatchedSign(null);
    correctMatchCountRef.current = 0;
    
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }
    
    if (testResultsTimeoutRef.current) {
      clearTimeout(testResultsTimeoutRef.current);
      testResultsTimeoutRef.current = null;
    }
  };

  const adjustThreshold = (e) => {
    setConfidenceThreshold(parseFloat(e.target.value));
    // Re-evaluate current landmarks with new threshold
    if (lastLandmarks && recognitionActive) {
      detectMatch(lastLandmarks);
    }
  };

  const resetTestResults = () => {
    const initialTestResults = signs.map(sign => ({
      name: sign.name,
      tested: 0,
      correct: 0,
      accuracy: 0,
      lastTested: null
    }));
    
    setTestResults(initialTestResults);
    localStorage.setItem("testResults", JSON.stringify(initialTestResults));
  };

  return (
    <div className="sign-tester-container">
      <h1>Sign Language Tester</h1>
      
      <div className="tester-grid">
        <div className="camera-container">
          <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
          <canvas ref={canvasRef} width={640} height={480} className="hand-canvas" />
          
          {error && (
            <div className="error-overlay">
              <div className="error-message">{error}</div>
            </div>
          )}
          
          {!handDetected && cameraReady && !error && (
            <div className="no-hand-message">
              No hand detected. Please show your hand to the camera.
            </div>
          )}
          
          {matchedSign && !testInProgress && recognitionActive && (
            <div className="matched-sign">
              <h2>{matchedSign.name}</h2>
            </div>
          )}
          
          {testInProgress && signToTest && (
            <div className="test-overlay">
              <h3>Show the sign for:</h3>
              <h2>{signToTest.name}</h2>
              
              {testCorrect !== null && (
                <div className={`test-result ${testCorrect ? 'correct' : 'incorrect'}`}>
                  {testCorrect ? 'Correct!' : 'Try again!'}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="controls-panel">
          <div className="mode-toggle">
            <h3>Mode</h3>
            <button 
              onClick={toggleTestMode}
              className={`mode-button ${testMode ? 'active' : ''}`}
            >
              {testMode ? 'Test Mode' : 'Practice Mode'}
            </button>
            <div className="mode-description">
              {testMode ? 
                'Test Mode: Practice specific signs and track your accuracy' :
                'Practice Mode: Free practice with recognition feedback'
              }
            </div>
          </div>
          
          <div className="settings">
            <h3>Settings</h3>
            <div className="setting-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={speechEnabled} 
                  onChange={toggleSpeech}
                />
                Speech Output
              </label>
            </div>
            
            <div className="setting-item">
              <label>Recognition Sensitivity: {confidenceThreshold.toFixed(2)}</label>
              <input 
                type="range" 
                min="0.05" 
                max="0.5" 
                step="0.01" 
                value={confidenceThreshold}
                onChange={adjustThreshold}
              />
              <div className="threshold-labels">
                <span>High (More Matches)</span>
                <span>Low (Fewer Matches)</span>
              </div>
            </div>
            
            <div className="setting-item">
              <button 
                onClick={() => setRecognitionActive(!recognitionActive)}
                className={`toggle-button ${recognitionActive ? 'active' : 'inactive'}`}
              >
                {recognitionActive ? 'Recognition ON' : 'Recognition OFF'}
              </button>
            </div>
          </div>
          
          <div className="saved-signs-panel">
            <h3>Available Signs ({signs.length})</h3>
            {signs.length === 0 ? (
              <p className="no-signs-message">
                No signs saved yet. Please create signs in the Sign Trainer.
              </p>
            ) : (
              <>
                <div className="sign-list">
                  {signs.map((sign, idx) => {
                    const result = testResults.find(r => r.name === sign.name) || {
                      tested: 0,
                      accuracy: 0
                    };
                    return (
                      <div 
                        key={idx} 
                        className={`sign-item ${matchedSign?.name === sign.name ? 'matched' : ''}`}
                      >
                        <div className="sign-info">
                          <span className="sign-name">{sign.name}</span>
                          {testMode && (
                            <span className="sign-accuracy">
                              {result.tested > 0 ? `${Math.round(result.accuracy)}%` : '-'}
                            </span>
                          )}
                        </div>
                        {testMode && (
                          <button 
                            onClick={() => startTest(sign)}
                            disabled={testInProgress}
                            className="test-button"
                          >
                            Test
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {testMode && (
                  <div className="test-results-summary">
                    <h3>Test Results</h3>
                    {testResults.length === 0 ? (
                      <p>No test results available.</p>
                    ) : (
                      <table className="results-table">
                        <thead>
                          <tr>
                            <th>Sign</th>
                            <th>Tested</th>
                            <th>Correct</th>
                            <th>Accuracy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testResults.map((result, idx) => (
                            <tr key={idx}>
                              <td>{result.name}</td>
                              <td>{result.tested}</td>
                              <td>{result.correct}</td>
                              <td>
                                {result.tested > 0 ? 
                                  `${Math.round(result.accuracy)}%` : 
                                  '-'
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button 
                      onClick={resetTestResults}
                      className="reset-button"
                      disabled={testResults.every(r => r.tested === 0)}
                    >
                      Reset Results
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignTester;