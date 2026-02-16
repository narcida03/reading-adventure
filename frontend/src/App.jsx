import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Board from './components/Board';
import Dice from './components/Dice';
import Modal from './components/Modal';
import Confetti from './components/Confetti';
import StoryMode from './components/StoryMode';

const API_URL = '/api';

// Game constants
const SNAKES_AND_LADDERS = {
  snakes: {
    16: 6, 47: 26, 49: 11, 56: 53, 62: 19,
    64: 60, 87: 24, 93: 73, 95: 75, 98: 78
  },
  ladders: {
    1: 38, 4: 14, 9: 31, 21: 42, 28: 84,
    36: 44, 51: 67, 71: 91, 80: 100
  }
};

// Level requirements
const LEVEL_REQUIREMENTS = {
  1: 0,
  2: 200,
  3: 500,
  4: 900,
};

export default function App() {
  // View states
  const [view, setView] = useState('landing');
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', confirm: '' });
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  // Game states
  const [targetCount, setTargetCount] = useState(1);
  const [tempPlayers, setTempPlayers] = useState([]);
  const [activePlayers, setActivePlayers] = useState([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [gameMode, setGameMode] = useState('');
  const [question, setQuestion] = useState(null);
  const [diceValue, setDiceValue] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionStartPos, setSessionStartPos] = useState(1);
  const [levelUp, setLevelUp] = useState(false);
  
  // Story mode
  const [showStoryMode, setShowStoryMode] = useState(false);
  
  // Saved progress
  const [savedProgress, setSavedProgress] = useState(null);
  
  // Scrabble specific
  const [scrabblePool, setScrabblePool] = useState([]);
  const [scrabbleSlots, setScrabbleSlots] = useState([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [timerActive, setTimerActive] = useState(false);

  // Audio refs
  const audioRefs = {
    correct: useRef(null),
    wrong: useRef(null),
    levelUp: useRef(null),
    background: useRef(null),
    victory: useRef(null),
    diceRoll: useRef(null),
    move: useRef(null)
  };

  // Initialize audio elements
  useEffect(() => {
    // Create audio elements
    audioRefs.correct.current = new Audio('/sounds/correct.mp3');
    audioRefs.wrong.current = new Audio('/sounds/wrong.mp3');
    audioRefs.levelUp.current = new Audio('/sounds/level-up.mp3');
    audioRefs.background.current = new Audio('/sounds/background.mp3');
    audioRefs.victory.current = new Audio('/sounds/victory.mp3');
    audioRefs.diceRoll.current = new Audio('/sounds/dice-roll.mp3');
    audioRefs.move.current = new Audio('/sounds/move.mp3');

    // Set background to loop
    if (audioRefs.background.current) {
      audioRefs.background.current.loop = true;
      audioRefs.background.current.volume = 0.3;
    }

    // Cleanup
    return () => {
      Object.values(audioRefs).forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      });
    };
  }, []);

  // Toggle background music
  const toggleMusic = () => {
    if (isMusicPlaying) {
      audioRefs.background.current?.pause();
    } else {
      audioRefs.background.current?.play().catch(e => console.log('Audio play failed:', e));
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  // Play sound effect
  const playSound = (soundName) => {
    const sound = audioRefs[soundName]?.current;
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(e => console.log(`Sound ${soundName} failed:`, e));
    }
  };

  // Load saved progress when user selects mode
  useEffect(() => {
    if (user && gameMode && view === 'mode_select') {
      loadSavedProgress();
    }
  }, [user, gameMode, view]);

  // Timer effect for Scrabble mode
  useEffect(() => {
    if (view === 'playing' && gameMode === 'Scrabble' && timerActive && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            handleWrongAnswer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [timeLeft, timerActive, gameMode, view]);

  // Confetti timeout
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // Level up effect
  useEffect(() => {
    if (levelUp) {
      playSound('levelUp');
      setShowConfetti(true);
      const timer = setTimeout(() => setLevelUp(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [levelUp]);

  // Load saved progress
  const loadSavedProgress = async () => {
    if (!user) return;
    
    try {
      const res = await axios.get(`${API_URL}/progress/${user.id}/${gameMode}`);
      if (res.data && res.data.position > 1) {
        setSavedProgress(res.data);
        setModalContent({
          title: "🔄 Saved Game Found!",
          message: `You were at position ${res.data.position} with ${res.data.xp_earned} XP earned in this session.\n\nDo you want to continue where you left off?`,
          onClose: (choice) => {
            setShowModal(false);
            if (choice === 'continue') {
              // Update player position with saved progress
              const updatedPlayers = activePlayers.map(p => 
                p.id === user.id ? { ...p, pos: res.data.position } : p
              );
              setActivePlayers(updatedPlayers);
              setSessionStartPos(res.data.position);
              setSessionXp(res.data.xp_earned);
            }
          },
          showChoices: true
        });
        setShowModal(true);
      }
    } catch (e) {
      console.log("No saved progress found");
    }
  };

  // Save game progress
  const saveProgress = async () => {
    if (!user || !gameMode || activePlayers.length === 0) return;
    
    const currentPlayer = activePlayers.find(p => p.id === user.id);
    if (!currentPlayer) return;
    
    try {
      await axios.post(`${API_URL}/save-progress`, {
        userId: user.id,
        gameMode,
        position: currentPlayer.pos,
        xpEarned: sessionXp
      });
      console.log("Progress saved!");
    } catch (e) {
      console.error("Failed to save progress");
    }
  };

  // Handle wrong answer
  const handleWrongAnswer = async () => {
    const deductAmount = 5;
    playSound('wrong');
    setSessionXp(prev => Math.max(0, prev - deductAmount));
    
    try {
      const res = await axios.post(`${API_URL}/deduct-xp`, {
        userId: user.id,
        xpDeducted: deductAmount
      });
      
      setUser(prev => ({
        ...prev,
        xp: res.data.newXp,
        level: res.data.newLevel
      }));
      
      setModalContent({
        title: "❌ Incorrect!",
        message: `Wrong answer! ${deductAmount} XP deducted.\n\nMoving to next question...`,
        onClose: () => {
          setShowModal(false);
          startLevel(gameMode);
        }
      });
      setShowModal(true);
    } catch (e) {
      console.error("Failed to deduct XP");
      startLevel(gameMode);
    }
  };

  // Handle story completion
  const handleStoryComplete = (xpEarned, stars) => {
    setShowConfetti(true);
    playSound('victory');
    
    // Refresh user data
    axios.get(`${API_URL}/user/${user.id}`).then(res => {
      setUser(prev => ({ ...prev, xp: res.data.xp, level: res.data.level }));
    });
    
    setModalContent({
      title: "🏆 Story Complete! 🏆",
      message: `Congratulations! You've completed all episodes!\n\nTotal Stars: ${'⭐'.repeat(stars)}\nXP Earned: ${xpEarned}`,
      onClose: () => {
        setShowModal(false);
        setShowStoryMode(false);
        setView('home');
      }
    });
    setShowModal(true);
  };

  // Navigation
  const goHome = () => {
    setView('landing');
    setUser(null);
    setTempPlayers([]);
    setActivePlayers([]);
    setCurrentPlayerIdx(0);
    setQuestion(null);
    setTimerActive(false);
    setSessionXp(0);
    setSessionStartPos(1);
    setSavedProgress(null);
    setShowStoryMode(false);
    if (audioRefs.background.current) {
      audioRefs.background.current.pause();
      setIsMusicPlaying(false);
    }
  };

  const exitGame = async () => {
    await saveProgress();
    
    setTimerActive(false);
    setTempPlayers([]);
    setActivePlayers([]);
    setCurrentPlayerIdx(0);
    setQuestion(null);
    setScrabblePool([]);
    setScrabbleSlots([]);
    setGameMode('');
    setView(user ? 'home' : 'landing');
  };

  // Authentication
  const handleAuth = async (e, type) => {
    e.preventDefault();
    try {
      if (type === 'register') {
        if (form.password !== form.confirm) {
          setModalContent({
            title: "Error",
            message: "Passwords don't match!",
            onClose: () => setShowModal(false)
          });
          setShowModal(true);
          return;
        }
        await axios.post(`${API_URL}/register`, form);
        setModalContent({
          title: "Success!",
          message: "Account created! Please login.",
          onClose: () => {
            setShowModal(false);
            setView('landing');
          }
        });
        setShowModal(true);
        setForm({ username: '', password: '', confirm: '' });
      } else {
        const res = await axios.post(`${API_URL}/login`, form);
        
        if (view === 'multi_login') {
          if (tempPlayers.find(p => p.username === res.data.username)) {
            setModalContent({
              title: "Error",
              message: "Player already joined!",
              onClose: () => setShowModal(false)
            });
            setShowModal(true);
            return;
          }
          
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
          const newPlayer = { ...res.data, pos: 1, color: colors[tempPlayers.length] };
          const updated = [...tempPlayers, newPlayer];
          setTempPlayers(updated);
          setForm({ username: '', password: '', confirm: '' });

          if (updated.length === targetCount) {
            setActivePlayers(updated);
            
            await axios.post(`${API_URL}/game-session`, {
              mode: 'multiplayer',
              players: updated
            });
            
            setView('mode_select');
          }
        } else {
          setUser(res.data);
          setView('home');
          toggleMusic();
        }
      }
    } catch (e) {
      setModalContent({
        title: "Error",
        message: e.response?.data?.error || "Something went wrong!",
        onClose: () => setShowModal(false)
      });
      setShowModal(true);
    }
  };

  // Game mechanics
  const startLevel = async (modeName) => {
    try {
      setGameMode(modeName);
      const res = await axios.get(`${API_URL}/questions/${modeName}`);
      setQuestion(res.data);
      
      if (modeName === 'Scrabble') {
        const letters = (res.data.correct_answer + (res.data.distractors?.join('') || '')).split('');
        setScrabblePool(letters.sort(() => Math.random() - 0.5));
        setScrabbleSlots(Array(res.data.correct_answer.length).fill(''));
        setTimeLeft(30);
        setTimerActive(true);
      } else {
        setTimerActive(false);
      }
      
      setView('playing');
    } catch (e) {
      setModalContent({
        title: "Error",
        message: "Couldn't load question!",
        onClose: () => setShowModal(false)
      });
      setShowModal(true);
    }
  };

  const updatePlayerXP = async (playerIdx, xpGained) => {
    const player = activePlayers[playerIdx];
    const oldLevel = user.level;
    setSessionXp(prev => prev + xpGained);
    
    try {
      const res = await axios.post(`${API_URL}/update-xp`, {
        userId: player.id,
        xpGained
      });
      
      setUser(prev => ({
        ...prev,
        xp: res.data.newXp,
        level: res.data.newLevel
      }));
      
      if (res.data.newLevel > oldLevel) {
        setLevelUp(true);
      }
      
      const updated = [...activePlayers];
      updated[playerIdx].xp = (updated[playerIdx].xp || 0) + xpGained;
      setActivePlayers(updated);
    } catch (e) {
      console.error("Failed to update XP");
    }
  };

  const handleJumanjiEvent = () => {
    const events = [
      { type: 'bonus', text: '🌟 Magic Crystal! Move +2!', steps: 2 },
      { type: 'bonus', text: '🦁 Friendly Lion gives you a ride! Move +3!', steps: 3 },
      { type: 'skip', text: '😴 Monkey business! Skip next turn!', skip: true },
      { type: 'xp', text: '📚 Ancient knowledge! +20 XP!', xpBonus: 20 },
      { type: 'bonus', text: '🌿 Vine swing! Move +1!', steps: 1 }
    ];
    
    if (Math.random() < 0.2) {
      const event = events[Math.floor(Math.random() * events.length)];
      
      setTimeout(() => {
        setModalContent({
          title: "✨ JUMANJI EVENT! ✨",
          message: event.text,
          onClose: () => {
            setShowModal(false);
            
            if (event.type === 'bonus') {
              movePlayer(event.steps, true);
            } else if (event.type === 'skip') {
              const nextIdx = (currentPlayerIdx + 2) % activePlayers.length;
              setCurrentPlayerIdx(nextIdx);
            } else if (event.type === 'xp') {
              updatePlayerXP(currentPlayerIdx, event.xpBonus);
            }
            setTimeout(() => startLevel(gameMode), 1000);
          }
        });
        setShowModal(true);
      }, 500);
      
      return true;
    }
    return false;
  };

  const movePlayer = (steps, isEvent = false) => {
    playSound('move');
    let players = [...activePlayers];
    let newPos = players[currentPlayerIdx].pos;
    
    if (gameMode === 'Snakes' && !isEvent) {
      setRolling(true);
      playSound('diceRoll');
      setTimeout(() => {
        const dice = Math.floor(Math.random() * 6) + 1;
        setDiceValue(dice);
        setRolling(false);
        
        setModalContent({
          title: "🎲 Dice Roll",
          message: `You rolled a ${dice}!`,
          onClose: () => {
            setShowModal(false);
            newPos = players[currentPlayerIdx].pos + dice;
            
            if (SNAKES_AND_LADDERS.snakes[newPos]) {
              setTimeout(() => {
                setModalContent({
                  title: "🐍 SNAKE!",
                  message: `Oh no! Slide down to ${SNAKES_AND_LADDERS.snakes[newPos]}!`,
                  onClose: () => {
                    setShowModal(false);
                    newPos = SNAKES_AND_LADDERS.snakes[newPos];
                    players[currentPlayerIdx].pos = Math.min(newPos, 100);
                    setActivePlayers(players);
                    checkWinAndNext();
                    setTimeout(() => startLevel(gameMode), 1000);
                  }
                });
                setShowModal(true);
              }, 500);
            } else if (SNAKES_AND_LADDERS.ladders[newPos]) {
              setTimeout(() => {
                setModalContent({
                  title: "🪄 LADDER!",
                  message: `Lucky! Climb to ${SNAKES_AND_LADDERS.ladders[newPos]}!`,
                  onClose: () => {
                    setShowModal(false);
                    newPos = SNAKES_AND_LADDERS.ladders[newPos];
                    players[currentPlayerIdx].pos = Math.min(newPos, 100);
                    setActivePlayers(players);
                    checkWinAndNext();
                    setTimeout(() => startLevel(gameMode), 1000);
                  }
                });
                setShowModal(true);
              }, 500);
            } else {
              players[currentPlayerIdx].pos = Math.min(newPos, 100);
              setActivePlayers(players);
              checkWinAndNext();
              setTimeout(() => startLevel(gameMode), 1000);
            }
          }
        });
        setShowModal(true);
      }, 1000);
    } else {
      if (!isEvent && gameMode === 'Jumanji') {
        if (steps === 3) updatePlayerXP(currentPlayerIdx, 10);
        else if (steps === 1) updatePlayerXP(currentPlayerIdx, 5);
      }
      
      newPos = players[currentPlayerIdx].pos + steps;
      players[currentPlayerIdx].pos = Math.min(newPos, 100);
      setActivePlayers(players);
      
      if (!isEvent && gameMode === 'Jumanji') {
        if (!handleJumanjiEvent()) {
          checkWinAndNext();
          setTimeout(() => startLevel(gameMode), 1000);
        }
      } else {
        checkWinAndNext();
        setTimeout(() => startLevel(gameMode), 1000);
      }
    }
  };

  const checkWinAndNext = () => {
    const players = [...activePlayers];
    
    if (players[currentPlayerIdx].pos >= 100) {
      updatePlayerXP(currentPlayerIdx, 50);
      playSound('victory');
      setShowConfetti(true);
      
      axios.post(`${API_URL}/save-progress`, {
        userId: user.id,
        gameMode,
        position: 1,
        xpEarned: 0
      });
      
      setModalContent({
        title: "🏆 VICTORY! 🏆",
        message: `${players[currentPlayerIdx].username} wins!\n\n+50 XP Bonus!`,
        onClose: () => {
          setShowModal(false);
          exitGame();
        }
      });
      setShowModal(true);
      return;
    }
    
    if (players.length > 1) {
      const nextIdx = (currentPlayerIdx + 1) % players.length;
      setCurrentPlayerIdx(nextIdx);
    }
  };

  const handleTileClick = (char, poolIdx) => {
    const nextSlot = scrabbleSlots.indexOf('');
    if (nextSlot === -1) return;
    
    const newSlots = [...scrabbleSlots];
    newSlots[nextSlot] = char;
    setScrabbleSlots(newSlots);
    
    const newPool = scrabblePool.filter((_, i) => i !== poolIdx);
    setScrabblePool(newPool);
    
    if (!newSlots.includes('')) {
      setTimerActive(false);
      const playerWord = newSlots.join('');
      
      if (playerWord === question.correct_answer) {
        const timeBonus = Math.floor((30 - timeLeft) / 5);
        const totalSteps = 1 + timeBonus;
        playSound('correct');
        
        setModalContent({
          title: "✅ CORRECT!",
          message: `Word: ${playerWord}\n+${totalSteps} steps (${timeBonus} speed bonus!)\n+${timeBonus * 5} XP!`,
          onClose: () => {
            setShowModal(false);
            updatePlayerXP(currentPlayerIdx, timeBonus * 5);
            movePlayer(totalSteps);
          }
        });
        setShowModal(true);
      } else {
        handleWrongAnswer();
      }
    }
  };

  const handleMCAnswer = (answer) => {
    if (answer === question.correct_answer) {
      playSound('correct');
      setModalContent({
        title: "✅ CORRECT!",
        message: "Well done! Moving 3 steps!",
        onClose: () => {
          setShowModal(false);
          movePlayer(3);
        }
      });
      setShowModal(true);
    } else {
      handleWrongAnswer();
    }
  };

  const getNextLevelXP = () => {
    if (!user) return 0;
    if (user.level === 1) return 200;
    if (user.level === 2) return 500;
    if (user.level === 3) return 900;
    return user.level * 500 + 400;
  };

  const getXpProgress = () => {
    if (!user) return 0;
    if (user.level === 1) return user.xp;
    if (user.level === 2) return user.xp - 200;
    if (user.level === 3) return user.xp - 500;
    if (user.level === 4) return user.xp - 900;
    return user.xp - (900 + (user.level - 4) * 500);
  };

  const getXpRequiredForCurrentLevel = () => {
    if (!user) return 100;
    if (user.level === 1) return 200;
    if (user.level === 2) return 300;
    if (user.level === 3) return 400;
    return 500;
  };

  return (
    <div className="app-container">
      {showConfetti && <Confetti />}
      {showModal && (
        <Modal
          title={modalContent.title}
          message={modalContent.message}
          onClose={modalContent.onClose}
          showChoices={modalContent.showChoices}
        />
      )}

      {/* STORY MODE */}
      {view === 'story' && showStoryMode && (
        <StoryMode 
          user={user} 
          onExit={() => {
            setShowStoryMode(false);
            setView('home');
          }}
          onComplete={handleStoryComplete}
        />
      )}

      {/* LANDING PAGE */}
      {view === 'landing' && (
        <div className="glass-card">
          <h1 className="title">📚 ReAdventure.io</h1>
          <p className="subtitle">Where Reading Becomes an Adventure!</p>
          <button className="primary large" onClick={() => setView('login')}>
            🎮 Single Player
          </button>
          <button className="secondary large" onClick={() => setView('multi_count')}>
            👥 Multiplayer
          </button>
          <button className="outline" onClick={() => setView('register')}>
            ✨ Create Account
          </button>
          <button className="music-btn" onClick={toggleMusic}>
            {isMusicPlaying ? '🔊 Music On' : '🔇 Music Off'}
          </button>
        </div>
      )}

      {/* REGISTER */}
      {view === 'register' && (
        <div className="glass-card">
          <h2>Create Your Hero</h2>
          <form onSubmit={(e) => handleAuth(e, 'register')}>
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
            />
            <button type="submit" className="primary">Register</button>
            <button type="button" onClick={goHome}>Back</button>
          </form>
        </div>
      )}

      {/* LOGIN */}
      {view === 'login' && (
        <div className="glass-card">
          <h2>Welcome Back!</h2>
          <form onSubmit={(e) => handleAuth(e, 'login')}>
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <button type="submit" className="primary">Login</button>
            <button type="button" onClick={goHome}>Back</button>
          </form>
        </div>
      )}

      {/* MULTIPLAYER COUNT */}
      {view === 'multi_count' && (
        <div className="glass-card">
          <h2>👥 How Many Players?</h2>
          <div className="button-grid">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                className="primary large"
                onClick={() => {
                  setTargetCount(n);
                  setTempPlayers([]);
                  setView('multi_login');
                }}
              >
                {n} Players
              </button>
            ))}
          </div>
          <button onClick={goHome}>Back</button>
        </div>
      )}

      {/* MULTIPLAYER LOGIN */}
      {view === 'multi_login' && (
        <div className="glass-card">
          <h2>Player {tempPlayers.length + 1} Login</h2>
          <p className="player-counter">
            {tempPlayers.length + 1} of {targetCount} players
          </p>
          {tempPlayers.map((p, i) => (
            <div key={i} className="player-badge" style={{ background: p.color + '20' }}>
              ✅ {p.username}
            </div>
          ))}
          <form onSubmit={(e) => handleAuth(e, 'login')}>
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <button type="submit" className="primary">Login Player {tempPlayers.length + 1}</button>
            <button type="button" onClick={goHome}>Cancel</button>
          </form>
        </div>
      )}

      {/* HOME DASHBOARD */}
      {view === 'home' && user && (
        <div className="glass-card">
          <h2>Welcome, {user.username}! 👋</h2>
          <div className="stats">
            <div className="stat">Total XP: {user.xp}</div>
            <div className="stat">Level: {user.level}</div>
          </div>
          <div className="progress-bar-container">
            <div className="progress-label">
              <span>Level {user.level}</span>
              <span>Next: {getNextLevelXP()} XP</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(getXpProgress() / getXpRequiredForCurrentLevel()) * 100}%` }}
              ></div>
            </div>
            <div className="progress-xp">{getXpProgress()} / {getXpRequiredForCurrentLevel()} XP to next level</div>
          </div>
          
          <div className="home-buttons">
            <button className="story-mode-btn" onClick={() => {
              setShowStoryMode(true);
              setView('story');
            }}>
              📖 Story Mode
            </button>
            <button className="primary large" onClick={() => {
              const updatedPlayers = [{
                ...user,
                pos: 1,
                color: '#FF6B6B'
              }];
              setActivePlayers(updatedPlayers);
              setTempPlayers(updatedPlayers);
              setTargetCount(1);
              setView('mode_select');
            }}>
              🎮 Quick Play
            </button>
            <button className="secondary" onClick={() => setView('multi_count')}>
              👥 Multiplayer
            </button>
            <button className="outline" onClick={async () => {
              const res = await axios.get(`${API_URL}/leaderboard`);
              setLeaderboard(res.data);
              setView('leaderboard');
            }}>
              🏆 Leaderboard
            </button>
            <button className="music-btn" onClick={toggleMusic}>
              {isMusicPlaying ? '🔊 Music On' : '🔇 Music Off'}
            </button>
            <button onClick={goHome}>Logout</button>
          </div>
        </div>
      )}

      {/* MODE SELECTION */}
      {view === 'mode_select' && (
        <div className="glass-card">
          <h2>Choose Your Adventure!</h2>
          <div className="mode-cards">
            <div className="mode-card" onClick={() => startLevel('Jumanji')}>
              <div className="mode-icon">🌴</div>
              <h3>Jumanji</h3>
              <p className="mode-desc">Easy - 20% Random Events</p>
            </div>
            <div className="mode-card" onClick={() => startLevel('Scrabble')}>
              <div className="mode-icon">🔤</div>
              <h3>Scrabble</h3>
              <p className="mode-desc">Average - Timed Challenge</p>
            </div>
            <div className="mode-card" onClick={() => startLevel('Snakes')}>
              <div className="mode-icon">🐍</div>
              <h3>Snakes & Ladders</h3>
              <p className="mode-desc">Hard - 10x10 Board</p>
            </div>
          </div>
          <button onClick={exitGame}>Back</button>
        </div>
      )}

      {/* LEADERBOARD */}
      {view === 'leaderboard' && (
        <div className="glass-card">
          <h2>🏆 Top Heroes</h2>
          <div className="leaderboard">
            {leaderboard.map((hero, i) => (
              <div key={i} className="leaderboard-row">
                <span className="rank">#{i + 1}</span>
                <span className="name">{hero.username}</span>
                <span className="level">Lvl {hero.level}</span>
                <span className="xp">{hero.xp} XP</span>
              </div>
            ))}
          </div>
          <button onClick={() => setView('home')}>Back</button>
        </div>
      )}

      {/* GAMEPLAY */}
      {view === 'playing' && question && (
        <div className="game-container">
          <div className="game-header">
            <button className="exit-btn" onClick={exitGame}>🚪 Exit Game</button>
            <div className="turn-indicator">
              {activePlayers.length > 0 && (
                <>
                  <span className="turn-label">Current Turn:</span>
                  <span className="turn-player" style={{ color: activePlayers[currentPlayerIdx]?.color }}>
                    {activePlayers[currentPlayerIdx]?.username}
                  </span>
                  {gameMode === 'Scrabble' && timerActive && (
                    <span className="timer">⏰ {timeLeft}s</span>
                  )}
                  <span className="session-xp">✨ Session XP: {sessionXp}</span>
                  {levelUp && <span className="level-up">⬆️ Level Up!</span>}
                </>
              )}
            </div>
          </div>

          <div className="gameplay-area">
            <div className="question-card">
              {gameMode === 'Jumanji' && question.content && (
                <div className="story-content">
                  <h4>📖 Reading Passage:</h4>
                  <p>{question.content}</p>
                </div>
              )}
              
              <h3 className="question-text">{question.question_text}</h3>
              
              {gameMode === 'Scrabble' ? (
                <div className="scrabble-game">
                  <div className="word-slots">
                    {scrabbleSlots.map((letter, i) => (
                      <div key={i} className="letter-slot">
                        {letter}
                      </div>
                    ))}
                  </div>
                  <div className="letter-pool">
                    {scrabblePool.map((letter, i) => (
                      <button
                        key={i}
                        className="letter-tile"
                        onClick={() => handleTileClick(letter, i)}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="answers-grid">
                  {[
                    question.correct_answer,
                    ...(question.distractors || [])
                  ].sort(() => Math.random() - 0.5).map((answer, i) => (
                    <button
                      key={i}
                      className="answer-btn"
                      onClick={() => handleMCAnswer(answer)}
                    >
                      {answer}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="game-board-section">
              {gameMode === 'Snakes' && rolling && (
                <Dice value={diceValue} rolling={rolling} />
              )}
              <Board players={activePlayers} gameMode={gameMode} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}