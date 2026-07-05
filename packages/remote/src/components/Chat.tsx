import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (message: string) => void;
}

export function Chat({ onSend }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ text: string; from: 'me' | 'ai'; time: number }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { text, from: 'me', time: Date.now() }]);
    setInput('');
    onSend(text);
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div ref={scrollRef} className="h-48 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-gray-600 text-xs text-center py-8">
            Send a message to control your browser
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm p-2 rounded-lg max-w-[85%] ${
              msg.from === 'me'
                ? 'bg-indigo-600 ml-auto'
                : 'bg-gray-800 mr-auto'
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <div className="flex border-t border-gray-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none"
          placeholder="Type a command..."
        />
        <button
          onClick={handleSend}
          className="px-4 py-3 text-indigo-400 hover:text-indigo-300 font-semibold text-sm transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
