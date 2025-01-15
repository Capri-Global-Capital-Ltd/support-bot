import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Camera, Upload, Trash2, X } from 'lucide-react';

// Types
interface Message {
    type: 'user' | 'bot';
    content: string;
    timestamp: string;
}

interface NetworkRequest {
    url: string;
    method: string;
    status: number;
    duration: number;
    timestamp: string;
    error?: string;
}

type ChatStage = 'greeting' | 'screenshot' | 'confirm';

const SupportChat: React.FC = () => {
    // Chat State
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [stage, setStage] = useState<ChatStage>('greeting');
    const [issueDescription, setIssueDescription] = useState('');

    // Screenshot State
    const [isCapturing, setIsCapturing] = useState(false);
    const [showScreenshotOptions, setShowScreenshotOptions] = useState(false);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Network Monitoring State
    const [failedRequests, setFailedRequests] = useState<NetworkRequest[]>([]);
    const observerRef = useRef<PerformanceObserver | null>(null);

    const testRequestMadeRef = useRef(false);

    // Test Failed Request
    const makeDummyFailedRequest = async () => {
      // Only make the request if it hasn't been made before
      if (testRequestMadeRef.current) {
          return;
      }
      
      try {
          console.log('Making test failed request...');
          await fetch('http://localhost:18000/api/non-existent', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ test: 'data' })
          });
      } catch (error) {
          console.log('Test failed request completed');
      } finally {
          // Mark that we've made the test request
          testRequestMadeRef.current = true;
      }
  };

  const startNetworkMonitoring = () => {
    if (observerRef.current) {
        observerRef.current.disconnect();
    }

    setFailedRequests([]);

    observerRef.current = new PerformanceObserver((list) => {
        list.getEntries().forEach(async (entry) => {
            // Skip monitoring the support ticket endpoint itself
            if (entry.name.includes('/api/')) {
                return;
            }

            if (entry.entryType === 'resource') {
                try {
                    // Only monitor API calls
                    if (!entry.name.includes('/api/')) {
                        return;
                    }

                    // Avoid duplicate checks for the same URL
                    if (failedRequests.some(req => req.url === entry.name)) {
                        return;
                    }

                    console.log('Monitoring API request:', entry.name);
                    const response = await fetch(entry.name, { method: 'HEAD' });
                    
                    if (response.status >= 400) {
                        console.log('Failed request detected:', {
                            url: entry.name,
                            status: response.status,
                            duration: entry.duration
                        });
                        
                        setFailedRequests(prev => [
                            ...prev.filter(req => req.url !== entry.name), // Prevent duplicates
                            {
                                url: entry.name,
                                method: 'GET',
                                status: response.status,
                                duration: entry.duration,
                                timestamp: new Date().toISOString()
                            }
                        ]);
                    }
                } catch (error) {
                    // Only add error if not already recorded
                    setFailedRequests(prev => {
                        if (prev.some(req => req.url === entry.name)) {
                            return prev;
                        }
                        return [...prev, {
                            url: entry.name,
                            method: 'GET',
                            status: 0,
                            duration: entry.duration,
                            timestamp: new Date().toISOString(),
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }];
                    });
                }
            }
        });
    });

    observerRef.current.observe({ entryTypes: ['resource'] });
    console.log('Network monitoring started');
};

const stopNetworkMonitoring = () => {
  if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
      console.log('Network monitoring stopped');
  }
};

useEffect(() => {
  setMessages([{
      type: 'bot',
      content: 'Hello! 👋 I\'m your support assistant. Please describe the issue you\'re experiencing.',
      timestamp: new Date().toISOString()
  }]);
  
  startNetworkMonitoring();
  
  // Only make the test request if it hasn't been made
  if (!testRequestMadeRef.current) {
      setTimeout(() => {
          makeDummyFailedRequest();
      }, 1000);
  }

  return () => stopNetworkMonitoring();
}, []);

    // Screenshot Functions
    const captureScreen = async () => {
        try {
            setIsCapturing(true);
            const stream = await navigator.mediaDevices.getDisplayMedia({
                preferCurrentTab: true,
                video: {
                    cursor: "always"
                },
                audio: false
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);

            const screenshot = canvas.toDataURL('image/png');
            stream.getTracks().forEach(track => track.stop());

            setScreenshot(screenshot);
            setMessages(prev => [...prev, {
                type: 'bot',
                content: '✅ Screenshot captured! Would you like to submit the ticket now? Type "yes" to confirm or "no" to try again.',
                timestamp: new Date().toISOString()
            }]);
            setStage('confirm');
            setShowScreenshotOptions(false);
        } catch (error) {
            console.error('Screenshot failed:', error);
            setMessages(prev => [...prev, {
                type: 'bot',
                content: '❌ Failed to capture screenshot. Would you like to try again?',
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setMessages(prev => [...prev, {
                    type: 'bot',
                    content: '⚠️ File is too large. Please upload an image smaller than 5MB.',
                    timestamp: new Date().toISOString()
                }]);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setScreenshot(result);
                setMessages(prev => [...prev, {
                    type: 'bot',
                    content: '✅ Screenshot uploaded! Would you like to submit the ticket now? Type "yes" to confirm or "no" to try again.',
                    timestamp: new Date().toISOString()
                }]);
                setStage('confirm');
                setShowScreenshotOptions(false);
            };
            reader.readAsDataURL(file);
        }
    };

    // Ticket Submission
    const submitTicket = async () => {
        if (!issueDescription) return;

        try {
            setMessages(prev => [...prev, {
                type: 'bot',
                content: '🚀 Creating your support ticket...',
                timestamp: new Date().toISOString()
            }]);

            // Stop monitoring before creating ticket
            stopNetworkMonitoring();

            // Log the failed requests being sent
            console.log('Failed requests being sent:', failedRequests);

            const payload = {
                description: issueDescription,
                screenshot: screenshot,
                failedRequests: failedRequests,
                timestamp: new Date().toISOString()
            };

            // Log the complete payload
            console.log('Submitting ticket payload:', payload);

            const response = await fetch('http://localhost:18000/api/support-ticket', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const ticketData = await response.json();
            console.log('Ticket creation response:', ticketData);

            setMessages(prev => [...prev, {
                type: 'bot',
                content: `✅ Thanks! I've created ticket #${ticketData.ticketId}. Our support team will look into this shortly.`,
                timestamp: new Date().toISOString()
            }]);

            // Reset states
            setStage('greeting');
            setIssueDescription('');
            setScreenshot(null);
            setShowScreenshotOptions(false);
            setFailedRequests([]);

            // Start fresh monitoring for potential new ticket
            startNetworkMonitoring();

        } catch (error) {
            console.error('Error creating ticket:', error);
            setMessages(prev => [...prev, {
                type: 'bot',
                content: "❌ Sorry, there was an error creating your support ticket. Please try again.",
                timestamp: new Date().toISOString()
            }]);
            startNetworkMonitoring();
        }
    };

    // Message Handling
    const handleUserInput = async () => {
        if (!inputText.trim()) return;

        setMessages(prev => [...prev, {
            type: 'user',
            content: inputText,
            timestamp: new Date().toISOString()
        }]);

        switch (stage) {
            case 'greeting':
                setIssueDescription(inputText);
                setMessages(prev => [...prev, {
                    type: 'bot',
                    content: '📸 Would you like to add a screenshot? You can capture the current screen or upload an image.',
                    timestamp: new Date().toISOString()
                }]);
                setStage('screenshot');
                setShowScreenshotOptions(true);
                break;

            case 'confirm':
                if (inputText.toLowerCase().includes('yes')) {
                    await submitTicket();
                } else {
                    setMessages(prev => [...prev, {
                        type: 'bot',
                        content: '🔄 Would you like to try capturing the screenshot again?',
                        timestamp: new Date().toISOString()
                    }]);
                    setStage('screenshot');
                    setShowScreenshotOptions(true);
                }
                break;
        }

        setInputText('');
    };

    return (
        <div className="flex justify-center items-center min-h-screen p-4">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-6 w-6" />
                        <h2 className="text-xl font-semibold">Support Chat</h2>
                    </div>
                    {failedRequests.length > 0 && (
                        <div className="text-sm bg-red-500 px-2 py-1 rounded-full">
                            {failedRequests.length} Network {failedRequests.length === 1 ? 'Issue' : 'Issues'}
                        </div>
                    )}
                </div>

                {/* Chat Messages */}
                <div className="h-[500px] overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`p-3 rounded-lg max-w-[80%] ${
                                    msg.type === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-white shadow-sm border'
                                }`}
                            >
                                <div>{msg.content}</div>
                                <div className={`text-xs mt-1 ${
                                    msg.type === 'user' ? 'text-blue-100' : 'text-gray-400'
                                }`}>
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Screenshot Options */}
                    {showScreenshotOptions && (
                        <div className="flex gap-2 justify-center p-4 bg-white rounded-lg shadow-sm">
                            <button
                                onClick={captureScreen}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                disabled={isCapturing}
                            >
                                <Camera className="h-4 w-4" />
                                Capture Screen
                            </button>
                            <label className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 cursor-pointer">
                                <Upload className="h-4 w-4" />
                                Upload Image
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </label>
                        </div>
                    )}

                    {/* Screenshot Preview */}
                    {screenshot && (
                        <div className="mt-4 p-3 bg-white rounded-lg shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-medium">Screenshot Preview</h3>
                                <button
                                    onClick={() => {
                                        setScreenshot(null);
                                        setShowScreenshotOptions(true);
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <img
                                src={screenshot}
                                alt="Screenshot"
                                className="w-full h-40 object-cover rounded border cursor-pointer"
                                onClick={() => setShowPreview(true)}
                            />
                        </div>
                    )}

                    {isCapturing && (
                        <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-center">
                            📸 Capturing your screen...
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="border-t p-4 bg-white">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
                        />
<button
                            onClick={handleUserInput}
                            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                            disabled={isCapturing}
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Full Screen Preview Modal */}
            {showPreview && screenshot && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="relative max-w-4xl mx-4">
                        <button
                            onClick={() => setShowPreview(false)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <img
                            src={screenshot}
                            alt="Screenshot Full Preview"
                            className="w-full rounded-lg"
                        />
                    </div>
                </div>
            )}

            {/* Failed Requests Display */}
            {failedRequests.length > 0 && (
                <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-md z-40">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-red-600">
                            Failed Requests Detected ({failedRequests.length})
                        </h3>
                        <button 
                            onClick={() => setFailedRequests([])}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {failedRequests.map((req, idx) => (
                            <div key={idx} className="text-sm border-b border-gray-100 py-2">
                                <div className="flex justify-between">
                                    <span className="font-medium">Status: {req.status}</span>
                                    <span className="text-gray-500">
                                        {new Date(req.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="text-gray-600 truncate">{req.url}</div>
                                {req.error && (
                                    <div className="text-red-500 mt-1 text-xs">{req.error}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupportChat;