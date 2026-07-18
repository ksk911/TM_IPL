import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { Trophy, Medal, Star, Download, Trash2, Crown, AlertTriangle, Users, ChevronDown, ChevronUp } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

// Compute a team's cumulative score. Disqualified rounds count as 0.
const computeTeamTotal = (scores = {}) => {
  let total = 0;
  for (const rKey in scores) {
    const entry = scores[rKey];
    if (!entry.disqualified) {
      total += Number(entry.score || 0);
    }
  }
  return Number(total.toFixed(2));
};

// Build sorted leaderboard array from room data
const buildLeaderboard = (room) => {
  if (!room?.teams) return [];

  return Object.values(room.teams)
    .map(team => ({
      ...team,
      total: computeTeamTotal(room.scores?.[team.id]),
      roundScores: room.scores?.[team.id] || {}
    }))
    .sort((a, b) => b.total - a.total);
};

// ─────────────────────────────────────────────────────────────────────
// MEDAL / POSITION DISPLAY
// ─────────────────────────────────────────────────────────────────────
const PositionBadge = ({ position }) => {
  const badges = {
    1: { icon: <Crown size={24} />, color: '#FFD700', label: '1st Place' },
    2: { icon: <Medal size={24} />, color: '#C0C0C0', label: '2nd Place' },
    3: { icon: <Medal size={24} />, color: '#CD7F32', label: '3rd Place' },
  };
  const badge = badges[position] || { icon: <span style={{ fontWeight: 'bold' }}>#{position}</span>, color: 'rgba(255,255,255,0.3)', label: `Place ${position}` };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 48, height: 48, borderRadius: '50%',
      background: badge.color, color: '#000', flexShrink: 0,
      boxShadow: `0 0 16px ${badge.color}66`
    }}>
      {badge.icon}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────
const Phase5Results = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const isAuctioneer = searchParams.get('role') === 'auctioneer';

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [dissolving, setDissolving] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      setRoom(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [roomId]);

  // ── CSV Export ──────────────────────────────────────────────────────
  const handleExport = () => {
    if (!room) return;
    const leaderboard = buildLeaderboard(room);
    const rounds = room.speakingSchedule ? Object.keys(room.speakingSchedule).sort() : [];

    // Header row
    const headers = ['Rank', 'Team', 'Total Score', ...rounds.map(r => `Round ${r.split('_')[1]} Score`), ...rounds.map(r => `Round ${r.split('_')[1]} DQ`)];
    const rows = leaderboard.map((team, idx) => {
      const roundScores = rounds.map(rKey => {
        const entry = team.roundScores[rKey];
        return entry ? (entry.disqualified ? '0 (DQ)' : entry.score) : '-';
      });
      const roundDQs = rounds.map(rKey => {
        const entry = team.roundScores[rKey];
        return entry?.disqualified ? 'YES' : 'NO';
      });
      return [idx + 1, team.name, team.total, ...roundScores, ...roundDQs];
    });

    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${room.name || 'IPL'}_Results.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Dissolve Room ───────────────────────────────────────────────────
  const handleDissolveRoom = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this room? All data will be lost.')) return;
    setDissolving(true);
    try {
      await remove(ref(db, `rooms/${roomId}`));
      window.location.href = '/setup'; // redirect everyone home
    } catch (err) {
      console.error('Failed to dissolve room', err);
      setDissolving(false);
    }
  };

  if (loading) return <div className="app-container"><div className="main-content"><h2>Calculating Results…</h2></div></div>;
  if (!room) return <div className="app-container"><div className="main-content"><h2>Room dissolved or not found.</h2></div></div>;

  const leaderboard = buildLeaderboard(room);
  const winner = leaderboard[0];
  const teamsList = room.teams ? Object.values(room.teams) : [];
  const rounds = room.speakingSchedule ? Object.keys(room.speakingSchedule).sort() : [];

  // ── AUDIENCE TOTALS (for fun sidebar) ───────────────────────────────
  // Gather audience votes from all closed votes stored in history
  // We don't persist round-by-round audience votes to a structured path, so we
  // use the single currentVoting object's audienceVotes as a live snapshot.
  const audienceVotes = room.currentVoting?.audienceVotes || {};
  const audienceAvg = Object.keys(audienceVotes).length > 0
    ? (Object.values(audienceVotes).reduce((a, b) => a + Number(b), 0) / Object.keys(audienceVotes).length).toFixed(2)
    : 'N/A';

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── WINNER BANNER ────────────────────────────────────────── */}
      {winner && (
        <div className="glass-card slide-up" style={{
          textAlign: 'center', padding: '4rem 2rem', marginBottom: '2rem',
          background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.25) 0%, rgba(15,23,42,0.7) 70%)',
          border: '1px solid rgba(255,215,0,0.3)',
          boxShadow: '0 0 60px rgba(255,215,0,0.1)'
        }}>
          <Crown size={80} style={{ color: '#FFD700', filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.6))', marginBottom: '1rem' }} />
          <p style={{ textTransform: 'uppercase', letterSpacing: '4px', color: '#FFD700', fontSize: '0.9rem', margin: 0 }}>Champion</p>
          <h1 style={{ fontSize: '3.5rem', fontWeight: '700', margin: '0.5rem 0', textShadow: '0 0 30px rgba(255,215,0,0.5)' }}>{winner.name}</h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,215,0,0.15)', padding: '0.8rem 2rem', borderRadius: '50px', border: '1px solid rgba(255,215,0,0.4)', marginTop: '1rem' }}>
            <Star size={20} style={{ color: '#FFD700' }} />
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FFD700' }}>{winner.total}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Total Points</span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>

        {/* ── LEADERBOARD ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ padding: '0 0.5rem' }}>Full Leaderboard</h2>

          {leaderboard.map((team, idx) => {
            const isExpanded = expandedTeam === team.id;

            return (
              <div key={team.id} className="glass-card" style={{
                maxWidth: '100%', padding: '0', overflow: 'hidden',
                border: idx === 0 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                boxShadow: idx === 0 ? '0 0 30px rgba(255,215,0,0.1)' : 'none'
              }}>

                {/* Team row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', cursor: 'pointer' }}
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  <PositionBadge position={idx + 1} />

                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{team.name}</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {Object.keys(team.roundScores).length} rounds scored
                      {Object.values(team.roundScores).some(r => r.disqualified) && (
                        <span style={{ color: 'var(--secondary)', marginLeft: '0.5rem' }}>
                          <AlertTriangle size={12} style={{ display: 'inline', marginRight: '2px' }} />
                          Has disqualification(s)
                        </span>
                      )}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: idx === 0 ? '#FFD700' : 'var(--accent)' }}>{team.total}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>total pts</div>
                  </div>
                  {isExpanded ? <ChevronUp size={20} style={{ opacity: 0.5 }} /> : <ChevronDown size={20} style={{ opacity: 0.5 }} />}
                </div>

                {/* Expanded round breakdown */}
                {isExpanded && (
                  <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-muted)', fontWeight: '500', fontSize: '0.85rem' }}>Round</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-muted)', fontWeight: '500', fontSize: '0.85rem' }}>Speaker(s)</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--text-muted)', fontWeight: '500', fontSize: '0.85rem' }}>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rounds.map(rKey => {
                          const entry = team.roundScores[rKey];
                          const rNum = rKey.split('_')[1];
                          const speakerNames = entry?.speakerId
                            ? entry.speakerId.split(',').map(id => room.players?.[id]?.name || id).join(' & ')
                            : '—';

                          return (
                            <tr key={rKey} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '0.7rem 0.5rem', fontWeight: '600', color: 'var(--primary)' }}>Round {rNum}</td>
                              <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.9rem', color: entry?.disqualified ? 'var(--text-muted)' : 'white', textDecoration: entry?.disqualified ? 'line-through' : 'none' }}>
                                {speakerNames}
                              </td>
                              <td style={{ padding: '0.7rem 0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                                {entry ? (
                                  entry.disqualified ? (
                                    <span style={{ color: 'var(--secondary)' }}>
                                      0.00 <span style={{ fontSize: '0.75rem', background: 'rgba(236,72,153,0.2)', padding: '2px 6px', borderRadius: '4px' }}>DQ</span>
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--accent)' }}>{entry.score}</span>
                                  )
                                ) : (
                                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── RIGHT SIDEBAR ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Audience Poll Box */}
          <div className="glass-card" style={{ maxWidth: '100%', padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Users size={18} color="var(--secondary)" /> Audience Poll
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Votes from the audience (for fun – not included in official scores).
            </p>
            {Object.keys(audienceVotes).length > 0 ? (
              <div>
                {Object.entries(audienceVotes).map(([uid, vote]) => (
                  <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Voter</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--secondary)' }}>{vote} / 10</span>
                  </div>
                ))}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Audience Avg</span>
                  <span style={{ color: 'var(--secondary)', fontSize: '1.2rem' }}>{audienceAvg}</span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', fontSize: '0.9rem' }}>No audience votes recorded.</p>
            )}
          </div>

          {/* Auctioneer Actions */}
          {isAuctioneer && (
            <div className="glass-card" style={{ maxWidth: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>Auctioneer Controls</h3>

              <button onClick={handleExport} className="primary-btn" style={{ width: '100%', background: 'var(--accent)' }}>
                <Download size={18} /> Export Results (CSV)
              </button>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }} />

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Dissolving the room deletes all data permanently. This is irreversible.
              </p>

              <button
                onClick={handleDissolveRoom}
                disabled={dissolving}
                style={{ width: '100%', padding: '1rem', border: '1px solid var(--secondary)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--secondary)', fontFamily: 'inherit', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Trash2 size={18} /> {dissolving ? 'Dissolving…' : 'Dissolve This Room'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Phase5Results;
