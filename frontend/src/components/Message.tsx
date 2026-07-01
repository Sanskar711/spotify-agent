import React from 'react';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
}

const Message: React.FC<MessageProps> = ({ role, content }) => {
  const formatMessage = (text: string) => {
    return text.split('\n').map((line, lineIndex) => {
      const parts = line.split(/(https?:\/\/[^\s]+)/g);
      
      return (
        <React.Fragment key={lineIndex}>
          {parts.map((part, partIndex) => {
            if (part.match(/^https?:\/\/[^\s]+$/)) {
              return (
                <a
                  key={partIndex}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1DB954] hover:underline"
                >
                  {part}
                </a>
              );
            }
            // Render **bold** segments.
            return part.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
              seg.startsWith('**') && seg.endsWith('**') ? (
                <strong key={i}>{seg.slice(2, -2)}</strong>
              ) : (
                <React.Fragment key={i}>{seg}</React.Fragment>
              )
            );
          })}
          {lineIndex < text.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`rounded-lg px-4 py-3 text-sm max-w-[75%] whitespace-pre-wrap ${
        role === 'user' ? 'bg-[#1DB954] text-white' : 'bg-[#2a2a2a] text-white'
      }`}>
        {formatMessage(content)}
      </div>
    </div>
  );
};

export default Message; 