import React, { useState, useEffect, useRef } from "react";
import { Send, Copy, ThumbsUp, ThumbsDown, Bot, User, Play, Square, Image, Loader2, ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useConversationParticipants } from "@/hooks/use-conversation-participants";
import { InlineLessonViewer } from "./inline-lesson-viewer";
import { parseStructuredLanguageLesson } from "@/lib/languageLesson";
import { LessonAudioControl } from "./lesson-audio-control";
import type { Message } from "@shared/schema";

interface ChatInterfaceProps {
  messages: (Message & { 
    metadata?: any; 
    senderName?: string; 
    imageUrl?: string; 
    imagePrompt?: string;
    _origContent?: string;
    _showInteractive?: boolean;
    _showAudio?: boolean;
  })[];
  onSendMessage: (message: string) => void;
  conversationId?: number;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  agentId?: number;
  voiceEnabled?: boolean;
  imageEnabled?: boolean;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  conversationId,
  isLoading = false,
  disabled = false,
  placeholder = "Type your message...",
  agentId,
  voiceEnabled = false,
  imageEnabled = false
}: ChatInterfaceProps) {
  const { toast } = useToast();
  const [inputMessage, setInputMessage] = useState("");
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [generatingImage, setGeneratingImage] = useState<number | null>(null);
  const [interactiveLessonId, setInteractiveLessonId] = useState<number | null>(null);
  const [showInlineLesson, setShowInlineLesson] = useState<string | null>(null);
  const { participants } = useConversationParticipants(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const [lastUserMessageId, setLastUserMessageId] = useState<number | null>(null);
  const lastMessageCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  // Handle scroll events to show/hide scroll-to-top button and track user scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      setShowScrollTop(scrollTop > 200);
      
      // Track if user has manually scrolled up (more than 50px from bottom)
      setUserHasScrolledUp(distanceFromBottom > 50);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Smart scrolling logic based on user interaction and message updates
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || messages.length === 0) return;

    // Always scroll to bottom on initial chat load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      setTimeout(() => {
        container.scrollTo({ 
          top: container.scrollHeight, 
          behavior: 'smooth' 
        });
      }, 100);
      return;
    }

    // Check if we have a new message
    const hasNewMessages = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (!hasNewMessages) return;

    // Get the latest message
    const latestMessage = messages[messages.length - 1];
    
    // If user sent a message, scroll to show their question at the top of viewport
    if (latestMessage.role === 'user') {
      setLastUserMessageId(latestMessage.id);
      // Find user's message element and scroll to it
      setTimeout(() => {
        const messageElements = container.querySelectorAll('[data-message-id]');
        const userMessageElement = Array.from(messageElements).find(el => 
          el.getAttribute('data-message-id') === latestMessage.id?.toString()
        );
        
        if (userMessageElement) {
          const containerRect = container.getBoundingClientRect();
          const messageRect = userMessageElement.getBoundingClientRect();
          const relativeTop = messageRect.top - containerRect.top;
          
          container.scrollTo({ 
            top: container.scrollTop + relativeTop - 20, // 20px padding from top
            behavior: 'smooth' 
          });
        }
      }, 50);
    }
    
    // If AI responded and user hasn't manually scrolled up, ensure the response is visible
    else if (latestMessage.role === 'assistant' && !userHasScrolledUp) {
      // Scroll to show both user question and AI response
      setTimeout(() => {
        container.scrollTo({ 
          top: container.scrollHeight, 
          behavior: 'smooth' 
        });
      }, 100);
    }
    
    // Reset user scroll state when new message arrives and they're near bottom
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 100) {
      setUserHasScrolledUp(false);
    }
    
  }, [messages, userHasScrolledUp]);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || disabled || isLoading) return;
    
    onSendMessage(inputMessage);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };



  // Function to start interactive lesson with voice and images
  const startInteractiveLesson = async (messageId: number, lessonContent: string) => {
    if (!agentId || !voiceEnabled || !imageEnabled) return;
    
    try {
      setInteractiveLessonId(messageId);
      
      // Extract words from the lesson content
      const words = extractWordsFromLesson(lessonContent);
      
      if (words.length === 0) {
        toast({
          title: "No Words Found",
          description: "Could not detect vocabulary words in this lesson.",
          variant: "destructive",
        });
        setInteractiveLessonId(null);
        return;
      }

      // Create interactive lesson display
      await displayInteractiveLesson(words, messageId);
      
    } catch (error) {
      console.error("Interactive lesson error:", error);
      toast({
        title: "Interactive Lesson Failed",
        description: "Could not start interactive lesson mode.",
        variant: "destructive",
      });
      setInteractiveLessonId(null);
    }
  };

  // Extract vocabulary words from lesson content
  const extractWordsFromLesson = (content: string): string[] => {
    // Look for word lists in various formats
    const words: string[] = [];
    
    // Pattern 1: Look for numbered lists like "1. hello 2. water"
    const numberedPattern = /\d+\.\s*([a-zA-ZÀ-ÿ\u0100-\u017F\u0400-\u04FF\u4E00-\u9FFF]+)/g;
    let match;
    while ((match = numberedPattern.exec(content)) !== null) {
      words.push(match[1].toLowerCase());
    }
    
    // Pattern 2: Look for comma-separated words
    if (words.length === 0) {
      const commaPattern = /([a-zA-ZÀ-ÿ\u0100-\u017F\u0400-\u04FF\u4E00-\u9FFF]+)(?:,|\sand\s)/g;
      while ((match = commaPattern.exec(content)) !== null) {
        if (match[1].length > 2) { // Filter out short words like "a", "is"
          words.push(match[1].toLowerCase());
        }
      }
    }
    
    // Pattern 3: Look for the universal first 10 words in any language
    const universalWords = ['hello', 'water', 'food', 'house', 'friend', 'book', 'good', 'yes', 'no', 'thank'];
    const foundUniversal = universalWords.filter(word => 
      content.toLowerCase().includes(word) || 
      content.toLowerCase().includes(word + 's') ||
      content.toLowerCase().includes(word + 'ing')
    );
    
    if (foundUniversal.length >= 5) {
      words.push(...foundUniversal);
    }
    
    // Remove duplicates and limit to 10 words
    return Array.from(new Set(words)).slice(0, 10);
  };

  // Helper function to detect if a message contains a language lesson
  const isLanguageLessonMessage = (content: string): boolean => {
    if (!content) return false;
    if (parseStructuredLanguageLesson(content)) return true;
    
    // Look for word-translation patterns
    const dashPattern = /[a-zA-ZÀ-ÿ\u0100-\u017F\u0400-\u04FF\u4E00-\u9FFF]{2,}\s*[-–]\s*[a-zA-Z\s]{2,}/g;
    const dashMatches = (content.match(dashPattern) || []).length;

    // Look for parenthetical translations
    const parenPattern = /[a-zA-ZÀ-ÿ\u0100-\u017F\u0400-\u04FF\u4E00-\u9FFF]{2,}\s*\([a-zA-Z\s]{2,}\)/g;
    const parenMatches = (content.match(parenPattern) || []).length;

    // Look for comma-separated word lists (e.g., "hola, agua, comida, casa, amigo")
    const commaListPattern = /(?:^|\n)(?:\s*[a-zA-ZÀ-ÿ\u0100-\u017F\u0400-\u04FF\u4E00-\u9FFF]+,\s*){4,}[a-zA-ZÀ-ÿ\u0100-\u017F\u0400-\u04FF\u4E00-\u9FFF]+/i;
    const hasCommaList = commaListPattern.test(content);

    // Look for lesson indicators
    const hasLessonKeywords = /\b(lesson|vocabulary|words|practice|learn)\b/i.test(content);

    return (dashMatches >= 3 || parenMatches >= 3 || hasCommaList) && hasLessonKeywords;
  };

  // Parse lesson content into translation and target-only sections
  function parseLessonContent(content: string) {
    const structured = parseStructuredLanguageLesson(content);
    if (structured) return structured;
    const pairs: { target: string; english: string }[] = [];

    // Pattern 1: word (translation) anywhere in the content
    const parenRegex = /([^()\n]+?)\s*\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = parenRegex.exec(content)) !== null) {
      const target = match[1]
        .trim()
        .replace(/^[\d\.\)\s-]+/, '')
        .replace(/[\s,]+$/, '');
      const english = match[2].trim();
      if (target && english) {
        pairs.push({ target, english });
      }
    }

    // Pattern 2: word - translation format
    const dashRegex = /([^\n]+?)\s*[-–—]\s*([^\n]+)/g;
    while ((match = dashRegex.exec(content)) !== null) {
      const target = match[1]
        .trim()
        .replace(/^[\d\.\)\s-]+/, '')
        .replace(/[\s,]+$/, '');
      const english = match[2].trim();
      if (target && english) {
        pairs.push({ target, english });
      }
    }
    // Fallback: handle comma-separated word lists without translations
    if (pairs.length < 5) {
      const defaults = ['hello', 'water', 'food', 'house', 'friend', 'book', 'good', 'yes', 'no', 'thank you'];

      const sections = content.split(/Here are sentences using these words:/i);
      const wordSection = sections[0];
      const sentenceSection = sections[1];

      if (wordSection) {
        const wordList = wordSection
          .split(/[\n,]/)
          .map(w => w.trim())
          .filter(Boolean)
          .slice(0, defaults.length);

        wordList.forEach((w, i) => {
          pairs.push({ target: w, english: defaults[i] || '' });
        });
      }

      if (sentenceSection) {
        const sentenceTranslations = [
          'Hello how are you',
          'I need water',
          'The Food is delicious',
          'My house is big',
          'He is my friend',
          'I am reading a book',
          'It is a nice day.',
          'Yes, I understand',
          "I don't want this",
          'Thank you for your help'
        ];

        const sentences = sentenceSection
          .split(/\n/)
          .map(s => s.trim())
          .filter(Boolean);

        sentences.forEach((s, idx) => {
          const clean = s.replace(/^\d+\.\s*/, '').trim();
          if (clean) {
            pairs.push({ target: clean, english: sentenceTranslations[idx] || '' });
          }
        });
      }
    }

    const wordPairs = pairs.slice(0, 10);
    const sentencePairs = pairs.slice(10, 20);

    const translationText = [
      'Section 1',
      '',
      ...wordPairs.map((p, i) => `${i + 1}. ${p.target} - ${p.english}`),
      '',
      'Here are sentences using these words:',
      '',
      ...sentencePairs.map((p, i) => `${i + 1}. ${p.target} - ${p.english}`)
    ].join('\n');

    const targetText = [
      ...wordPairs.map(p => p.target),
      '',
      ...sentencePairs.map(p => p.target)
    ].join('\n');

    return {
      hasLesson: wordPairs.length >= 5,
      translationText,
      targetText
    };
  }

  // Display interactive lesson with voice and images
  const displayInteractiveLesson = async (words: string[], messageId: number) => {
    const lessonWindow = window.open('', '_blank', 'width=1000,height=800');
    
    if (!lessonWindow) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups to use the interactive lesson feature.",
        variant: "destructive",
      });
      setInteractiveLessonId(null);
      return;
    }

    lessonWindow.document.write(`
      <html>
        <head>
          <title>Interactive Language Lesson</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
            }
            .lesson-container { 
              max-width: 800px; 
              margin: 0 auto; 
              background: rgba(0,0,0,0.8); 
              padding: 40px; 
              border-radius: 20px; 
              box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            }
            .word-display {
              font-size: 4em;
              font-weight: bold;
              margin: 40px 0;
              padding: 20px;
              background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
              transition: all 0.5s ease;
            }
            .word-display.highlighted {
              transform: scale(1.1);
              filter: brightness(1.3);
            }
            .image-container {
              width: 300px;
              height: 300px;
              margin: 20px auto;
              border-radius: 15px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0,0,0,0.5);
              background: #333;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .image-container img {
              max-width: 100%;
              max-height: 100%;
              object-fit: cover;
            }
            .progress-bar {
              width: 100%;
              height: 10px;
              background: rgba(255,255,255,0.2);
              border-radius: 5px;
              margin: 20px 0;
              overflow: hidden;
            }
            .progress-fill {
              height: 100%;
              background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
              width: 0%;
              transition: width 0.5s ease;
            }
            .status {
              font-size: 1.2em;
              margin: 20px 0;
              opacity: 0.8;
            }
            .controls {
              margin-top: 30px;
            }
            .control-btn {
              background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
              border: none;
              color: white;
              padding: 15px 30px;
              margin: 0 10px;
              border-radius: 25px;
              font-size: 1.1em;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            .control-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }
            .loading {
              color: #4ecdc4;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="lesson-container">
            <h1>🎯 Interactive Language Lesson</h1>
            <div class="word-display" id="wordDisplay">Starting lesson...</div>
            <div class="image-container" id="imageContainer">
              <div class="loading">Generating image...</div>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="status" id="status">Preparing lesson...</div>
            <div class="controls">
              <button class="control-btn" onclick="pauseLesson()">⏸️ Pause</button>
              <button class="control-btn" onclick="resumeLesson()">▶️ Resume</button>
              <button class="control-btn" onclick="restartLesson()">🔄 Restart</button>
            </div>
          </div>
          
          <script>
            let currentWordIndex = 0;
            let isPaused = false;
            let words = ${JSON.stringify(words)};
            let agentId = ${agentId};
            
            async function playWordWithImage(word, index) {
              if (isPaused) return;
              
              const wordDisplay = document.getElementById('wordDisplay');
              const imageContainer = document.getElementById('imageContainer');
              const status = document.getElementById('status');
              const progressFill = document.getElementById('progressFill');
              
              // Update progress
              progressFill.style.width = ((index + 1) / words.length * 100) + '%';
              
              // Display word with highlight effect
              wordDisplay.textContent = word;
              wordDisplay.classList.add('highlighted');
              status.textContent = 'Generating image for: ' + word;
              
              // Generate image for the word
              try {
                imageContainer.innerHTML = '<div class="loading">Loading image...</div>';
                
                // Use vocabulary cache system for efficient image loading
                const imageResponse = await fetch('/api/vocabulary-cache/word/' + encodeURIComponent(word) + '?agentId=' + agentId, {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' }
                });
                
                if (imageResponse.ok) {
                  const imageResult = await imageResponse.json();
                  if (imageResult.success) {
                    imageContainer.innerHTML = '<img src="' + imageResult.imageUrl + '" alt="' + word + '">';
                    // Log cache performance
                    console.log('📸 Image loaded for "' + word + '" - ' + (imageResult.isCached ? 'CACHE HIT' : 'GENERATED NEW'));
                  } else {
                    imageContainer.innerHTML = '<div class="loading">Image generation failed</div>';
                  }
                } else {
                  imageContainer.innerHTML = '<div class="loading">Image generation failed</div>';
                }
              } catch (error) {
                console.error('Image loading error:', error);
                imageContainer.innerHTML = '<div class="loading">Image unavailable</div>';
              }
              
              // Play audio for the word
              status.textContent = 'Playing audio: ' + word;
              
              try {
                const audioResponse = await fetch('/api/speech', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: word, agentId: agentId })
                });
                
                if (audioResponse.ok) {
                  const audioBlob = await audioResponse.blob();
                  const audioUrl = URL.createObjectURL(audioBlob);
                  const audio = new Audio(audioUrl);
                  
                  audio.onended = () => {
                    wordDisplay.classList.remove('highlighted');
                    URL.revokeObjectURL(audioUrl);
                    
                    // Move to next word after 1 second pause
                    setTimeout(() => {
                      if (!isPaused && index + 1 < words.length) {
                        playWordWithImage(words[index + 1], index + 1);
                      } else if (index + 1 >= words.length) {
                        status.textContent = '🎉 Lesson Complete! Great job!';
                        wordDisplay.textContent = '✅ Lesson Finished';
                      }
                    }, 1000);
                  };
                  
                  await audio.play();
                } else {
                  throw new Error('Audio generation failed');
                }
              } catch (error) {
                console.error('Audio error:', error);
                status.textContent = 'Audio unavailable for: ' + word;
                wordDisplay.classList.remove('highlighted');
                
                // Continue to next word even if audio fails
                setTimeout(() => {
                  if (!isPaused && index + 1 < words.length) {
                    playWordWithImage(words[index + 1], index + 1);
                  } else if (index + 1 >= words.length) {
                    status.textContent = '🎉 Lesson Complete!';
                    wordDisplay.textContent = '✅ Lesson Finished';
                  }
                }, 2000);
              }
            }
            
            function pauseLesson() {
              isPaused = true;
              document.getElementById('status').textContent = '⏸️ Lesson Paused';
            }
            
            function resumeLesson() {
              if (isPaused) {
                isPaused = false;
                if (currentWordIndex < words.length) {
                  playWordWithImage(words[currentWordIndex], currentWordIndex);
                }
              }
            }
            
            function restartLesson() {
              currentWordIndex = 0;
              isPaused = false;
              document.getElementById('progressFill').style.width = '0%';
              playWordWithImage(words[0], 0);
            }
            
            // Start the lesson
            setTimeout(() => {
              playWordWithImage(words[0], 0);
            }, 1000);
          </script>
        </body>
      </html>
    `);

    // Reset state after lesson window is closed
    setTimeout(() => {
      setInteractiveLessonId(null);
    }, 2000);

    toast({
      title: "Interactive Lesson Started",
      description: `Interactive lesson with ${words.length} words opened in new window`,
    });
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard.",
    });
  };

  const playAudio = async (messageId: number, text: string) => {
    if (!agentId || !voiceEnabled) return;
    
    try {
      setPlayingAudio(messageId);
      
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, agentId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Network error" }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Add mobile-specific audio settings
      audio.preload = "auto";
      audio.volume = 1.0;
      
      audio.onended = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = (e) => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
        console.error("Audio playback error:", e);
        toast({
          title: "Playback Error",
          description: "Failed to play audio. Try again or check your device audio settings.",
          variant: "destructive",
        });
      };

      // Mobile-friendly play attempt with better error handling
      try {
        await audio.play();
      } catch (playError) {
        console.error("Play error:", playError);
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
        
        // Specific error message for mobile autoplay issues
        if ((playError as Error).name === "NotAllowedError") {
          toast({
            title: "Audio Blocked",
            description: "Please enable audio playback in your browser settings.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Playback Error",
            description: "Unable to play audio. This may be due to browser restrictions on mobile.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      setPlayingAudio(null);
      console.error("TTS error:", error);
      toast({
        title: "TTS Error",
        description: error instanceof Error ? error.message : "Failed to generate speech",
        variant: "destructive",
      });
    }
  };

  const stopAudio = () => {
    setPlayingAudio(null);
  };

  const generateImage = async (messageId: number, text: string) => {
    if (!agentId || !imageEnabled) return;
    
    try {
      setGeneratingImage(messageId);
      
      const response = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt: text, 
          agentId 
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const result = await response.json();
      
      // Note: Image will open in new window - messages array is read-only in this component
      
      // Also open in new window as backup
      const imageWindow = window.open('', '_blank', 'width=800,height=600');
      if (imageWindow) {
        imageWindow.document.write(`
          <html>
            <head>
              <title>Generated Image</title>
              <style>
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
                img { max-width: 100%; height: auto; border-radius: 8px; }
                .prompt { margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 4px; }
                .actions { margin-top: 20px; }
                button { background: #0066cc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px; }
                button:hover { background: #0052a3; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Generated Image</h2>
                <div class="prompt"><strong>Prompt:</strong> ${text}</div>
                <img src="${result.url}" alt="Generated image" />
                <div class="actions">
                  <button onclick="window.open('${result.url}', '_blank')">Open Full Size</button>
                  <button onclick="navigator.clipboard.writeText('${result.url}')">Copy URL</button>
                </div>
              </div>
            </body>
          </html>
        `);
      }
      
      toast({
        title: "Image Generated",
        description: "Image added to chat and opened in new window",
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate image",
        variant: "destructive",
      });
    } finally {
      setGeneratingImage(null);
    }
  };

  // Use original messages without expansion - handle two-section layout in rendering
  const displayMessages = messages;

  return (
    <div className="flex flex-col h-full">
      {participants && (
        <div className="border-b border-white p-4 flex space-x-4 items-center bg-black">
          {participants.user && (
            <div className="flex items-center space-x-1 text-sm text-white">
              <User className="h-4 w-4" />
              <span>{participants.user.firstName || participants.user.id}</span>
            </div>
          )}
          {participants.agent && (
            <div className="flex items-center space-x-1 text-sm text-white">
              <Bot className="h-4 w-4" />
              <span>{participants.agent.name}</span>
            </div>
          )}
        </div>
      )}
      {/* Chat Messages */}
      <div ref={scrollContainerRef} className="flex-1 p-6 relative" style={{ overflowY: 'scroll', minHeight: 0 }}>
        <div className="space-y-4">
          {displayMessages.length === 0 ? (
            <div className="text-center">
              <span className="px-3 py-1 bg-black text-white text-sm rounded-full border border-white">
                Conversation started
              </span>
            </div>
          ) : (
            displayMessages.map((message, index) => (
              <div
                key={`${message.id}-${index}`}
                data-message-id={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-lg rounded-lg px-4 py-2 ${
                  message.role === "user" 
                    ? "bg-black text-white border border-white" 
                    : "bg-black text-white border border-white"
                }`}>
                  <div className="flex items-start space-x-2">
                    {message.role === "assistant" && (
                      <div className="flex items-center space-x-1">
                        <Bot className="h-4 w-4 mt-1 text-white flex-shrink-0" />
                        <span className="text-xs text-white">
                          {message.senderName || participants?.agent?.name || "Agent"}
                        </span>
                      </div>
                    )}
                    {message.role === "user" && (
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4 mt-1 text-white flex-shrink-0" />
                        <span className="text-xs text-white">
                          {message.senderName || participants?.user?.handle || participants?.user?.firstName || "User"}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      {message.imageUrl ? (
                        <div className="space-y-2">
                          <p className="text-sm">Generated Image: {message.imagePrompt}</p>
                          <img
                            src={message.imageUrl}
                            alt="Generated image"
                            className="max-w-full h-auto rounded-lg border border-white/20" 
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => window.open(message.imageUrl, '_blank')}
                              className="text-xs text-white/70 hover:text-white underline"
                            >
                              Open Full Size
                            </button>
                            <button
                              onClick={() => message.imageUrl && navigator.clipboard.writeText(message.imageUrl)}
                              className="text-xs text-white/70 hover:text-white underline"
                            >
                              Copy URL
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {(() => {
                            const messageContent = message._origContent ?? message.content;
                            const isLanguageLesson = message.role === "assistant" && isLanguageLessonMessage(messageContent);
                            
                            if (isLanguageLesson) {
                              const parsed = parseLessonContent(messageContent);
                              
                              if (parsed.hasLesson) {
                                return (
                                  <div className="space-y-4">
                                    {/* Section 1: Vocabulary with Translations (Visual Reference) */}
                                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                                      <h4 className="text-sm font-semibold text-gray-300 mb-2">📚 Vocabulary & Translations</h4>
                                      <p className="text-sm whitespace-pre-line text-gray-200">{parsed.translationText}</p>
                                    </div>
                                    
                                    {/* Section 2: Native Practice (Audio Section) */}
                                    <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                                      <h4 className="text-sm font-semibold text-blue-300 mb-2">🎯 Practice (Target Language Only)</h4>
                                      <p className="text-sm whitespace-pre-line text-white">{parsed.targetText}</p>
                                      
                                      {/* Play Audio Button for Native Content Only */}
                                      <LessonAudioControl enabled={voiceEnabled}
                                        playing={playingAudio === message.id}
                                        disabled={playingAudio !== null && playingAudio !== message.id}
                                        onClick={() => playingAudio === message.id ? stopAudio() : playAudio(message.id, parsed.targetText)} />
                                    </div>
                                  </div>
                                );
                              }
                            }
                            
                            // Default display for non-lesson content
                            return <p className="text-sm whitespace-pre-line">{messageContent}</p>;
                          })()}

                          {/* Inline Interactive Lesson Display */}
                          {message.role === "assistant" && message._showInteractive !== false && isLanguageLessonMessage(message._origContent ?? message.content) && showInlineLesson === (message._origContent ?? message.content) && (
                            <div className="mt-3">
                              <InlineLessonViewer
                                lessonContent={message._origContent ?? message.content}
                                onClose={() => setShowInlineLesson(null)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Big TTS Play Button for Non-Language Assistant Messages */}
                      {message.role === "assistant" && voiceEnabled && message._showAudio !== false && !isLanguageLessonMessage(message._origContent ?? message.content) && (
                        <div className="mt-3 flex justify-center">
                          <Button
                            variant={playingAudio === message.id ? "destructive" : "default"}
                            size="lg"
                            onClick={() => playingAudio === message.id ? stopAudio() : playAudio(message.id, message.content)}
                            disabled={playingAudio !== null && playingAudio !== message.id}
                            className="px-6 py-3 text-lg font-semibold"
                          >
                            {playingAudio === message.id ? (
                              <>
                                <Square className="h-5 w-5 mr-2" />
                                Stop Audio
                              </>
                            ) : (
                              <>
                                <Play className="h-5 w-5 mr-2" />
                                Play Audio
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {/* Interactive Lesson Button for Language Teaching Agents */}
                      {message.role === "assistant" && message._showInteractive !== false && isLanguageLessonMessage(message._origContent ?? message.content) && (
                        <div className="mt-3 flex justify-center">
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={() => setShowInlineLesson(showInlineLesson === (message._origContent ?? message.content) ? null : (message._origContent ?? message.content))}
                            className="px-6 py-3 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                          >
                            {showInlineLesson === (message._origContent ?? message.content) ? (
                              <>
                                <Sparkles className="h-5 w-5 mr-2" />
                                Hide Interactive Lesson
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-5 w-5 mr-2" />
                                Show Interactive Lesson
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {/* Big Image Generation Button for Assistant Messages */}
                      {message.role === "assistant" && imageEnabled && (
                        <div className="mt-3 flex justify-center">
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => generateImage(message.id, message.content)}
                            disabled={generatingImage !== null}
                            className="px-6 py-3 text-lg font-semibold"
                          >
                            {generatingImage === message.id ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Generating Image...
                              </>
                            ) : (
                              <>
                                <Image className="h-5 w-5 mr-2" />
                                Generate Image
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {message.role === "assistant" && message.metadata && (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200">
                          <span className="text-xs text-slate-500">
                            Generated in {message.metadata.responseTime}ms
                          </span>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => copyMessage(message.content)}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-lg bg-black border border-white rounded-lg px-4 py-3 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span className="text-sm text-white font-medium">Agent is thinking...</span>
                </div>
              </div>
            </div>
          )}
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Scroll to top button */}
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            className="absolute top-4 right-4 rounded-full w-10 h-10 p-0 shadow-lg bg-black border border-white hover:bg-gray-800 text-white hover:text-white z-10"
            variant="outline"
            size="sm"
            title="Scroll to top"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-white p-4 bg-black">
        <div className="flex space-x-3">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="flex-1 bg-black text-white border-white placeholder:text-gray-400 focus:bg-black focus:text-white"
            style={{ backgroundColor: '#000000', color: '#ffffff' }}
          />
          <Button 
            onClick={handleSendMessage}
            disabled={disabled || !inputMessage.trim() || isLoading}
            className="bg-white hover:bg-gray-100 text-black"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
