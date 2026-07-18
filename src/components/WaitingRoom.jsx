import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Clock, CheckCircle } from 'lucide-react';

const WaitingRoom = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const navigate = useNavigate();
  
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoom(data);
        
        // If the auctioneer moves the room to the next phase, auto-redirect
        if (data.status === 'auction') {
          navigate(`/auction/${roomId}?userId=${userId}`);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, userId, navigate]);

  if (loading) return <div className="app-container"><div className="main-content"><h2>Loading...</h2></div></div>;
  if (!room) return <div className="app-container"><div className="main-content"><h2>Room closed or not found</h2></div></div>;

  const myParticipantData = room.participants?.[userId];
  const isJudge = room.judges?.[userId];

  return (
    <div className="app-container fade-in">
      <div className="main-content">
        <div className="glass-card" style={{textAlign: 'center'}}>
          
          <h2 style={{marginBottom: '0.5rem'}}>{room.name}</h2>
          <p className="subtitle">Auctioneer: {room.auctioneer}</p>
          
          <div style={{
            margin: '2rem 0', 
            padding: '2rem', 
            background: 'var(--bg-input)', 
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <Clock size={48} color="var(--primary)" className="pulse-hover" style={{animation: 'pulse 2s infinite'}} />
            <h3 style={{fontSize: '1.2rem', fontWeight: '500'}}>Waiting for the Auctioneer to begin...</h3>
            <p style={{color: 'var(--text-muted)'}}>Hang tight, the action will start shortly.</p>
          </div>

          <div style={{
            padding: '1rem',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)',
            background: isJudge ? 'rgba(20, 184, 166, 0.1)' : 'rgba(255,255,255,0.05)',
            textAlign: 'left'
          }}>
            <h4 style={{marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem'}}>Your Status</h4>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontWeight: '500'}}>{myParticipantData?.name || 'Guest'}</span>
              
              {isJudge ? (
                <span style={{display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent)', fontWeight: '600', fontSize: '0.9rem'}}>
                  <CheckCircle size={16} /> Selected as Judge
                </span>
              ) : (
                <span style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                  Audience Member
                </span>
              )}
            </div>
            
            {!isJudge && myParticipantData?.role === 'judge_candidate' && (
              <p style={{fontSize: '0.8rem', color: 'var(--secondary)', marginTop: '0.5rem'}}>
                (Waiting for Auctioneer to confirm your Judge status)
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
