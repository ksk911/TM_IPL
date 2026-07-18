import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { ref, onValue, update, push } from 'firebase/database';
import { ShieldCheck, UserPlus, FileImage, Upload, List, Link } from 'lucide-react';

const SetupDashboard = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const isAuctioneer = searchParams.get('role') === 'auctioneer';
  
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // New Player Form State
  const [playerName, setPlayerName] = useState('');
  const [playerRole, setPlayerRole] = useState('Batsman');
  const [basePrice, setBasePrice] = useState(10);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    
    // Real-time listener on room data
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoom(data);
        if (data.status === 'auction') {
          navigate(`/auction/${roomId}?role=auctioneer`);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);



  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!playerName || !basePrice) return;

    setUploading(true);
    let photoUrl = photoUrlInput.trim();

    try {
      const playersRef = ref(db, `rooms/${roomId}/players`);
      const newPlayerRef = push(playersRef);
      
      await update(ref(db), {
        [`rooms/${roomId}/players/${newPlayerRef.key}`]: {
          id: newPlayerRef.key,
          name: playerName,
          role: playerRole,
          basePrice: Number(basePrice),
          photoUrl: photoUrl || 'https://via.placeholder.com/150', // placeholder if no photo
          status: 'available' // available, sold, unsold
        }
      });

      // Reset form
      setPlayerName('');
      setPlayerRole('Batsman');
      setBasePrice(10);
      setPhotoUrlInput('');

    } catch (error) {
      console.error("Error adding player:", error);
      alert("Failed to add player.");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectJudge = async (participantId, isCandidate) => {
     // Toggle judge status
     const currentJudges = room.judges || {};
     let updates = {};

     if (currentJudges[participantId]) {
         // remove judge
         updates[`rooms/${roomId}/judges/${participantId}`] = null;
         updates[`rooms/${roomId}/participants/${participantId}/role`] = 'audience';
     } else {
         // add judge
         // limit to maybe 3-5 judges practically, but let auctioneer decide
         updates[`rooms/${roomId}/judges/${participantId}`] = true;
         // update their role
         updates[`rooms/${roomId}/participants/${participantId}/role`] = 'judge';
     }

     try {
         await update(ref(db), updates);
     } catch (err) {
         console.error("Failed to update judge status", err);
     }
  };

  if (loading) return <div className="app-container"><div className="main-content"><h2>Loading Event Data...</h2></div></div>;
  
  if (!room) return <div className="app-container"><div className="main-content"><h2>Event not found!</h2></div></div>;

  if (!isAuctioneer) return <div className="app-container"><div className="main-content"><h2>Access Denied. Auctioneer only.</h2></div></div>;

  // Convert objects to arrays for rendering
  const playersList = room.players ? Object.values(room.players) : [];
  const participantsList = room.participants ? Object.entries(room.participants).map(([id, data]) => ({id, ...data})) : [];

  return (
    <div className="dashboard-layout fade-in" style={{ padding: '2rem' }}>
      
      {/* Sidebar: Event Info & Controls */}
      <aside className="sidebar">
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
          <ShieldCheck color="var(--accent)" />
          <h2 style={{margin: 0}}>{room.name}</h2>
        </div>
        
        <div style={{marginBottom: '2rem'}}>
          <p className="subtitle" style={{margin:0}}>Room Code (Share this)</p>
          <div style={{
            background: 'rgba(0,0,0,0.3)', 
            padding: '1rem', 
            borderRadius: '8px', 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            letterSpacing: '4px',
            textAlign: 'center',
            marginTop: '0.5rem',
            color: 'var(--primary)'
          }}>
            {roomId}
          </div>
        </div>

        <button 
           onClick={async () => {
             try {
               await update(ref(db), { [`rooms/${roomId}/status`]: 'auction' });
             } catch(err) {
               console.error("Failed to start auction", err);
             }
           }} 
           className="primary-btn pulse-hover" 
           style={{width: '100%'}}
        >
           Start Auction Phase ✨
        </button>
      </aside>

      {/* Main Panel */}
      <div className="main-panel">
        
        {/* Section 1: Add Players */}
        <div className="glass-card" style={{ maxWidth: '100%' }}>
          <h2 style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <UserPlus size={20}/> Player Management
          </h2>
          <p className="subtitle">Add players to the auction pool</p>
          
          <div style={{display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: '2rem'}}>
            
            {/* Add Player Form */}
            <form onSubmit={handleAddPlayer} className="glass-form" style={{background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px'}}>
              <div className="input-group">
                <label>Player Name</label>
                <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)} required />
              </div>
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div className="input-group">
                  <label>Role</label>
                  <select 
                    value={playerRole} 
                    onChange={e => setPlayerRole(e.target.value)}
                    style={{
                      background: 'var(--bg-input)', border: '1px solid var(--glass-border)', color: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', fontFamily: 'inherit'
                    }}
                  >
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Wicket Keeper">Wicket Keeper</option>
                  </select>
                </div>
                
                <div className="input-group">
                  <label>Base Price (Lakhs)</label>
                  <input type="number" min="1" value={basePrice} onChange={e => setBasePrice(e.target.value)} required />
                </div>
              </div>

              <div className="input-group">
                <label><Link size={14}/> Photo URL (Optional)</label>
                <input type="url" placeholder="https://..." value={photoUrlInput} onChange={e => setPhotoUrlInput(e.target.value)} />
              </div>

              <button type="submit" className="primary-btn" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Add Player to Pool'} <Upload size={16}/>
              </button>
            </form>

            {/* Added Players List */}
            <div style={{maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem'}}>
              <h3 style={{marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem'}}>Pool ({playersList.length})</h3>
              {playersList.length === 0 ? (
                <p style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem'}}>No players added yet.</p>
              ) : (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem'}}>
                  {playersList.map(p => (
                    <div key={p.id} style={{background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', textAlign: 'center'}}>
                      <div style={{height: '120px', backgroundColor: '#222', backgroundImage: `url(${p.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center'}} />
                      <div style={{padding: '0.8rem'}}>
                        <div style={{fontWeight: '600', fontSize: '0.9rem', marginBottom: '4px'}}>{p.name}</div>
                        <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.role}</div>
                        <div style={{fontSize: '0.85rem', color: 'var(--accent)', marginTop: '4px'}}>₹{p.basePrice}L</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Manage Judges from Participants */}
        <div className="glass-card" style={{ maxWidth: '100%' }}>
          <h2 style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <List size={20}/> Participant Management
          </h2>
          <p className="subtitle">Select Judges from the joined participants</p>

          <div style={{display: 'grid', gap: '1rem'}}>
            {participantsList.length === 0 ? (
               <p style={{color: 'var(--text-muted)'}}>Waiting for participants to join...</p>
            ) : (
              participantsList.map(participant => (
                <div key={participant.id} style={{
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '1rem',
                  borderRadius: '8px'
                }}>
                  <div>
                    <div style={{fontWeight: '500'}}>{participant.name}</div>
                    <div style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>{participant.email}</div>
                  </div>
                  
                  <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                    {participant.role === 'judge_candidate' && !room.judges?.[participant.id] && (
                      <span style={{fontSize: '0.8rem', color: 'var(--secondary)', backgroundColor: 'rgba(236, 72, 153, 0.2)', padding: '2px 8px', borderRadius: '12px'}}>
                        Wants to be Judge
                      </span>
                    )}
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'}}>
                      <input 
                        type="checkbox" 
                        checked={!!room.judges?.[participant.id]}
                        onChange={() => handleSelectJudge(participant.id, participant.role === 'judge_candidate')}
                      />
                      Make Judge
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SetupDashboard;
