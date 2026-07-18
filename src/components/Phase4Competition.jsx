import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { Timer, CheckCircle, Crosshair, Star, Users, Trophy, AlertTriangle } from 'lucide-react';

const Phase4Competition = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const isAuctioneer = searchParams.get('role') === 'auctioneer';
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Local state for judges/audience submitting votes
  const [myVote, setMyVote] = useState(5);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoom(data);
        if (data.status === 'results') {
          navigate(`/results/${roomId}?userId=${userId}${isAuctioneer ? '&role=auctioneer' : ''}`);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, userId, navigate, isAuctioneer]);

  // Master Timer effect driven by Firebase server time estimations
  useEffect(() => {
    if (!room?.currentVoting) return;

    const { endTime, status } = room.currentVoting;

    if (status === 'active') {
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(diff);
        
        if (diff === 0 && isAuctioneer) {
          // Timer naturally hit zero, auctioneer logic check if everyone voted
          handleTimerEndCheck(room);
        }
      };

      updateTimer(); // run immediately
      const interval = setInterval(updateTimer, 500); // Check half-second for accuracy
      return () => clearInterval(interval);
    } else {
      setTimeLeft(0);
    }
  }, [room?.currentVoting, isAuctioneer]);

  // Reset local vote state when a new speaker comes up
  useEffect(() => {
    if (room?.currentVoting?.status === 'active' && room?.currentVoting?.speakerId !== '') {
       // Just reset UI if speaker changes or new voting session starts
       const curVotes = room.currentVoting.votes || {};
       if (!curVotes[userId]) {
         setVoteSubmitted(false);
         setMyVote(5); // reset to middle
       }
    }
  }, [room?.currentVoting?.speakerId, room?.currentVoting?.status, userId]);


  // --------------------------------------------------------
  // AUCTIONEER ACTIONS
  // --------------------------------------------------------
  const handleStartVoting = async (speakerObj, roundName, teamId) => {
    // speakerObj is an array of playerIds (usually 1, maybe 2 for tag team)
    try {
      await update(ref(db), {
        [`rooms/${roomId}/currentVoting`]: {
          status: 'active',
          speakerId: speakerObj.join(','), // comma separated for tag teams
          roundName: roundName,
          teamId: teamId,
          endTime: Date.now() + 60000, // 60 seconds from now
          votes: {}, // judge votes
          audienceVotes: {}, 
          isExtended: false
        }
      });
    } catch (err) {
      console.error("Error starting voting", err);
    }
  };

  const handleTimerEndCheck = async (currentRoomData) => {
     // Because this can be tricky with multiple clients racing, 
     // the Auctioneer client acts as the "Server Source of Truth" for ending
     const voting = currentRoomData.currentVoting;
     if (!voting || voting.status !== 'active') return;

     const judges = Object.keys(currentRoomData.judges || {});
     const votes = Object.keys(voting.votes || {});

     const missingVotes = judges.filter(j => !votes.includes(j));

     if (missingVotes.length > 0) {
        // Someone is late! Extend by 15 seconds
        if (!voting.isExtended) {
           await update(ref(db), {
              [`rooms/${roomId}/currentVoting/endTime`]: Date.now() + 15000,
              [`rooms/${roomId}/currentVoting/isExtended`]: true
           });
        } else {
           // We already extended once, auto-close it anyway to prevent infinite hang
           await handleCloseVoting(currentRoomData);
        }
     } else {
        // Everyone voted
        await handleCloseVoting(currentRoomData);
     }
  };

  const handleCloseVoting = async (currentRoomData) => {
     const voting = currentRoomData.currentVoting;
     if (!voting) return;

     // Calculate average
     const votesObj = voting.votes || {};
     const voteValues = Object.values(votesObj);
     let finalScore = 0;
     
     if (voteValues.length > 0) {
        const sum = voteValues.reduce((a, b) => a + b, 0);
        finalScore = Number((sum / voteValues.length).toFixed(2));
     }

     // Write result to the room's permanent scoreboard
     // Log under team -> round -> score
     try {
       await update(ref(db), {
         [`rooms/${roomId}/currentVoting/status`]: 'closed',
         [`rooms/${roomId}/currentVoting/finalScore`]: finalScore,
         
         // Save to permanent record
         [`rooms/${roomId}/scores/${voting.teamId}/${voting.roundName}`]: {
            speakerId: voting.speakerId,
            score: finalScore,
            disqualified: false // Default false
         }
       });
     } catch (err) {
       console.error("Error closing remote voting", err);
     }
  };

  const handleManualDisqualify = async (teamId, roundName) => {
     try {
        await update(ref(db), {
           [`rooms/${roomId}/scores/${teamId}/${roundName}/disqualified`]: true,
           // Score visually stays in DB so we can show "crossed out", but logic treats as 0
        });
     } catch(err) {
        console.error("error disqualifying", err);
     }
  };

  const handleNextPhase = async () => {
    try {
        await update(ref(db), { [`rooms/${roomId}/status`]: 'results' });
    } catch(err) {
        console.error("error moving to results", err);
    }
  };

  // --------------------------------------------------------
  // JUDGE & AUDIENCE ACTIONS
  // --------------------------------------------------------
  const submitVoteToFirebase = async () => {
     const isJudge = room.judges?.[userId];
     const path = isJudge 
         ? `rooms/${roomId}/currentVoting/votes/${userId}` 
         : `rooms/${roomId}/currentVoting/audienceVotes/${userId}`;
     
     try {
        await update(ref(db), {
           [path]: Number(myVote)
        });
        setVoteSubmitted(true);
     } catch(err) {
        console.error("Failed to submit vote", err);
     }
  };


  if (loading) return <div className="app-container"><div className="main-content"><h2>Loading...</h2></div></div>;
  if (!room) return <div className="app-container"><div className="main-content"><h2>Room closed or not found</h2></div></div>;

  const schedule = room.speakingSchedule || {};
  const teamsList = room.teams ? Object.values(room.teams) : [];
  const judgesCount = Object.keys(room.judges || {}).length;
  
  const currentVoting = room.currentVoting || { status: 'idle' };
  
  const currentSpeakerNames = currentVoting.speakerId 
    ? currentVoting.speakerId.split(',').map(id => room.players[id]?.name).join(' & ') 
    : '';

  // Calculate live voting progress
  const currentVotesCount = Object.keys(currentVoting.votes || {}).length;
  const audienceVotesCount = Object.keys(currentVoting.audienceVotes || {}).length;
  const progressPercent = judgesCount > 0 ? (currentVotesCount / judgesCount) * 100 : 0;


  // ------------------------------------------------------------------
  // VIEW: AUCTIONEER 
  // ------------------------------------------------------------------
  if (isAuctioneer) {
    return (
      <div className="dashboard-layout fade-in" style={{ padding: '2rem', maxWidth: '1400px', gridTemplateColumns: '400px 1fr' }}>
        
        {/* Sidebar: Control Voting */}
        <aside className="sidebar" style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
          
          <div style={{borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem'}}>
            <h2 style={{display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0}}>
              <Trophy color="var(--accent)" /> Competition Control
            </h2>
          </div>

          <div className="glass-card" style={{padding: '1.5rem', background: 'rgba(0,0,0,0.3)'}}>
             <h3 style={{marginBottom: '1rem', color: 'var(--text-muted)'}}>Current Action</h3>
             
             {currentVoting.status === 'active' ? (
                <div style={{textAlign: 'center'}}>
                   <div style={{fontSize: '4rem', fontWeight: 'bold', color: timeLeft <= 10 ? 'var(--secondary)' : 'var(--accent)', fontFamily: 'monospace'}}>
                      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                   </div>
                   {currentVoting.isExtended && <p style={{color: 'var(--secondary)', fontWeight: 'bold'}}>⏰ Time Extended for Judges</p>}
                   
                   <div style={{margin: '1rem 0', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                      <p style={{margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)'}}>Judging Progress</p>
                      <p style={{fontSize: '1.5rem', fontWeight: '600', margin: '0.5rem 0'}}>{currentVotesCount} / {judgesCount} Voted</p>
                      <div style={{height: '8px', background: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden'}}>
                         <div style={{height: '100%', width: `${progressPercent}%`, background: 'var(--accent)', transition: 'width 0.3s'}} />
                      </div>
                   </div>

                   <button onClick={() => handleCloseVoting(room)} className="primary-btn" style={{width: '100%', background: 'var(--secondary)'}}>
                      Force Close Voting Now
                   </button>
                </div>
             ) : currentVoting.status === 'closed' ? (
                <div style={{textAlign: 'center'}}>
                   <div style={{fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)'}}>
                      {currentVoting.finalScore} <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>Avg</span>
                   </div>
                   <p style={{color: 'var(--accent)', fontWeight: 'bold'}}>{currentSpeakerNames} ({currentVoting.roundName})</p>
                   <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Audience Votes: {audienceVotesCount}</p>
                </div>
             ) : (
                <p style={{color: 'var(--text-muted)', textAlign: 'center'}}>Select a slot on the right to start voting.</p>
             )}
          </div>

          <button onClick={handleNextPhase} className="primary-btn pulse-hover" style={{width: '100%', background: 'var(--primary)', marginTop: 'auto'}}>
             Finish & Show Results 👑
          </button>
        </aside>

        {/* Main Panel: The Grid to trigger events */}
        <div className="main-panel">
          <div className="glass-card" style={{ maxWidth: '100%', padding: '1.5rem', overflowX: 'auto' }}>
            <p className="subtitle" style={{marginBottom: '2rem'}}>Click on a player slot to initiate their 60-second voting window. Mark as Disqualified if they exceed their speaking time on stage.</p>

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
                  {Object.keys(schedule).sort().map(rKey => {
                     const roundData = schedule[rKey];
                     const rNumber = rKey.split('_')[1]; // round_1 => 1
                     
                     return (
                        <tr key={rKey} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                           <td style={{padding: '1rem', fontWeight: 'bold', color: 'var(--primary)', verticalAlign: 'top'}}>R {rNumber}</td>
                           {teamsList.map(t => {
                              const playerIds = roundData[t.id] || [];
                              const scoreData = room.scores?.[t.id]?.[rKey]; // Check if already scored
                              const isDisqualified = scoreData?.disqualified;

                              if (playerIds.length === 0) return <td key={t.id} style={{padding: '1rem'}}></td>;

                              const pNames = playerIds.map(id => room.players[id]?.name).join(' & ');

                              const isCurrentlyActive = currentVoting.status === 'active' && currentVoting.roundName === rKey && currentVoting.teamId === t.id;

                              return (
                                 <td key={t.id} style={{padding: '1rem', verticalAlign: 'top'}}>
                                    <div style={{
                                       background: isCurrentlyActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)', 
                                       border: isCurrentlyActive ? '1px solid var(--primary)' : '1px solid transparent',
                                       padding: '1rem', borderRadius: '8px',
                                       opacity: isDisqualified ? 0.5 : 1
                                    }}>
                                       <div style={{fontWeight: '600', marginBottom: '0.5rem', textDecoration: isDisqualified ? 'line-through' : 'none'}}>{pNames}</div>
                                       
                                       {scoreData ? (
                                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                             <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: isDisqualified ? 'var(--secondary)' : 'var(--accent)'}}>
                                                {isDisqualified ? '0.00 (DQ)' : scoreData.score}
                                             </span>
                                             {!isDisqualified && (
                                                <button onClick={() => handleManualDisqualify(t.id, rKey)} style={{background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem'}}>
                                                   <AlertTriangle size={12}/> DQ
                                                </button>
                                             )}
                                          </div>
                                       ) : (
                                          <button 
                                             onClick={() => handleStartVoting(playerIds, rKey, t.id)}
                                             disabled={currentVoting.status === 'active'}
                                             className="primary-btn" 
                                             style={{padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: '100%', opacity: currentVoting.status === 'active' ? 0.5 : 1}}
                                          >
                                             Start Voting
                                          </button>
                                       )}
                                    </div>
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
    );
  }

  // ------------------------------------------------------------------
  // VIEW: AUDIENCE / JUDGE 
  // ------------------------------------------------------------------
  const isJudge = room.judges?.[userId];
  const participantData = room.participants?.[userId];

  if (currentVoting.status === 'idle') {
     return (
        <div className="app-container fade-in">
          <div className="main-content">
            <div className="glass-card" style={{textAlign: 'center', maxWidth: '600px'}}>
              <Crosshair size={64} style={{color: 'var(--primary)', margin: '0 auto', marginBottom: '1rem'}} className="pulse-hover" />
              <h2>Competition is Live</h2>
              <p className="subtitle">Wait for the speakers to finish their pitch on stage. The 60-second voting window will open automatically.</p>
            </div>
          </div>
        </div>
     );
  }

  if (currentVoting.status === 'active') {
     return (
        <div className="app-container fade-in">
          <div className="main-content" style={{marginTop: '2rem'}}>
            <div className={`glass-card ${voteSubmitted ? 'slide-up' : ''}`} style={{maxWidth: '800px', width: '100%', textAlign: 'center', padding: '3rem'}}>
              
              <h3 style={{color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem'}}>Currently Voting For</h3>
              <h1 style={{fontSize: '2.5rem', margin: 0}}>{currentSpeakerNames}</h1>
              <h2 style={{fontSize: '1.2rem', color: 'var(--accent)', marginTop: '0.5rem'}}>{room.teams[currentVoting.teamId]?.name}</h2>

              {/* Timer Display */}
              <div style={{margin: '3rem 0', display: 'inline-flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.4)', padding: '1rem 3rem', borderRadius: '50px', border: `2px solid ${timeLeft <= 10 ? 'var(--secondary)' : 'var(--primary)'}`}}>
                 <Timer size={32} color={timeLeft <= 10 ? 'var(--secondary)' : 'var(--primary)'} className={timeLeft <= 10 ? "pulse-hover" : ""} style={timeLeft <= 10 ? {animation: 'pulse 0.5s infinite'} : {}} />
                 <span style={{fontSize: '3rem', fontWeight: 'bold', fontFamily: 'monospace', color: timeLeft <= 10 ? 'var(--secondary)' : 'white'}}>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                 </span>
              </div>

              {/* Voting Interface */}
              {!voteSubmitted ? (
                 <div style={{background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px'}}>
                    <p style={{marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '500'}}>
                       {isJudge ? "Rate this pitch (1-10):" : "Audience Poll - How did they do?"}
                    </p>
                    
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem'}}>
                       <span style={{color: 'var(--text-muted)'}}>1</span>
                       <input 
                          type="range" 
                          min="1" max="10" step="1" 
                          value={myVote} 
                          onChange={(e) => setMyVote(e.target.value)}
                          style={{width: '300px', accentColor: 'var(--primary)', cursor: 'pointer'}}
                       />
                       <span style={{color: 'var(--text-muted)'}}>10</span>
                    </div>
                    
                    <div style={{fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '2rem'}}>{myVote}</div>

                    <button onClick={submitVoteToFirebase} className="primary-btn pulse-hover" style={{width: '200px', margin: '0 auto', fontSize: '1.2rem'}}>
                       <CheckCircle size={20} style={{marginRight: '0.5rem'}}/> Submit Vote
                    </button>
                 </div>
              ) : (
                 <div className="slide-up">
                    <CheckCircle color="var(--accent)" size={64} style={{margin: '0 auto', marginBottom: '1rem'}} />
                    <h2 style={{color: 'var(--accent)'}}>Vote Submitted Successfully</h2>
                    <p style={{color: 'var(--text-muted)'}}>Waiting for timer to expire...</p>
                 </div>
              )}

              {/* Status Footer */}
              <div style={{marginTop: '2rem', fontSize: '0.9rem', color: 'var(--text-muted)'}}>
                 {isJudge ? (
                    <span>You are an <strong>Official Judge</strong>. Your vote counts towards the final score.</span>
                 ) : (
                    <span>You are voting as Audience. This is for fun and doesn't affect the official score.</span>
                 )}
              </div>

            </div>
          </div>
        </div>
     );
  }

  // Voting Closed
  return (
      <div className="app-container fade-in">
         <div className="main-content">
            <div className="glass-card slide-up" style={{textAlign: 'center', maxWidth: '600px', padding: '4rem'}}>
               <Star size={80} color="var(--primary)" style={{margin: '0 auto', marginBottom: '1.5rem'}} />
               <h2 style={{color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '1rem'}}>Final Score</h2>
               <h1 style={{fontSize: '5rem', margin: '1rem 0', color: 'var(--accent)', textShadow: '0 0 20px rgba(20, 184, 166, 0.4)'}}>{currentVoting.finalScore}</h1>
               <h3 style={{fontSize: '1.5rem'}}>{currentSpeakerNames}</h3>
               <p style={{color: 'var(--text-muted)'}}>{room.teams[currentVoting.teamId]?.name}</p>
            </div>
         </div>
      </div>
  );
};

export default Phase4Competition;
