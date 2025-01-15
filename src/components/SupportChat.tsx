import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, Camera, Upload, Trash2, X } from 'lucide-react';

const SupportChat = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [stage, setStage] = useState('greeting');
  const [issueDescription, setIssueDescription] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [showScreenshotOptions, setShowScreenshotOptions] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [networkLogs, setNetworkLogs] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setMessages([
      { 
        type: 'bot', 
        content: 'Hello! 👋 I\'m your support assistant. Please describe the issue you\'re experiencing.',
        timestamp: new Date().toISOString()
      }
    ]);
  }, []);

  const handleUserInput = async () => {
    if (!inputText.trim()) return;

    setMessages(prev => [...prev, { 
      type: 'user', 
      content: inputText,
      timestamp: new Date().toISOString()
    }]);

    if (stage === 'greeting') {
      setIssueDescription(inputText);
      setMessages(prev => [...prev, {
        type: 'bot',
        content: '📸 Would you like to add a screenshot? You can capture the current screen or upload an image.',
        timestamp: new Date().toISOString()
      }]);
      setStage('screenshot');
      setShowScreenshotOptions(true);
    }

    setInputText('');
  };

  const captureScreen = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        preferCurrentTab: true,
        video: { cursor: "always" },
        audio: false
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const screenshot = canvas.toDataURL('image/png');
      stream.getTracks().forEach(track => track.stop());
      
      setScreenshot(screenshot);
      setShowScreenshotOptions(false);
      
      setMessages(prev => [...prev, {
        type: 'bot',
        content: '✅ Screenshot captured! Type "yes" to submit or "no" to try again.',
        timestamp: new Date().toISOString()
      }]);
      
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

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex items-center gap-2">
          <MessageCircle className="h-6 w-6" />
          <h2 className="text-xl font-semibold">Support Chat</h2>
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
                {msg.timestamp && (
                  <div className={`text-xs mt-1 ${
                    msg.type === 'user' ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                )}
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
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => setScreenshot(e.target.result);
                      reader.readAsDataURL(file);
                    }
                  }}
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
                  onClick={() => setScreenshot(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <img 
                src={screenshot} 
                alt="Screenshot" 
                className="w-full h-40 object-cover rounded border"
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
      {showPreview && (
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
    </div>
  );
};

export default SupportChat;