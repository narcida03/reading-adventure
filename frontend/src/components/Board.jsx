import React from 'react';

export default function Board({ players, gameMode }) {
  const size = 10;
  const tiles = [];
  
  // Create 10x10 grid with alternating row directions (snake pattern)
  for (let row = size - 1; row >= 0; row--) {
    const rowTiles = [];
    for (let col = 0; col < size; col++) {
      // Calculate tile number (1-100) in snake pattern
      const tileNumber = row % 2 === 0 
        ? (row * size) + col + 1 
        : (row * size) + (size - col);
      
      // Find players on this tile
      const playersOnTile = players?.filter(p => p.pos === tileNumber) || [];
      
      // Check if tile is a snake or ladder
      const isSnakeStart = gameMode === 'Snakes' && [16, 47, 49, 56, 62, 64, 87, 93, 95, 98].includes(tileNumber);
      const isLadderStart = gameMode === 'Snakes' && [1, 4, 9, 21, 28, 36, 51, 71, 80].includes(tileNumber);
      
      rowTiles.push(
        <div 
          key={col} 
          className={`board-tile ${isSnakeStart ? 'snake-tile' : ''} ${isLadderStart ? 'ladder-tile' : ''}`}
        >
          <span className="tile-number">{tileNumber}</span>
          <div className="player-tokens">
            {playersOnTile.map((p, i) => (
              <div
                key={i}
                className="player-token"
                style={{ backgroundColor: p.color }}
                title={p.username}
              />
            ))}
          </div>
          {isSnakeStart && <span className="tile-icon">🐍</span>}
          {isLadderStart && <span className="tile-icon">🪜</span>}
        </div>
      );
    }
    tiles.push(
      <div key={row} className="board-row">
        {rowTiles}
      </div>
    );
  }

  return (
    <div className="game-board">
      <h3 className="board-title">Game Board</h3>
      <div className="board-grid">
        {tiles}
      </div>
    </div>
  );
}