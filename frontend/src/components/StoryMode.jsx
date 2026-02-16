import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Confetti from './Confetti';

const API_URL = '/api';

export default function StoryMode({ user, onExit, onComplete }) {
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [episodeData, setEpisodeData] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [completedEpisodes, setCompletedEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoryProgress();
  }, []);

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  const loadStoryProgress = async () => {
    try {
      const progressRes = await axios.get(`${API_URL}/story-progress/${user.id}`);
      setCurrentEpisode(progressRes.data.current_episode);
      setCompletedEpisodes(JSON.parse(progressRes.data.completed_episodes || '[]'));
      
      await loadEpisode(progressRes.data.current_episode);
    } catch (e) {
      console.error("Failed to load story progress", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEpisode = async (episodeNumber) => {
    try {
      const res = await axios.get(`${API_URL}/story-episode/${episodeNumber}`);
      setEpisodeData(res.data);
      setShowQuiz(false);
      setCurrentQuestion(0);
      setScore(0);
      setStars(0);
      setShowResult(false);
      setSelectedAnswer(null);
      setFeedback('');
    } catch (e) {
      console.error("Failed to load episode", e);
    }
  };

  const handleNext = () => {
    setShowQuiz(true);
  };

  const handleAnswer = (answer) => {
    setSelectedAnswer(answer);
    const isCorrect = answer === episodeData.quizzes[currentQuestion].correct_answer;
    
    if (isCorrect) {
      setFeedback("✅ Correct! Well done!");
      setScore(prev => prev + 1);
    } else {
      setFeedback(`❌ Oops! The correct answer is: ${episodeData.quizzes[currentQuestion].correct_answer}`);
    }
    
    setTimeout(() => {
      if (currentQuestion < 3) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
        setFeedback('');
      } else {
        // Calculate stars based on score
        let earnedStars = 0;
        if (score + (isCorrect ? 1 : 0) >= 4) earnedStars = 3;
        else if (score + (isCorrect ? 1 : 0) >= 3) earnedStars = 2;
        else if (score + (isCorrect ? 1 : 0) >= 2) earnedStars = 1;
        
        setStars(earnedStars);
        setShowResult(true);
        
        if (earnedStars > 0) {
          setShowConfetti(true);
        }
      }
    }, 2000);
  };

  const completeEpisode = async () => {
    const xpEarned = episodeData.episode.xp_reward * stars;
    
    try {
      await axios.post(`${API_URL}/update-story-progress`, {
        userId: user.id,
        episodeNumber: currentEpisode,
        starsEarned: stars,
        xpEarned
      });
      
      if (currentEpisode < 6) {
        setCurrentEpisode(prev => prev + 1);
        await loadEpisode(currentEpisode + 1);
      } else {
        onComplete(xpEarned, completedEpisodes.length + 1);
      }
    } catch (e) {
      console.error("Failed to update progress", e);
    }
  };

  if (isLoading) {
    return (
      <div className="story-loading">
        <div className="spinner"></div>
        <p>Loading your adventure...</p>
      </div>
    );
  }

  if (!episodeData) {
    return (
      <div className="story-error">
        <h2>😢 Oops!</h2>
        <p>Could not load the story. Please try again.</p>
        <button onClick={onExit}>Back to Menu</button>
      </div>
    );
  }

  return (
    <div className="story-mode-container">
      {showConfetti && <Confetti />}
      
      <div className="story-header">
        <button className="exit-btn" onClick={onExit}>🚪 Exit Story</button>
        <div className="story-progress">
          <span>Episode {currentEpisode}/6</span>
          <div className="stars-display">
            {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </div>
        </div>
      </div>

      {!showQuiz ? (
        <div className="story-reading">
          <h2>{episodeData.episode.title}</h2>
          <div className="story-content">
            <p>{episodeData.episode.content}</p>
          </div>
          <button className="primary large" onClick={handleNext}>
            📝 Take the Quiz
          </button>
        </div>
      ) : !showResult ? (
        <div className="story-quiz">
          <div className="quiz-header">
            <h3>Quiz Time!</h3>
            <div className="quiz-progress">
              Question {currentQuestion + 1} of 4
            </div>
          </div>
          
          <div className="question-container">
            <p className="question-text">{episodeData.quizzes[currentQuestion].question_text}</p>
            
            <div className="quiz-options">
              {['option_a', 'option_b', 'option_c', 'option_d'].map((opt, index) => (
                <button
                  key={opt}
                  className={`quiz-option ${selectedAnswer === episodeData.quizzes[currentQuestion][opt] ? 'selected' : ''} ${feedback && selectedAnswer === episodeData.quizzes[currentQuestion][opt] ? (selectedAnswer === episodeData.quizzes[currentQuestion].correct_answer ? 'correct' : 'wrong') : ''}`}
                  onClick={() => !selectedAnswer && handleAnswer(episodeData.quizzes[currentQuestion][opt])}
                  disabled={selectedAnswer !== null}
                >
                  <span className="option-letter">{String.fromCharCode(65 + index)}.</span>
                  {episodeData.quizzes[currentQuestion][opt]}
                </button>
              ))}
            </div>
            
            {feedback && (
              <div className={`feedback ${selectedAnswer === episodeData.quizzes[currentQuestion].correct_answer ? 'correct-feedback' : 'wrong-feedback'}`}>
                {feedback}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="story-result">
          <h2>Episode Complete! 🎉</h2>
          <div className="result-stats">
            <div className="stat">
              <span className="stat-label">Correct Answers:</span>
              <span className="stat-value">{score}/4</span>
            </div>
            <div className="stat">
              <span className="stat-label">Stars Earned:</span>
              <span className="stat-value">{'⭐'.repeat(stars)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">XP Earned:</span>
              <span className="stat-value">{episodeData.episode.xp_reward * stars} XP</span>
            </div>
          </div>
          
          <button className="primary large" onClick={completeEpisode}>
            {currentEpisode < 6 ? 'Next Episode →' : 'Complete Story!'}
          </button>
        </div>
      )}
    </div>
  );
}