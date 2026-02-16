const express = require('express');
const sqlite3 = require('better-sqlite3');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const db = new sqlite3(path.resolve(__dirname, 'adventure.db'));

app.use(cors());
app.use(express.json());

// Initialize database with all tables
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1
  );

  -- Game sessions table
  CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT,
    number_of_players INTEGER,
    current_turn_index INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Session players table
  CREATE TABLE IF NOT EXISTS session_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    user_id INTEGER,
    position INTEGER DEFAULT 1,
    score INTEGER DEFAULT 0,
    turn_order INTEGER,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Reading materials table
  CREATE TABLE IF NOT EXISTS reading_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT
  );

  -- Questions table
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER,
    category TEXT,
    difficulty INTEGER,
    question_text TEXT,
    correct_answer TEXT,
    content TEXT,
    distractors TEXT,
    FOREIGN KEY (material_id) REFERENCES reading_materials(id)
  );

  -- User progress table for saving game state
  CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    game_mode TEXT,
    position INTEGER DEFAULT 1,
    xp_earned INTEGER DEFAULT 0,
    last_played DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, game_mode)
  );

  -- Story episodes table
  CREATE TABLE IF NOT EXISTS story_episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_number INTEGER,
    title TEXT,
    content TEXT,
    image_url TEXT,
    xp_reward INTEGER DEFAULT 20
  );

  -- Story quizzes table
  CREATE TABLE IF NOT EXISTS story_quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER,
    question_text TEXT,
    correct_answer TEXT,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    FOREIGN KEY (episode_id) REFERENCES story_episodes(id)
  );

  -- User story progress table
  CREATE TABLE IF NOT EXISTS user_story_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    current_episode INTEGER DEFAULT 1,
    completed_episodes TEXT DEFAULT '[]',
    total_stars INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id)
  );
`);

// Seed reading materials
const materialCount = db.prepare('SELECT COUNT(*) as count FROM reading_materials').get();
if (materialCount.count === 0) {
  const materials = [
    {
      title: "The Jungle Adventure",
      content: "Leo ventured deep into the Jumanji jungle. He encountered monkeys, crossed rivers, and discovered ancient ruins. The monkeys were playful but mischievous, stealing his map. The river was home to crocodiles, so he had to build a raft. In the ruins, he found a golden statue that granted him one wish."
    },
    {
      title: "Word Magic",
      content: "In the land of Scrabble, letters float in the air. Sara learned that arranging them correctly creates magic spells. She spelled 'WINGS' and could fly, 'FIRE' to warm the cold cave, and 'LIGHT' to illuminate dark paths. Each word had power, but misspelling could cause chaos."
    },
    {
      title: "The Great Race",
      content: "On the Snakes and Ladders board, players race to reach the finish. The ladders represent good deeds - helping others lets you climb higher. The snakes are mistakes - cheating or lying sends you sliding back. Tim learned that honesty and kindness were the real keys to winning."
    }
  ];
  
  const insertMaterial = db.prepare('INSERT INTO reading_materials (title, content) VALUES (?, ?)');
  materials.forEach(m => insertMaterial.run(m.title, m.content));
}

// Seed questions
const questionCount = db.prepare('SELECT COUNT(*) as count FROM questions').get();
if (questionCount.count === 0) {
  const materials = db.prepare('SELECT id FROM reading_materials').all();
  
  const insertQuestion = db.prepare(`
    INSERT INTO questions (material_id, category, difficulty, question_text, correct_answer, content, distractors) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Jumanji Questions (Easy)
  const jumanjiQuestions = [
    ["What did the monkeys steal from Leo?", "map", "The monkeys were mischievous and took his map.", "food,hat,compass"],
    ["How did Leo cross the crocodile river?", "raft", "He built a raft to safely cross.", "boat,swimming,bridge"],
    ["What did Leo find in the ruins?", "golden statue", "The ancient ruins held a golden statue.", "treasure chest,magic book,diamond"],
    ["What could the golden statue grant?", "one wish", "The statue granted a single wish.", "three wishes,immortality,wealth"],
    ["Who was playful but mischievous?", "monkeys", "The monkeys caused trouble playfully.", "crocodiles,birds,tigers"],
    ["Where did Leo venture?", "Jumanji jungle", "His adventure began in the jungle.", "desert,mountain,ocean"],
    ["What animals lived in the river?", "crocodiles", "Dangerous crocodiles lived there.", "hippos,snakes,fish"],
    ["What was stolen from Leo?", "map", "Without it, he was lost.", "food,water,backpack"],
    ["How did Leo feel in the jungle?", "adventurous", "He was excited to explore.", "scared,bored,tired"],
    ["What color was the statue?", "golden", "It shined with gold.", "silver,bronze,copper"]
  ];
  
  jumanjiQuestions.forEach(q => {
    insertQuestion.run(materials[0].id, 'Jumanji', 1, q[0], q[1], q[2], q[3]);
  });

  // Scrabble Questions (Average)
  const scrabbleQuestions = [
    ["Unscramble: IGNSW", "WINGS", "These let you fly.", "SINGW,WIGNS,SWING"],
    ["Unscramble: IREF", "FIRE", "It produces heat.", "RIEF,RIFE,FIER"],
    ["Unscramble: GHLIT", "LIGHT", "Makes things visible.", "THIGL,LIGTH,GILHT"],
    ["Unscramble: OOLCSH", "SCHOOL", "Where you learn.", "COOLSH,SCHOOL,LOOCHS"],
    ["Unscramble: NDAERG", "GARDEN", "Where flowers grow.", "RANDEG,DANGER,GRANDE"],
    ["Unscramble: OKBO", "BOOK", "Full of stories.", "KOOB,BOKO,OOBK"],
    ["Unscramble: PICRENE", "PRINCE", "A royal title.", "NEPRICE,PINCERE,CRIPENE"],
    ["Unscramble: EULB", "BLUE", "Color of the sky.", "LUBE,UBLE,ELUB"],
    ["Unscramble: OMUSE", "MOUSE", "Computer peripheral.", "SOUME,EMOUS,UOSEM"],
    ["Unscramble: LAPPE", "APPLE", "A fruit.", "PAPEL,PEAPL,LEAPP"]
  ];
  
  scrabbleQuestions.forEach(q => {
    insertQuestion.run(materials[1].id, 'Scrabble', 2, q[0], q[1], q[2], q[3]);
  });

  // Snakes & Ladders Questions (Difficult)
  const snakesQuestions = [
    ["If you have 5 apples and eat 2, how many left?", "3", "Simple subtraction.", "2,4,7"],
    ["What is 7 + 8?", "15", "Addition problem.", "14,16,17"],
    ["Which word is a noun: RUN, HOUSE, FAST", "HOUSE", "A person, place, or thing.", "RUN,FAST,ALL"],
    ["What is the opposite of HOT?", "cold", "Temperature antonyms.", "warm,cool,freezing"],
    ["How many sides does a square have?", "4", "Basic geometry.", "3,5,6"],
    ["What comes after 19?", "20", "Counting numbers.", "18,21,19"],
    ["Which is a color: DOG, RED, CAR", "RED", "Color identification.", "DOG,CAR,BLUE"],
    ["What is 12 - 5?", "7", "Subtraction.", "6,8,9"],
    ["Which word means big: SMALL, LARGE, TINY", "LARGE", "Synonyms.", "SMALL,TINY,HUGE"],
    ["How many legs does a dog have?", "4", "Animal anatomy.", "2,3,5"]
  ];
  
  snakesQuestions.forEach(q => {
    insertQuestion.run(materials[2].id, 'Snakes', 3, q[0], q[1], q[2], q[3]);
  });

  console.log("🌱 All questions seeded!");
}

// Seed story episodes and quizzes
const episodeCount = db.prepare('SELECT COUNT(*) as count FROM story_episodes').get();
if (episodeCount.count === 0) {
  // Episode 1: The Mysterious Forest
  db.prepare(`
    INSERT INTO story_episodes (episode_number, title, content, xp_reward) 
    VALUES (?, ?, ?, ?)
  `).run(1, "The Mysterious Forest", 
    "In the heart of the Enchanted Forest, young Mia discovered a glowing map. The map showed a path to the legendary Crystal of Knowledge. As she ventured deeper, she met talking animals who warned her of tricky puzzles ahead. The first challenge was to cross the Bridge of Questions, where each step required a correct answer.", 
    30);

  // Episode 1 Quiz Questions
  const episode1Quizzes = [
    ["What did Mia discover in the forest?", "A glowing map", "A magic wand", "A talking tree", "A hidden cave", "A glowing map"],
    ["What was Mia looking for?", "The Crystal of Knowledge", "Gold coins", "Magic powers", "A secret treasure", "The Crystal of Knowledge"],
    ["Who warned Mia about puzzles?", "Talking animals", "Wise owl", "Fairy godmother", "Forest spirits", "Talking animals"],
    ["What did she need to cross?", "Bridge of Questions", "River of Riddles", "Mountain of Mysteries", "Cave of Confusion", "Bridge of Questions"]
  ];

  const insertQuiz = db.prepare(`
    INSERT INTO story_quizzes (episode_id, question_text, correct_answer, option_a, option_b, option_c, option_d) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  episode1Quizzes.forEach(q => {
    insertQuiz.run(1, q[0], q[1], q[2], q[3], q[4], q[5]);
  });

  // Episode 2: The Wise Owl's Challenge
  db.prepare(`
    INSERT INTO story_episodes (episode_number, title, content, xp_reward) 
    VALUES (?, ?, ?, ?)
  `).run(2, "The Wise Owl's Challenge", 
    "After crossing the bridge, Mia met Professor Hoot, a wise old owl. He explained that the Crystal of Knowledge was protected by three guardians. Each guardian would ask questions about reading comprehension. 'To pass,' said Professor Hoot, 'you must understand not just words, but their meanings.' He gave Mia a magical book that would help her on her journey.", 
    40);

  // Episode 2 Quiz Questions
  const episode2Quizzes = [
    ["Who did Mia meet after the bridge?", "Professor Hoot the owl", "A friendly fox", "A magical deer", "A wise turtle", "Professor Hoot the owl"],
    ["How many guardians protected the crystal?", "Three", "One", "Five", "Seven", "Three"],
    ["What would the guardians ask about?", "Reading comprehension", "Math problems", "History facts", "Science questions", "Reading comprehension"],
    ["What did Professor Hoot give Mia?", "A magical book", "A compass", "A map", "A lantern", "A magical book"]
  ];

  episode2Quizzes.forEach(q => {
    insertQuiz.run(2, q[0], q[1], q[2], q[3], q[4], q[5]);
  });

  // Episode 3: The First Guardian
  db.prepare(`
    INSERT INTO story_episodes (episode_number, title, content, xp_reward) 
    VALUES (?, ?, ?, ?)
  `).run(3, "The First Guardian", 
    "The first guardian was a majestic unicorn named Starlight. She guarded the Gateway of Vocabulary. 'To proceed,' she said, 'you must show me you understand the power of words.' She presented Mia with a series of passages and asked her to find the main ideas and important details. Mia opened her magical book and began to read carefully.", 
    50);

  // Episode 3 Quiz Questions
  const episode3Quizzes = [
    ["Who was the first guardian?", "Starlight the unicorn", "A mighty dragon", "A stone giant", "A water spirit", "Starlight the unicorn"],
    ["What did the first guardian guard?", "Gateway of Vocabulary", "Door of Words", "Portal of Letters", "Gate of Grammar", "Gateway of Vocabulary"],
    ["What did Mia need to find in the passages?", "Main ideas and details", "Hidden messages", "Secret codes", "Magic words", "Main ideas and details"],
    ["What helped Mia read carefully?", "Her magical book", "A reading spell", "Special glasses", "A thinking cap", "Her magical book"]
  ];

  episode3Quizzes.forEach(q => {
    insertQuiz.run(3, q[0], q[1], q[2], q[3], q[4], q[5]);
  });

  // Episode 4: The Second Guardian
  db.prepare(`
    INSERT INTO story_episodes (episode_number, title, content, xp_reward) 
    VALUES (?, ?, ?, ?)
  `).run(4, "The Second Guardian", 
    "Next, Mia encountered Blaze, a friendly dragon who guarded the Bridge of Comprehension. 'I won't breathe fire,' Blaze chuckled, 'but I will test how well you understand stories!' He gave Mia short tales to read and asked questions about characters, settings, and plots. With each correct answer, the bridge grew stronger.", 
    60);

  // Episode 4 Quiz Questions
  const episode4Quizzes = [
    ["Who was the second guardian?", "Blaze the dragon", "A phoenix", "A griffin", "A pegasus", "Blaze the dragon"],
    ["What did the second guardian guard?", "Bridge of Comprehension", "Path of Understanding", "Road of Knowledge", "Way of Wisdom", "Bridge of Comprehension"],
    ["What did Blaze ask about?", "Characters, settings, and plots", "Grammar rules", "Spelling words", "Writing styles", "Characters, settings, and plots"],
    ["What happened with each correct answer?", "The bridge grew stronger", "Fireworks appeared", "The path lit up", "Stars fell from the sky", "The bridge grew stronger"]
  ];

  episode4Quizzes.forEach(q => {
    insertQuiz.run(4, q[0], q[1], q[2], q[3], q[4], q[5]);
  });

  // Episode 5: The Final Guardian
  db.prepare(`
    INSERT INTO story_episodes (episode_number, title, content, xp_reward) 
    VALUES (?, ?, ?, ?)
  `).run(5, "The Final Guardian", 
    "The last guardian was Aurora, a beautiful phoenix who protected the Crystal Chamber. 'One final test,' she sang. 'You must show you can make predictions and understand the deeper meaning of stories.' Aurora shared ancient tales and asked Mia what might happen next and why characters made certain choices. Mia's thoughtful answers impressed the phoenix.", 
    70);

  // Episode 5 Quiz Questions
  const episode5Quizzes = [
    ["Who was the final guardian?", "Aurora the phoenix", "A sphinx", "A mermaid", "A fairy queen", "Aurora the phoenix"],
    ["What did the final test involve?", "Making predictions and understanding deeper meaning", "Writing stories", "Memorizing facts", "Solving riddles", "Making predictions and understanding deeper meaning"],
    ["What did Aurora share with Mia?", "Ancient tales", "Magic spells", "Secret maps", "Hidden treasures", "Ancient tales"],
    ["What impressed the phoenix?", "Mia's thoughtful answers", "Mia's speed", "Mia's bravery", "Mia's kindness", "Mia's thoughtful answers"]
  ];

  episode5Quizzes.forEach(q => {
    insertQuiz.run(5, q[0], q[1], q[2], q[3], q[4], q[5]);
  });

  // Episode 6: The Crystal of Knowledge
  db.prepare(`
    INSERT INTO story_episodes (episode_number, title, content, xp_reward) 
    VALUES (?, ?, ?, ?)
  `).run(6, "The Crystal of Knowledge", 
    "The Crystal Chamber sparkled with light. There, floating in the center, was the Crystal of Knowledge. 'You have proven yourself worthy,' the guardians said together. 'The crystal will grant you the power of enhanced reading and understanding.' As Mia touched the crystal, she felt all the stories she had read come alive in her mind. She could now understand any book she picked up!", 
    100);

  // Episode 6 Quiz Questions
  const episode6Quizzes = [
    ["What was in the Crystal Chamber?", "The Crystal of Knowledge", "A magic wand", "A treasure chest", "A golden crown", "The Crystal of Knowledge"],
    ["What power did the crystal grant?", "Enhanced reading and understanding", "Super strength", "Flying ability", "Invisibility", "Enhanced reading and understanding"],
    ["How did Mia feel when touching the crystal?", "Stories came alive in her mind", "Tired and sleepy", "Scared and nervous", "Confused and lost", "Stories came alive in her mind"],
    ["What could Mia now understand?", "Any book she picked up", "Only fairy tales", "Just adventure stories", "Picture books only", "Any book she picked up"]
  ];

  episode6Quizzes.forEach(q => {
    insertQuiz.run(6, q[0], q[1], q[2], q[3], q[4], q[5]);
  });

  console.log("📚 Story episodes seeded!");
}

// Calculate level based on XP
function calculateLevel(xp) {
  if (xp < 200) return 1;
  if (xp < 500) return 2;
  if (xp < 900) return 3;
  return 4 + Math.floor((xp - 900) / 500);
}

// API Routes

// Register new user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    res.status(201).json({ message: "Account created successfully!" });
  } catch (e) {
    res.status(400).json({ error: "Username already exists" });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (user && await bcrypt.compare(password, user.password_hash)) {
    const level = calculateLevel(user.xp);
    res.json({ id: user.id, username: user.username, xp: user.xp, level });
  } else {
    res.status(401).json({ error: "Invalid username or password" });
  }
});

// Get random question by mode
app.get('/api/questions/:mode', (req, res) => {
  const q = db.prepare(`
    SELECT q.*, rm.title as material_title, rm.content as material_content 
    FROM questions q
    LEFT JOIN reading_materials rm ON q.material_id = rm.id
    WHERE q.category = ? 
    ORDER BY RANDOM() 
    LIMIT 1
  `).get(req.params.mode);
  
  if (q && q.distractors) {
    q.distractors = q.distractors.split(',');
  }
  res.json(q);
});

// Create game session
app.post('/api/game-session', (req, res) => {
  const { mode, players } = req.body;
  
  const insertSession = db.prepare(`
    INSERT INTO game_sessions (mode, number_of_players) 
    VALUES (?, ?)
  `);
  const sessionResult = insertSession.run(mode, players.length);
  const sessionId = sessionResult.lastInsertRowid;

  const insertPlayer = db.prepare(`
    INSERT INTO session_players (session_id, user_id, turn_order) 
    VALUES (?, ?, ?)
  `);

  players.forEach((player, index) => {
    insertPlayer.run(sessionId, player.id, index);
  });

  res.json({ sessionId, message: "Game session created!" });
});

// Update player XP and recalculate level
app.post('/api/update-xp', (req, res) => {
  const { userId, xpGained } = req.body;
  
  try {
    // Get current XP
    const user = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId);
    const newXp = user.xp + xpGained;
    const newLevel = calculateLevel(newXp);
    
    db.prepare(`
      UPDATE users 
      SET xp = ?, 
          level = ?
      WHERE id = ?
    `).run(newXp, newLevel, userId);
    
    res.json({ success: true, newXp, newLevel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Deduct XP for wrong answers
app.post('/api/deduct-xp', async (req, res) => {
  const { userId, xpDeducted } = req.body;
  
  try {
    // Get current XP
    const user = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId);
    const newXp = Math.max(0, user.xp - xpDeducted);
    const newLevel = calculateLevel(newXp);
    
    db.prepare(`
      UPDATE users 
      SET xp = ?, 
          level = ?
      WHERE id = ?
    `).run(newXp, newLevel, userId);
    
    res.json({ success: true, newXp, newLevel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save game progress
app.post('/api/save-progress', (req, res) => {
  const { userId, gameMode, position, xpEarned } = req.body;
  
  try {
    // Check if progress exists
    const existing = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND game_mode = ?').get(userId, gameMode);
    
    if (existing) {
      db.prepare(`
        UPDATE user_progress 
        SET position = ?, xp_earned = ?, last_played = CURRENT_TIMESTAMP
        WHERE user_id = ? AND game_mode = ?
      `).run(position, xpEarned, userId, gameMode);
    } else {
      db.prepare(`
        INSERT INTO user_progress (user_id, game_mode, position, xp_earned)
        VALUES (?, ?, ?, ?)
      `).run(userId, gameMode, position, xpEarned);
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user progress
app.get('/api/progress/:userId/:gameMode', (req, res) => {
  const { userId, gameMode } = req.params;
  
  const progress = db.prepare(`
    SELECT * FROM user_progress 
    WHERE user_id = ? AND game_mode = ?
  `).get(userId, gameMode);
  
  res.json(progress || { position: 1, xp_earned: 0 });
});

// Get user story progress
app.get('/api/story-progress/:userId', (req, res) => {
  const { userId } = req.params;
  
  let progress = db.prepare('SELECT * FROM user_story_progress WHERE user_id = ?').get(userId);
  
  if (!progress) {
    db.prepare(`
      INSERT INTO user_story_progress (user_id, current_episode, completed_episodes, total_stars)
      VALUES (?, ?, ?, ?)
    `).run(userId, 1, '[]', 0);
    
    progress = { user_id: userId, current_episode: 1, completed_episodes: '[]', total_stars: 0 };
  }
  
  res.json(progress);
});

// Get episode details
app.get('/api/story-episode/:episodeNumber', (req, res) => {
  const { episodeNumber } = req.params;
  
  const episode = db.prepare('SELECT * FROM story_episodes WHERE episode_number = ?').get(episodeNumber);
  const quizzes = db.prepare('SELECT * FROM story_quizzes WHERE episode_id = ?').all(episode?.id);
  
  res.json({ episode, quizzes });
});

// Update story progress
app.post('/api/update-story-progress', (req, res) => {
  const { userId, episodeNumber, starsEarned, xpEarned } = req.body;
  
  try {
    // Get current progress
    const progress = db.prepare('SELECT * FROM user_story_progress WHERE user_id = ?').get(userId);
    const completed = JSON.parse(progress.completed_episodes || '[]');
    
    if (!completed.includes(episodeNumber)) {
      completed.push(episodeNumber);
    }
    
    // Update progress
    db.prepare(`
      UPDATE user_story_progress 
      SET current_episode = ?, 
          completed_episodes = ?,
          total_stars = total_stars + ?
      WHERE user_id = ?
    `).run(episodeNumber + 1, JSON.stringify(completed), starsEarned, userId);
    
    // Add XP to user
    const user = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId);
    const newXp = user.xp + xpEarned;
    const newLevel = calculateLevel(newXp);
    
    db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXp, newLevel, userId);
    
    res.json({ success: true, newXp, newLevel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const data = db.prepare(`
    SELECT username, xp, level 
    FROM users 
    ORDER BY xp DESC 
    LIMIT 10
  `).all();
  res.json(data);
});

// Get user stats
app.get('/api/user/:id', (req, res) => {
  const user = db.prepare('SELECT username, xp, level FROM users WHERE id = ?').get(req.params.id);
  res.json(user);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});