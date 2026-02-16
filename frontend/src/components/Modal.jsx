import React from 'react';

export default function Modal({ title, message, onClose, showChoices = false }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>
        <div className="modal-buttons">
          {showChoices ? (
            <>
              <button className="modal-button primary" onClick={() => onClose('continue')}>
                Continue Game
              </button>
              <button className="modal-button secondary" onClick={() => onClose('new')}>
                Start New
              </button>
            </>
          ) : (
            <button className="modal-button primary" onClick={onClose}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}