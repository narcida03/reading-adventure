import React from 'react';

export default function Dice({ value, rolling }) {
  const diceFaces = {
    1: '⚀',
    2: '⚁',
    3: '⚂',
    4: '⚃',
    5: '⚄',
    6: '⚅'
  };

  return (
    <div className={`dice-container ${rolling ? 'rolling' : ''}`}>
      <div className="dice">
        <span className="dice-face">{diceFaces[value] || '⚀'}</span>
        <span className="dice-value">{value}</span>
      </div>
    </div>
  );
}