import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { ref, set, get, child } from 'firebase/database';
// Using lucide-react for some quick nice icons
import { Users, UserPlus, PlayCircle, Settings, Key, ShieldCheck } from 'lucide-react';

const Phase1Setup = () => {
  const [activeTab, setActiveTab] = useState('join'); // 'join' or 'create'
  
  // Join Room State
  const [joinCode, setJoinCode] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [joinRole, setJoinRole] = useState('audience'); // 'audience' or 'judge_candidate'
  
  // Create Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [auctioneerName, setAuctioneerName] = useState('');
  
  const navigate = useNavigate();

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName || !auctioneerName) return;

    // Generate a random 6 character room code (e.g., A8F9K2)
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const roomData = {
      name: newRoomName,
      createdAt: Date.now(),
      status: 'setup', // setup, auction, speaking, competition, results
      auctioneer: auctioneerName,
      participants: {},
      players: {},
      teams: {},
      judges: {}, 
      currentPhaseData: {}
    };

    try {
      // Create room in Firebase Realtime Database
      await set(ref(db, `rooms/${roomCode}`), roomData);
      // Navigate to setup view with auctioneer flag
      navigate(`/setup-dashboard/${roomCode}?role=auctioneer`);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room. Check Firebase config.");
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode || !userName || !userEmail) return;
    
    const code = joinCode.toUpperCase();
    
    try {
      // Check if room exists
      const dbRef = ref(db);
      const snapshot = await get(child(dbRef, `rooms/${code}`));
      
      if (snapshot.exists()) {
        const participantId = Date.now().toString(); // simple ID generation
        
        // Add participant to room
        await set(ref(db, `rooms/${code}/participants/${participantId}`), {
          name: userName,
          email: userEmail,
          role: joinRole, // default role when joining "audience" or "judge_candidate"
          joinedAt: Date.now()
        });

        navigate(`/waiting-room/${code}?userId=${participantId}`);
      } else {
        alert("Room not found. Please check the code.");
      }
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Error joining room. Try again.");
    }
  };

  return (
    <div className="setup-container fade-in">
      <div className="glass-card setup-card">
        
        <div className="tab-switcher">
          <button 
            className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            <Users size={18} /> Join Event
          </button>
          <button 
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <Settings size={18} /> Create Event
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'join' ? (
            <div className="join-form-container slide-up">
              <h2>Join an IPL Event</h2>
              <p className="subtitle">Enter the room code provided by the Auctioneer</p>
              
              <form onSubmit={handleJoinRoom} className="glass-form">
                <div className="input-group">
                  <label><Key size={14} /> Room Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. A8F9K2" 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
                
                <div className="input-group">
                  <label><UserPlus size={14} /> Your Name</label>
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    placeholder="john@example.com" 
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="input-group checkbox-group">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={joinRole === 'judge_candidate'}
                      onChange={(e) => setJoinRole(e.target.checked ? 'judge_candidate' : 'audience')}
                    />
                    I want to be considered for a Judge role
                  </label>
                </div>

                <button type="submit" className="primary-btn pulse-hover">
                  Join & Cheer <PlayCircle size={18} />
                </button>
              </form>
            </div>
          ) : (
            <div className="create-form-container slide-up">
              <h2>Create New IPL Event</h2>
              <p className="subtitle">Set up a new space as the Auctioneer</p>
              
              <form onSubmit={handleCreateRoom} className="glass-form">
                <div className="input-group">
                  <label><Settings size={14} /> Event Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. College Fest IPL 2026" 
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label><ShieldCheck size={14} /> Auctioneer Name</label>
                  <input 
                    type="text" 
                    placeholder="Your Name" 
                    value={auctioneerName}
                    onChange={(e) => setAuctioneerName(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="primary-btn create-btn glow-hover">
                  Create Room & Start Setup
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Phase1Setup;
