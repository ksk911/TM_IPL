import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { Users, ListOrdered, CheckCircle2, AlertCircle } from 'lucide-react';


// ---------------------------------------------------------------------------
// MAIN PHASE 3 COMPONENT
// ---------------------------------------------------------------------------
const Phase3Speaking = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const isAuctioneer = searchParams.get('role') === 'auctioneer';
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auctioneer Setup State
  const [numRounds, setNumRounds] = useState(3);
  // schedule format will now simply be: { "TeamA_1": "player_id_123", "TeamB_1": "player_id_456" }
  // Key = teamId_roundNumber
  // Value = selected playerId (or "empty" if none selected)
  const [schedule, setSchedule] = useState({});

  // When room is loaded and it's auctioneer, prepopulate the schedule object with empties if it doesn't exist
  useEffect(() => {
    if (!room || !isAuctioneer) return;
    
    // Only initialize if no locally drafted schedule exists
    if (!room.speakingSchedule && Object.keys(schedule).length === 0) {
      const newSchedule = {};
      const teams = Object.values(room.teams || {});
      
      teams.forEach(team => {
        for(let r = 1; r <= numRounds; r++) {
           newSchedule[`${team.id}_${r}`] = "empty";
        }
      });
      setSchedule(newSchedule);
    }
  }, [room, isAuctioneer, numRounds]);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoom(data);
        if (data.status === 'competition') {
          navigate(`/competition/${roomId}?userId=${userId}${isAuctioneer ? '&role=auctioneer' : ''}`);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, userId, navigate, isAuctioneer]);


  // Handle Dropdown Change
  const handleDropdownChange = (teamId, roundNum, playerId) => {
    setSchedule(prev => ({
      ...prev,
      [`${teamId}_${roundNum}`]: playerId
    }));
  };

  // Save to Firebase
  const handleLockSchedule = async () => {
    // Convert object states into structured firebase schedule formatting
    const firebaseSchedule = {};
    const teams = Object.values(room.teams || {});
    
    for (let r=1; r<=numRounds; r++) {
       firebaseSchedule[`round_${r}`] = {};
       
       teams.forEach(team => {
          // If the selected value is 'empty', save an empty array, else save an array with the single selected player ID
          const selectedPlayerId = schedule[`${team.id}_${r}`];
          firebaseSchedule[`round_${r}`][team.id] = (selectedPlayerId && selectedPlayerId !== 'empty') ? [selectedPlayerId] : [];
       });
    }

    try {
      await update(ref(db), {
        [`rooms/${roomId}/speakingSchedule`]: firebaseSchedule,
        [`rooms/${roomId}/scheduleLocked`]: true
      });
      alert('Speaking Order locked and synced!');
    } catch (err) {
       console.error("error saving schedule", err);
    }
  };

  const handleNextPhase = async () => {
    if (!room.scheduleLocked) {
        alert("Please Lock the Speaking Order first.");
        return;
    }
    try {
        await update(ref(db), { [`rooms/${roomId}/status`]: 'competition' });
    } catch(err) {
        console.error("error moving to next phase", err);
    }
  };


  if (loading) return <div className="app-container"><div className="main-content"><h2>Loading...</h2></div></div>;
  if (!room) return <div className="app-container"><div className="main-content"><h2>Room closed or not found</h2></div></div>;

  const teamsList = room.teams ? Object.values(room.teams) : [];

  // ------------------------------------------------------------------
  // VIEW: AUCTIONEER 
  // ------------------------------------------------------------------
  if (isAuctioneer) {
    return (
      <div className="dashboard-layout fade-in" style={{ padding: '2rem', maxWidth: '1400px', gridTemplateColumns: '250px 1fr' }}>
        
        {/* Sidebar: Controls */}
        <aside className="sidebar">
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
            <ListOrdered color="var(--accent)" />
            <h2 style={{margin: 0}}>Define Schedule</h2>
          </div>

          <div style={{marginBottom: '2rem'}}>
             <label style={{display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem'}}>Total Rounds</label>
             <input 
                type="number" 
                min="1" max="10" 
                value={numRounds} 
                onChange={(e) => setNumRounds(parseInt(e.target.value) || 3)}
                style={{width: '100%', padding: '0.8rem', background: 'var(--bg-input)'}}
             />
             <p style={{fontSize: '0.8rem', color: 'var(--secondary)', marginTop: '0.5rem'}}>Warning: Changing this will reset your board.</p>
          </div>

          <button onClick={handleLockSchedule} className="primary-btn" style={{width: '100%', marginBottom: '1rem', background: 'var(--accent)'}}>
             <CheckCircle2 size={18}/> Lock Schedule
          </button>

          <button onClick={handleNextPhase} className="primary-btn pulse-hover" style={{width: '100%', background: 'var(--primary)'}}>
             Start Competition 🚀
          </button>
        </aside>

        {/* Main Panel: Drag & Drop Board */}
        <div className="main-panel">
          <div className="glass-card" style={{ maxWidth: '100%', padding: '1.5rem', overflowX: 'auto' }}>
            <p className="subtitle" style={{marginBottom: '1rem', textAlign: 'center'}}>Use the dropdowns to assign exactly one player per round for each team.</p>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '1rem', borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-muted)' }}>Round</th>
                  {teamsList.map(t => (
                    <th key={t.id} style={{ padding: '1rem', borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left', fontSize: '1.2rem' }}>{t.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({length: numRounds}).map((_, rIndex) => {
                  const r = rIndex + 1;
                  return (
                    <tr key={`row_R${r}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1.5rem 1rem', fontWeight: 'bold', color: 'var(--primary)' }}>Round {r}</td>
                      
                      {teamsList.map(team => {
                        // Gather players for this team to populate the dropdown
                        const teamPlayerIds = team.players || [];
                        const teamPlayers = teamPlayerIds
                          .map(pId => room.players[pId])
                          .filter(p => !!p);

                        const currentSelection = schedule[`${team.id}_${r}`] || 'empty';

                        return (
                          <td key={team.id} style={{ padding: '1.5rem 1rem' }}>
                            <select 
                              value={currentSelection} 
                              onChange={(e) => handleDropdownChange(team.id, r, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.8rem',
                                borderRadius: '8px',
                                background: 'rgba(0,0,0,0.5)',
                                color: currentSelection === 'empty' ? 'rgba(255,255,255,0.5)' : '#fff',
                                border: '1px solid var(--glass-border)',
                                fontSize: '0.9rem',
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="empty">-- Select Speaker --</option>
                              {teamPlayers.map(p => (
                                <option key={p.id} value={p.id} style={{ color: '#000' }}>
                                  {p.name} ({p.role})
                                </option>
                              ))}
                            </select>
                            
                            {/* Visual indicator of selection underneath the dropdown */}
                            {currentSelection !== 'empty' && room.players[currentSelection] && (
                               <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.8rem'}}>
                                  <div style={{
                                     width: '24px', height: '24px', borderRadius: '50%', 
                                     backgroundImage: `url(${room.players[currentSelection].photoUrl})`, 
                                     backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#333'
                                  }} />
                                  <span style={{fontSize: '0.85rem', color: 'var(--accent)'}}>Assigned</span>
                               </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>

          </div>
        </div>



      </div>
    );
  }

  // ------------------------------------------------------------------
  // VIEW: AUDIENCE / JUDGE
  // ------------------------------------------------------------------
  
  if (!room.scheduleLocked) {
     return (
        <div className="app-container fade-in">
          <div className="main-content">
            <div className="glass-card" style={{textAlign: 'center', maxWidth: '600px'}}>
              <Users size={64} style={{color: 'var(--primary)', margin: '0 auto', marginBottom: '1rem'}} className="pulse-hover" />
              <h2>Captains are Huddled Up</h2>
              <p className="subtitle">The teams are currently deciding their speaking order for the competition rounds.</p>
              
              <div style={{marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center'}}>
                 <AlertCircle size={18} color="var(--secondary)"/>
                 <span style={{color: 'var(--text-muted)'}}>Waiting for Auctioneer to lock in the schedule...</span>
              </div>
            </div>
          </div>
        </div>
     );
  }

  // Schedule is locked! Show the table to everyone
  const speakingSchedule = room.speakingSchedule || {};
  const rounds = Object.keys(speakingSchedule).sort(); // round_1, round_2...

  return (
    <div className="app-container fade-in">
       <div className="main-content" style={{alignItems: 'flex-start', paddingTop: '4rem'}}>
          <div className="glass-card slide-up" style={{maxWidth: '1200px', width: '100%'}}>
             <h1 style={{textAlign: 'center', marginBottom: '0.5rem', color: 'var(--accent)'}}>Official Speaking Schedule</h1>
             <p className="subtitle" style={{textAlign: 'center', marginBottom: '3rem'}}>The battles are set. Prepare for Phase 4!</p>

             <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                   <thead>
                      <tr>
                         <th style={{padding: '1rem', borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-muted)'}}>Round</th>
                         {teamsList.map(t => (
                            <th key={t.id} style={{padding: '1rem', borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left', fontSize: '1.2rem'}}>{t.name}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody>
                      {rounds.map(rKey => {
                         const roundData = speakingSchedule[rKey];
                         const rNumber = rKey.split('_')[1];
                         return (
                            <tr key={rKey} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                               <td style={{padding: '1.5rem 1rem', fontWeight: 'bold', color: 'var(--primary)'}}>Round {rNumber}</td>
                               {teamsList.map(t => {
                                  const playerIds = roundData[t.id] || [];
                                  return (
                                     <td key={t.id} style={{padding: '1.5rem 1rem'}}>
                                        {playerIds.length === 0 ? (
                                           <span style={{color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem', fontStyle: 'italic'}}>Empty</span>
                                        ) : (
                                           <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                                              {playerIds.map((pId, idx) => {
                                                 const player = room.players[pId];
                                                 return (
                                                    <div key={pId} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(20, 184, 166, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid rgba(20, 184, 166, 0.3)'}}>
                                                       <div style={{width:'20px', height:'20px', borderRadius:'50%', backgroundImage: `url(${player?.photoUrl})`, backgroundSize: 'cover'}} />
                                                       <span style={{fontSize: '0.9rem', fontWeight: '500'}}>{player?.name}</span>
                                                    </div>
                                                 );
                                              })}
                                           </div>
                                        )}
                                     </td>
                                  )
                               })}
                            </tr>
                         )
                      })}
                   </tbody>
                </table>
             </div>
          </div>
       </div>
    </div>
  );
};

export default Phase3Speaking;
