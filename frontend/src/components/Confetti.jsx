import React, { useEffect, useState } from 'react';

const Confetti = () => {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#D4A5A5', '#9B59B6', '#3498DB', '#F1C40F', '#E67E22'];
    const newPieces = [];
    
    for (let i = 0; i < 150; i++) {
      newPieces.push({
        id: i,
        left: Math.random() * 100,
        animationDuration: Math.random() * 3 + 2,
        size: Math.random() * 12 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 2,
        shape: Math.random() > 0.5 ? 'circle' : 'square'
      });
    }
    
    setPieces(newPieces);
  }, []);

  return (
    <div className="confetti-container">
      {pieces.map(piece => (
        <div
          key={piece.id}
          className={`confetti-piece ${piece.shape}`}
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            animationDuration: `${piece.animationDuration}s`,
            animationDelay: `${piece.delay}s`,
            borderRadius: piece.shape === 'circle' ? '50%' : '0'
          }}
        />
      ))}
    </div>
  );
};

export default Confetti;