import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { ref, onValue, update, push, set } from 'firebase/database';
import { User, Gavel, HandCoins, ArrowRight, ShieldCheck, CheckCircle2, UserX } from 'lucide-react';

const Phase2Auction = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const isAuctioneer = searchParams.get('role') === 'auctioneer';
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // New Team Setup State (Auctioneer Only)
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPurse, setNewTeamPurse] = useState(100);

  // Auction State (Auctioneer Only)
  const [finalBid, setFinalBid] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoom(data);
        
        // If the auctioneer moves the room to the next phase, auto-redirect
        if (data.status === 'speaking') {
          navigate(`/speaking/${roomId}?userId=${userId}${isAuctioneer ? '&role=auctioneer' : ''}`);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, userId, navigate, isAuctioneer]);

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName || !newTeamPurse) return;

    try {
      const teamsRef = ref(db, `rooms/${roomId}/teams`);
      const newTeamRef = push(teamsRef);
      
      await update(ref(db), {
        [`rooms/${roomId}/teams/${newTeamRef.key}`]: {
          id: newTeamRef.key,
          name: newTeamName,
          initialPurse: Number(newTeamPurse),
          currentPurse: Number(newTeamPurse),
          players: []
        }
      });
      setNewTeamName('');
      setNewTeamPurse(100);
    } catch (err) {
      console.error("Error adding team", err);
    }
  };

  const handleBringToBlock = async (playerId) => {
    try {
      await update(ref(db), {
        [`rooms/${roomId}/currentAuction`]: {
          playerId: playerId,
          status: 'active', // active, sold, unsold
          winningTeam: null,
          finalPrice: null
        }
      });
      // reset local auctioneer form
      setFinalBid('');
      setSelectedTeam('');
    } catch (err) {
      console.error("Error bringing to block", err);
    }
  };

  const handleSellPlayer = async (e) => {
    e.preventDefault();
    const auctionState = room?.currentAuction;
    if (!auctionState || !auctionState.playerId || !selectedTeam || !finalBid) return;

    const playerId = auctionState.playerId;
    const teamId = selectedTeam;
    const price = Number(finalBid);
    const team = room.teams[teamId];

    if (team.currentPurse < price) {
      alert(`Not enough funds! ${team.name} only has ₹${team.currentPurse}L`);
      return;
    }

    try {
      // 1. Update player status
      // 2. Deduct purse & add player to team
      // 3. Update current auction status to show celebratory screen
      const teamPlayers = team.players ? [...team.players] : [];
      teamPlayers.push(playerId);

      await update(ref(db), {
        [`rooms/${roomId}/players/${playerId}/status`]: 'sold',
        [`rooms/${roomId}/players/${playerId}/teamId`]: teamId,
        [`rooms/${roomId}/players/${playerId}/soldPrice`]: price,
        
        [`rooms/${roomId}/teams/${teamId}/currentPurse`]: team.currentPurse - price,
        [`rooms/${roomId}/teams/${teamId}/players`]: teamPlayers,

        [`rooms/${roomId}/currentAuction/status`]: 'sold',
        [`rooms/${roomId}/currentAuction/winningTeam`]: team.name,
        [`rooms/${roomId}/currentAuction/finalPrice`]: price,
      });

    } catch (err) {
      console.error("Error selling player", err);
    }
  };

  const handleUnsoldPlayer = async () => {
    const auctionState = room?.currentAuction;
    if (!auctionState || !auctionState.playerId) return;

    try {
      await update(ref(db), {
        [`rooms/${roomId}/players/${auctionState.playerId}/status`]: 'unsold',
        [`rooms/${roomId}/currentAuction/status`]: 'unsold',
      });
    } catch (err) {
      console.error("Error marking unsold", err);
    }
  };

  const handleNextPhase = async () => {
     try {
         await update(ref(db), {
             [`rooms/${roomId}/status`]: 'speaking'
         });
     } catch(err) {
         console.error("error moving to next phase", err);
     }
  };


  if (loading) return <div className="app-container"><div className="main-content"><h2>Loading...</h2></div></div>;
  if (!room) return <div className="app-container"><div className="main-content"><h2>Room closed or not found</h2></div></div>;

  const playersList = room.players ? Object.values(room.players) : [];
  const availablePlayers = playersList.filter(p => p.status === 'available');
  const teamsList = room.teams ? Object.values(room.teams) : [];
  const currentAuction = room.currentAuction;
  
  // The player currently on the block
  const currentPlayer = currentAuction?.playerId ? room.players[currentAuction.playerId] : null;

  // ------------------------------------------------------------------
  // VIEW: AUCTIONEER
  // ------------------------------------------------------------------
  if (isAuctioneer) {
    return (
      <div className="dashboard-layout fade-in" style={{ padding: '2rem' }}>
        
        {/* Sidebar: Control Panel */}
        <aside className="sidebar">
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
            <Gavel color="var(--accent)" />
            <h2 style={{margin: 0}}>Auction Control</h2>
          </div>

          {/* Teams Setup */}
          <div style={{marginBottom: '2rem'}}>
            <h3 style={{fontSize: '1.1rem', marginBottom: '1rem'}}>Manage Teams</h3>
            <form onSubmit={handleAddTeam} style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem'}}>
              <input 
                 type="text" 
                 placeholder="Team Name" 
                 value={newTeamName} 
                 onChange={e => setNewTeamName(e.target.value)} 
                 style={{padding: '0.8rem'}}
                 required 
              />
              <input 
                 type="number" 
                 placeholder="Initial Purse (Lakhs)" 
                 value={newTeamPurse} 
                 onChange={e => setNewTeamPurse(e.target.value)} 
                 style={{padding: '0.8rem'}}
                 required 
              />
              <button type="submit" className="primary-btn" style={{padding: '0.6rem'}}>Add Team</button>
            </form>

            <div style={{maxHeight: '200px', overflowY: 'auto'}}>
              {teamsList.map(t => (
                <div key={t.id} style={{background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{fontWeight: '500'}}>{t.name}</span>
                  <span style={{color: 'var(--accent)', fontWeight: 'bold'}}>₹{t.currentPurse}L</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleNextPhase} className="primary-btn pulse-hover" style={{width: '100%', background: 'var(--secondary)'}}>
             End Auction & Proceed
          </button>
        </aside>

        {/* Main Panel: The Block & Player Pool */}
        <div className="main-panel">
          
          {/* Top Section: The Block */}
          {currentPlayer ? (
            <div className="glass-card" style={{ maxWidth: '100%', borderColor: currentAuction.status === 'sold' ? 'var(--accent)' : 'var(--primary)' }}>
              
              {currentAuction.status === 'active' && (
                <div style={{display: 'flex', gap: '2rem'}}>
                  <div style={{flex: 1, textAlign: 'center'}}>
                     <div style={{height: '250px', width: '250px', margin: '0 auto', borderRadius: '12px', backgroundImage: `url(${currentPlayer.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'}} />
                     <h2 style={{marginTop: '1rem', fontSize: '2rem'}}>{currentPlayer.name}</h2>
                     <p className="subtitle" style={{fontSize: '1.2rem', margin: 0}}>{currentPlayer.role}</p>
                     <div style={{fontSize: '1.5rem', color: 'var(--accent)', fontWeight: 'bold', marginTop: '0.5rem'}}>Base: ₹{currentPlayer.basePrice}L</div>
                  </div>

                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '12px'}}>
                    <h3>Record Bid</h3>
                    {teamsList.length === 0 ? (
                       <p style={{color: 'var(--secondary)'}}>Please add teams in the sidebar first!</p>
                    ) : (
                       <form onSubmit={handleSellPlayer} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                         <div className="input-group">
                           <label>Final Bid (Lakhs)</label>
                           <input type="number" min={currentPlayer.basePrice} value={finalBid} onChange={e => setFinalBid(e.target.value)} required />
                         </div>
                         <div className="input-group">
                           <label>Sold To Team</label>
                           <select 
                             value={selectedTeam} 
                             onChange={e => setSelectedTeam(e.target.value)}
                             style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)', color: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', fontFamily: 'inherit' }}
                             required
                           >
                             <option value="" disabled>Select Team</option>
                             {teamsList.map(t => (
                               <option key={t.id} value={t.id}>{t.name} (Purse: ₹{t.currentPurse}L)</option>
                             ))}
                           </select>
                         </div>
                         <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                            <button type="submit" className="primary-btn pulse-hover" style={{flex: 2, background: 'var(--accent)'}}>
                              <Gavel size={18}/> Sell Player
                            </button>
                            <button type="button" onClick={handleUnsoldPlayer} className="primary-btn" style={{flex: 1, background: 'var(--bg-card)', color: 'var(--text-muted)'}}>
                              <UserX size={18}/> Unsold
                            </button>
                         </div>
                       </form>
                    )}
                  </div>
                </div>
              )}

              {currentAuction.status === 'sold' && (
                <div style={{textAlign: 'center', padding: '3rem 0'}} className="slide-up">
                  <CheckCircle2 size={80} color="var(--accent)" style={{margin: '0 auto', marginBottom: '1rem'}} />
                  <h1 style={{fontSize: '3rem', color: 'var(--accent)', textShadow: '0 0 20px rgba(20, 184, 166, 0.5)', margin: 0}}>SOLD!</h1>
                  <h2 style={{fontSize: '2rem'}}>{currentPlayer.name}</h2>
                  <p style={{fontSize: '1.5rem', color: 'var(--text-muted)'}}>
                    to <strong style={{color: 'white'}}>{currentAuction.winningTeam}</strong> for <strong style={{color: 'var(--secondary)'}}>₹{currentAuction.finalPrice}L</strong>
                  </p>
                  <button onClick={() => update(ref(db), { [`rooms/${roomId}/currentAuction`]: null })} className="primary-btn" style={{margin: '2rem auto 0'}}>Next Player</button>
                </div>
              )}

              {currentAuction.status === 'unsold' && (
                <div style={{textAlign: 'center', padding: '3rem 0'}} className="slide-up">
                  <UserX size={80} color="var(--text-muted)" style={{margin: '0 auto', marginBottom: '1rem'}} />
                  <h1 style={{fontSize: '3rem', color: 'var(--text-muted)', margin: 0}}>UNSOLD</h1>
                  <h2 style={{fontSize: '2rem'}}>{currentPlayer.name}</h2>
                  <button onClick={() => update(ref(db), { [`rooms/${roomId}/currentAuction`]: null })} className="primary-btn" style={{margin: '2rem auto 0'}}>Next Player</button>
                </div>
              )}

            </div>
          ) : (
            <div className="glass-card" style={{ maxWidth: '100%', textAlign: 'center', padding: '4rem' }}>
              <Gavel size={64} style={{opacity: 0.2, margin: '0 auto', marginBottom: '1rem'}} />
              <h2>No Player on Output Block</h2>
              <p className="subtitle">Select a player from the available pool below to start bidding.</p>
            </div>
          )}

          {/* Bottom Section: Available Pool */}
          <div className="glass-card" style={{ maxWidth: '100%' }}>
              <h2 style={{borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem'}}>Available Pool ({availablePlayers.length})</h2>
              
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem'}}>
                {availablePlayers.map(p => (
                  <div key={p.id} style={{background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', textAlign: 'center', paddingBottom: '1rem'}}>
                    <div style={{height: '180px', backgroundColor: '#222', backgroundImage: `url(${p.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center'}} />
                    <div style={{padding: '1rem 0.5rem'}}>
                      <div style={{fontWeight: '600', fontSize: '1.1rem'}}>{p.name}</div>
                      <div style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>{p.role}</div>
                      <div style={{fontSize: '1rem', color: 'var(--accent)', marginTop: '4px', fontWeight: 'bold'}}>Base: ₹{p.basePrice}L</div>
                    </div>
                    <button 
                       onClick={() => handleBringToBlock(p.id)} 
                       disabled={currentPlayer?.id === p.id}
                       className="primary-btn" 
                       style={{margin: '0 auto', padding: '0.5rem 1rem', fontSize: '0.9rem'}}
                    >
                      {currentPlayer?.id === p.id ? 'On Block' : 'Bring to Block'}
                    </button>
                  </div>
                ))}
              </div>
              {availablePlayers.length === 0 && (
                 <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>No more players available.</p>
              )}
          </div>

        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // VIEW: AUDIENCE / JUDGE (PRESENTATION VIEW)
  // ------------------------------------------------------------------
  return (
    <div className="app-container fade-in">
      
      {/* Absolute overlay for team purses at the top */}
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem 2rem', display: 'flex', gap: '1rem', overflowX: 'auto', background: 'rgba(0,0,0,0.5)', zIndex: 10}}>
        {teamsList.map(t => (
          <div key={t.id} style={{background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '0.5rem 1rem', borderRadius: '8px', whiteSpace: 'nowrap'}}>
            <span style={{fontWeight: '500', marginRight: '1rem'}}>{t.name}</span>
            <span style={{color: 'var(--accent)', fontWeight: 'bold'}}>₹{t.currentPurse}L</span>
          </div>
        ))}
      </div>

      <div className="main-content" style={{marginTop: '4rem'}}>
        {currentPlayer ? (
           <div className="glass-card slide-up" style={{maxWidth: '800px', width: '100%', padding: '0', overflow: 'hidden', border: 'none', background: 'transparent', boxShadow: 'none'}}>
             
             {currentAuction.status === 'active' && (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <div style={{
                       height: '400px', width: '400px', 
                       borderRadius: '24px', 
                       backgroundImage: `url(${currentPlayer.photoUrl})`, 
                       backgroundSize: 'cover', backgroundPosition: 'center',
                       boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                       position: 'relative'
                    }}>
                       <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', padding: '3rem 2rem 2rem', borderRadius: '0 0 24px 24px', textAlign: 'center'}}>
                          <h1 style={{fontSize: '3rem', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.8)'}}>{currentPlayer.name}</h1>
                          <p style={{fontSize: '1.5rem', color: 'rgba(255,255,255,0.8)', margin: '0.5rem 0'}}>{currentPlayer.role}</p>
                       </div>
                    </div>
                    
                    <div style={{
                       marginTop: '-30px', zIndex: 5,
                       background: 'var(--primary)', padding: '1rem 3rem', borderRadius: '50px',
                       boxShadow: '0 10px 30px var(--primary-glow)',
                       display: 'flex', alignItems: 'center', gap: '1rem'
                    }} className="pulse-hover">
                       <Gavel size={24} />
                       <span style={{fontSize: '1.5rem', fontWeight: 'bold'}}>Base Price: ₹{currentPlayer.basePrice}L</span>
                    </div>

                    <p style={{marginTop: '2rem', fontSize: '1.2rem', color: 'var(--text-muted)', textAlign: 'center'}}>
                       <span className="pulse-hover" style={{display: 'inline-block', animation: 'pulse 1s infinite'}}>🔴</span> Bidding Live
                    </p>
                </div>
             )}

             {currentAuction.status === 'sold' && (
                <div style={{textAlign: 'center', background: 'var(--bg-card)', backdropFilter: 'blur(20px)', padding: '4rem', borderRadius: '32px', border: '2px solid var(--accent)', boxShadow: '0 0 50px rgba(20, 184, 166, 0.3)'}} className="slide-up">
                  <h1 style={{fontSize: '5rem', color: 'var(--accent)', textShadow: '0 0 30px rgba(20, 184, 166, 0.5)', margin: 0, letterSpacing: '4px'}}>SOLD!</h1>
                  <div style={{height: '200px', width: '200px', margin: '2rem auto', borderRadius: '50%', backgroundImage: `url(${currentPlayer.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'}} />
                  <h2 style={{fontSize: '3rem', margin: '1rem 0'}}>{currentPlayer.name}</h2>
                  <div style={{fontSize: '2rem', color: 'var(--text-muted)'}}>
                    purchased by <strong style={{color: 'white', display: 'block', fontSize: '2.5rem', margin: '1rem 0'}}>{currentAuction.winningTeam}</strong> 
                    for <strong style={{color: 'var(--secondary)', fontSize: '3rem'}}>₹{currentAuction.finalPrice}L</strong>
                  </div>
                </div>
             )}

             {currentAuction.status === 'unsold' && (
                <div style={{textAlign: 'center', background: 'var(--bg-card)', backdropFilter: 'blur(20px)', padding: '4rem', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)'}} className="slide-up">
                  <h1 style={{fontSize: '4rem', color: 'var(--text-muted)', margin: 0, letterSpacing: '4px'}}>UNSOLD</h1>
                  <div style={{height: '200px', width: '200px', margin: '2rem auto', filter: 'grayscale(100%)', opacity: 0.5, borderRadius: '50%', backgroundImage: `url(${currentPlayer.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center'}} />
                  <h2 style={{fontSize: '2rem', color: 'var(--text-muted)'}}>{currentPlayer.name}</h2>
                </div>
             )}

           </div>
        ) : (
           <div style={{textAlign: 'center', color: 'var(--text-muted)'}}>
              <ShieldCheck size={80} style={{opacity: 0.2, margin: '0 auto', marginBottom: '2rem'}} />
              <h2 style={{fontSize: '2rem', fontWeight: '400'}}>Waiting for next player...</h2>
           </div>
        )}
      </div>
    </div>
  );
};

export default Phase2Auction;
