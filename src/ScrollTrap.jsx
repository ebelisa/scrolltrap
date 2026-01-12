import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Scroll Trap – IG-like Teen Safety Simulation (FIXED v4)
 * 
 * Fixes applied:
 * - No object mutations (readonly property error fix)
 * - postCounterRef changed to useState
 * - buildPost accepts all parameters directly
 * - SafeImg without spread operator
 */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#111827"/>
        <stop offset="1" stop-color="#000000"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      fill="#9ca3af" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="28">
      Immagine non disponibile
    </text>
  </svg>
`);

function buildUnsplashUrl(photoId, w = 900) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&q=80`;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Reel video component - thumbnail + play on click
function ReelVideo({ youtubeId, onPlay, style }) {
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const hasTriggeredPlay = useRef(false);

  // Track when visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            if (onPlay && !hasTriggeredPlay.current) {
              hasTriggeredPlay.current = true;
              onPlay();
            }
          }
        });
      },
      { threshold: [0.5] }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [onPlay]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  // Thumbnail from YouTube
  const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/0.jpg`;
  
  // YouTube embed URL (starts when clicked)
  const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&loop=1&playlist=${youtubeId}&controls=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", background: "#000", ...style }}>
      {!isPlaying ? (
        <>
          {/* Thumbnail */}
          <img 
            src={thumbnailUrl} 
            alt="Reel" 
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Play button overlay */}
          <div 
            onClick={handlePlay}
            style={{ 
              position: "absolute", 
              inset: 0, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              background: "rgba(0,0,0,0.3)",
              cursor: "pointer"
            }}
          >
            <div style={{ 
              width: 70, 
              height: 70, 
              borderRadius: "50%", 
              background: "rgba(255,255,255,0.95)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
            }}>
              <span style={{ fontSize: 30, marginLeft: 6, color: "#000" }}>▶</span>
            </div>
          </div>
          {/* Reel badge */}
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, zIndex: 10 }}>
            <span style={{ fontSize: 14 }}>🎬</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Reel</span>
          </div>
          {/* Tap to watch text */}
          <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center" }}>
            <span style={{ background: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: 20, fontSize: 13, color: "#fff", fontWeight: 600 }}>Tocca per guardare</span>
          </div>
        </>
      ) : (
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}

function SafeImg({ src, alt, style, loading, getAltSrc, maxRetries = 2 }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setCurrentSrc(src);
    setTries(0);
  }, [src]);

  const onError = useCallback(() => {
    if (tries < maxRetries && typeof getAltSrc === "function") {
      const next = getAltSrc(tries + 1);
      if (next && next !== currentSrc) {
        setCurrentSrc(next);
        setTries((t) => t + 1);
        return;
      }
    }
    setCurrentSrc(FALLBACK_IMG);
  }, [tries, maxRetries, getAltSrc, currentSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      style={style}
      loading={loading}
      onError={onError}
    />
  );
}

export default function ScrollTrap() {
  // ==================== STATE ====================
  const [gameState, setGameState] = useState("intro");
  const [accountName, setAccountName] = useState("");
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [timeSpent, setTimeSpent] = useState(0);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  const unlockAudio = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume();
      audioUnlockedRef.current = true;
    } catch (e) {}
  }, [soundEnabled]);

  const playPop = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = audioCtxRef.current;
    if (!ctx || !audioUnlockedRef.current) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(520, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.13);
    } catch (e) {}
  }, [soundEnabled]);

  const [userInterests, setUserInterests] = useState(() => ({
    friends: 1, crush: 1, music: 1, style: 1, sports: 1, memes: 1,
  }));

  const [mood, setMood] = useState(50);
  const moodRef = useRef(50);
  const [moodHistory, setMoodHistory] = useState([50]);
  const [dopamineSpikes, setDopamineSpikes] = useState(0);

  const [activePosts, setActivePosts] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [postCounter, setPostCounter] = useState(1000);

  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [likesReceived, setLikesReceived] = useState(0);

  const [notificationClicks, setNotificationClicks] = useState(0);
  const [emptyNotificationClicks, setEmptyNotificationClicks] = useState(0);
  const [scrollDistance, setScrollDistance] = useState(0);

  const [adsClicked, setAdsClicked] = useState(0);
  const [dmReplies, setDmReplies] = useState(0);
  const [profileVisits, setProfileVisits] = useState(0);
  const [storiesWatched, setStoriesWatched] = useState(0);
  const [reelsWatched, setReelsWatched] = useState(0);
  const [sharedClickbait, setSharedClickbait] = useState(0);
  const [storiesPollClicks, setStoriesPollClicks] = useState(0);
  const [typingShownCount, setTypingShownCount] = useState(0);

  const [exitedOnTime, setExitedOnTime] = useState(false);
  const [ignoredEmptyNotifs, setIgnoredEmptyNotifs] = useState(true);
  const [refusedSuspicious, setRefusedSuspicious] = useState(true);
  const [rareEventShown, setRareEventShown] = useState(false);

  const [streak, setStreak] = useState(3);
  const [showStreakWarning, setShowStreakWarning] = useState(false);

  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);
  const notifHideTimerRef = useRef(null);

  const [notificationsLog, setNotificationsLog] = useState([]);
  const [showNotificationsInbox, setShowNotificationsInbox] = useState(false);

  const [showHeartAnimation, setShowHeartAnimation] = useState(null);
  const [currentTyping, setCurrentTyping] = useState(null);

  const [showDMInbox, setShowDMInbox] = useState(false);
  const [showDM, setShowDM] = useState(false);
  const [currentDM, setCurrentDM] = useState(null);

  const [showFriendRequest, setShowFriendRequest] = useState(false);
  const [currentFriendRequest, setCurrentFriendRequest] = useState(null);
  const [acceptedFriendRequests, setAcceptedFriendRequests] = useState([]);

  const [showStory, setShowStory] = useState(false);
  const [currentStory, setCurrentStory] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);

  const [showComments, setShowComments] = useState(false);
  const [currentComments, setCurrentComments] = useState(null);

  const [showProfile, setShowProfile] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);

  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateImageUrl, setCertificateImageUrl] = useState(null);

  const feedRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastScrollRef = useRef(0);

  // ==================== DATA ====================
  // Content packs GenZ - foto + caption AUTENTICHE italiane
  const contentPacks = useMemo(() => ({
    friends: [
      { img: "photo-1529626455594-4ff0802cfb7e", caption: "le mie 🤍" },
      { img: "photo-1529156069898-49953e39b3ac", caption: "noi" },
      { img: "photo-1543269865-cbf427effbad", caption: "seratina" },
      { img: "photo-1524638431109-93d95c968f03", caption: "fra che ridere ieri" },
      { img: "photo-1517462964-21fdcec3f25b", caption: "ci si rivede 🫶" },
      { img: "photo-1529333166437-7750a6dd5a70", caption: "raga vi voglio bene" },
      { img: "photo-1539571696357-5a69c17a67c6", caption: "queste serate >>" },
      { img: "photo-1524504388940-b1c1722653e1", caption: "dump" },
    ],
    selfie: [
      { img: "photo-1534528741775-53994a69daeb", caption: "📸" },
      { img: "photo-1517841905240-472988babdf9", caption: "nuova me" },
      { img: "photo-1544005313-94ddf0286df2", caption: "oggi sì" },
      { img: "photo-1488426862026-3ee34a7d66df", caption: "mi piacevo" },
      { img: "photo-1507003211169-0a1dd7228f2d", caption: "." },
      { img: "photo-1524250502761-1ac6f2e30d43", caption: "vabbè" },
      { img: "photo-1528892952291-009c663ce843", caption: "specchio amico" },
    ],
    aesthetic: [
      { img: "photo-1519638399535-1b036603ac77", caption: "🌙" },
      { img: "photo-1502823403499-6ccfcf4fb453", caption: "momenti" },
      { img: "photo-1516726817505-f5ed825624d8", caption: "✨" },
      { img: "photo-1500917293891-ef795e70e1f6", caption: "giornate così" },
      { img: "photo-1515886657613-9f3515b0c78f", caption: "tutto qui" },
      { img: "photo-1502767089025-6572583495b6", caption: "ricordi belli" },
      { img: "photo-1519699047748-de8e457a634e", caption: "💫" },
    ],
    music: [
      { img: "photo-1493225457124-a3eb161ffa5f", caption: "che concerto ragazzi" },
      { img: "photo-1511671782779-c97d3d27a1d4", caption: "si vola 🎪" },
      { img: "photo-1506157786151-b8491531f063", caption: "una bomba ieri sera" },
      { img: "photo-1470225620780-dba8ba36b745", caption: "🔊🔊🔊" },
      { img: "photo-1514525253161-7a46d19cd819", caption: "raga era pazzesco" },
      { img: "photo-1501386761578-eac5c94b800a", caption: "indimenticabile" },
      { img: "photo-1524368535928-5b5e00ddc76b", caption: "🎧" },
      { img: "photo-1571266028243-d220c6a40e6a", caption: "in loop da ore" },
    ],
    style: [
      { img: "photo-1542291026-7eec264c27ff", caption: "nuove 👟" },
      { img: "photo-1483985988355-763728e1935b", caption: "danni" },
      { img: "photo-1509631179647-0177331693ae", caption: "fit" },
      { img: "photo-1552374196-1ab2a1c593e8", caption: "outfit del giorno" },
      { img: "photo-1521334884684-d80222895322", caption: "ootd 📸" },
      { img: "photo-1556905055-8f358a7a47b2", caption: "che ne dite" },
      { img: "photo-1560243563-062bfc001d68", caption: "finalmente arrivate" },
      { img: "photo-1558171013-36c8b1a5e238", caption: "🔥" },
    ],
    sports: [
      { img: "photo-1517649763962-0c623066013b", caption: "si soffre" },
      { img: "photo-1534438327276-14e5300c3a48", caption: "day 47" },
      { img: "photo-1581009146145-b5ef050c2e1e", caption: "buongiorno così" },
      { img: "photo-1549060279-7e168fcee0c2", caption: "🛹" },
      { img: "photo-1571019614242-c5c5dee9f50b", caption: "record" },
      { img: "photo-1599058917765-a780eda07a3e", caption: "🏀" },
      { img: "photo-1571902943202-507ec2618e8f", caption: "fatto ✓" },
      { img: "photo-1583454110551-21f2fa2afe61", caption: "gambe distrutte" },
    ],
    memes: [
      { img: "photo-1517849845537-4d257902454a", caption: "mood" },
      { img: "photo-1587300003388-59208cc962cb", caption: "io oggi" },
      { img: "photo-1574158622682-e40e69881006", caption: "lunedì be like" },
      { img: "photo-1583511655857-d19b40a7a54e", caption: "letteralmente io" },
      { img: "photo-1543466835-00a7907e9de1", caption: "vabbè raga" },
      { img: "photo-1514888286974-6c03e2ca1dba", caption: "aiuto" },
      { img: "photo-1518791841217-8f162f1e1131", caption: "nel gruppo ora" },
      { img: "photo-1591946614720-90a587da4a36", caption: "💀💀💀" },
    ],
    food: [
      { img: "photo-1565299624946-b28f40a0ae38", caption: "che fame" },
      { img: "photo-1567620905732-2d1ec7ab7445", caption: "brunch della domenica" },
      { img: "photo-1540189549336-e6e99c3679fe", caption: "si mangia" },
      { img: "photo-1504674900247-0877df9cc836", caption: "buonissimo raga" },
      { img: "photo-1476224203421-9ac39bcb3327", caption: "sgarro" },
    ],
    travel: [
      { img: "photo-1507525428034-b723cf961d3e", caption: "portatemi via" },
      { img: "photo-1520483601560-389dff434fdf", caption: "📍" },
      { img: "photo-1502920917128-1aa500764cbd", caption: "questi posti" },
      { img: "photo-1500530855697-b586d89ba3ee", caption: "che bello qui" },
      { img: "photo-1476514525535-07fb3b4ae5f1", caption: "già mi manca" },
    ],
  }), []);

  // Backward compatibility - extract just image IDs
  const imageDB = useMemo(() => ({
    friends: contentPacks.friends.map(p => p.img),
    crush: contentPacks.aesthetic.map(p => p.img),
    music: contentPacks.music.map(p => p.img),
    style: contentPacks.style.map(p => p.img),
    sports: contentPacks.sports.map(p => p.img),
    memes: contentPacks.memes.map(p => p.img),
  }), [contentPacks]);

  // YouTube Shorts con caption AUTENTICHE italiane GenZ
  // YouTube Shorts REALI virali - contenuti diversificati 2024-2025
  // ID presi dai video più visti su YouTube Shorts
  const reelPacks = useMemo(() => [
    // Satisfying / Magic tricks
    { id: "ldSVhw1Nv50", caption: "come ha fatto?? 😱" },        // Justin Flom dress transformation
    { id: "qeGTXIFn3gQ", caption: "troppo carino 🥺" },          // Rose Makes Brownies
    // Comedy / Pranks  
    { id: "3Lb5_40Qakg", caption: "mamma vs papà 💀" },          // Dad vs Mom amusement park
    { id: "jE9SMQuF-o8", caption: "i genitori be like" },        // Parents comedy
    // Challenge / Sports
    { id: "aU2KRF87RPc", caption: "trick shot assurdo" },        // Colin Amazing trick shots
    { id: "Cx4LPYA0oMQ", caption: "parkour goals 🔥" },          // Spider-Man Parkour
    // Family / Cute
    { id: "_RgRvHwzE4I", caption: "auguri 🎂" },                 // Happy Birthday viral
    { id: "BNof_SlHB88", caption: "ahahahah" },                  // Batman comedy
    // Animals / Pets
    { id: "ALZetvgszCo", caption: "che dolce 🥹" },              // Kind animal video
    { id: "VL_Iv3ef-74", caption: "importante" },                // Save water cute
    // Dance / Trend
    { id: "OPf0YbXqDm0", caption: "questo ballo >>" },           
    { id: "kJQP7kiw5Fk", caption: "in loop" },
    // Food
    { id: "ztwHL6JEE6M", caption: "che fame guardando" },        // Chinese burger
    // Random viral
    { id: "TtPcz3hZPCc", caption: "oddio 😂" },                  // Car race monster
  ], []);

  // Backward compatibility
  const videoDB = useMemo(() => reelPacks.map(p => p.id), [reelPacks]);
  const reelCaptions = useMemo(() => reelPacks.map(p => p.caption), [reelPacks]);

  const overlaysByCat = useMemo(() => ({
    friends: ["Roma 📍", "Milano 📍", "sabato 🌙", "serata", ""],
    crush: ["amici stretti 💜", "👀", "", "solo per te", ""],
    music: ["LIVE 🎤", "🔁", "tour 2026", "sold out", ""],
    style: ["ootd ✨", "new 🔥", "haul", "", ""],
    sports: ["palestra 💪", "", "record", "partita 🏆", ""],
    memes: ["", "mood", "💀💀💀", "", ""],
  }), []);

  // Queste caption non servono più - usiamo contentPacks
  const captionsByCat = useMemo(() => ({
    friends: [
      "noi", "dump", "serata",
      "raga", "che ridere", "🤍",
    ],
    crush: [
      ".", "👀", "vabbè",
      "boh", "🫶", "",
    ],
    music: [
      "in loop 🎧", "chi viene??", "che bomba",
      "top", "terapia", "🔊",
    ],
    style: [
      "fit", "oggi così", "nuove 🛍️",
      "che dite? 👇", "trovate", "drip",
    ],
    sports: [
      "si soffre 💪", "gambe finite", "record",
      "palestra", "buongiorno", "riposo",
    ],
    memes: [
      "lunedì", "ultimo scroll", "mood",
      "io appena sveglio", "boh", "raga",
      "SHOCK: quello che non ti dicono 😱",
      "NON CI CREDERAI: guarda cosa è successo",
      "TUTTI ne parlano e tu? 🔥",
      "devi vedere questo SUBITO",
      "la verità che nessuno ti dice",
      "💀",
    ],
  }), []);

  const teenUsernames = useMemo(() => [
    "giu.rossi", "fra_04", "vale.b", "sofi_roma", "nico.mp4",
    "emma_x", "ale.ferri", "marti_07", "fede.zeta", "tommi.dv",
    "cami.b", "leo_gamer", "sara.jpg", "lore_nz", "giulia.08",
    "marco_ferri", "chiara.mp3", "dani_rm", "eli.03", "gabri.vibes",
  ], []);

  const myHandle = useMemo(() => {
    const v = (accountName || "").trim();
    return v.length ? v.replace(/^@/, "") : "tuo_account";
  }, [accountName]);

  const altSrcFromCategory = useCallback((cat, w = 900) => () =>
    buildUnsplashUrl(pick(imageDB[cat] || imageDB.friends), w),
  [imageDB]);

  const initialStories = useMemo(() => [
    {
      id: "st1", user: "giu.rossi",
      avatar: buildUnsplashUrl("photo-1539571696357-5a69c17a67c6", 200),
      seen: false,
      slides: [
        { image: buildUnsplashUrl(pick(imageDB.friends), 900), text: "Chi esce stasera? 🍸", poll: { a: "Io", b: "Non posso" } },
        { image: buildUnsplashUrl(pick(imageDB.style), 900), text: "Close friends? 👀", poll: { a: "Sì", b: "No" } },
      ],
    },
    {
      id: "st2", user: "nico.mp4",
      avatar: buildUnsplashUrl("photo-1507003211169-0a1dd7228f2d", 200),
      seen: false,
      slides: [
        { image: buildUnsplashUrl(pick(imageDB.music), 900), text: "Nuova ossessione 🎧", poll: { a: "Same", b: "Skip" } },
      ],
    },
    {
      id: "st3", user: "emma_x",
      avatar: buildUnsplashUrl("photo-1534528741775-53994a69daeb", 200),
      seen: false,
      slides: [
        { image: buildUnsplashUrl(pick(imageDB.style), 900), text: "Fit check ✅", poll: { a: "Top", b: "Boh" } },
      ],
    },
    {
      id: "st4", user: "fra_04",
      avatar: buildUnsplashUrl("photo-1488426862026-3ee34a7d66df", 200),
      seen: false,
      slides: [
        { image: buildUnsplashUrl(pick(imageDB.memes), 900), text: "POV: dici 'ultimo scroll' 😭", poll: { a: "Io", b: "Mai" } },
      ],
    },
  ], [imageDB]);

  const [storyList, setStoryList] = useState(initialStories);

  const friendRequests = useMemo(() => [
    {
      id: "fr1", user: "giada_03",
      avatar: buildUnsplashUrl("photo-1529626455594-4ff0802cfb7e", 220),
      bio: "Roma • snap? 🖤", followers: 1240, following: 38, posts: 2,
      mutualFriends: 0, suspicious: true,
      flags: ["0 amici in comune", "pochi post", "chiede di spostarsi altrove"],
    },
    {
      id: "fr2", user: "matti.b",
      avatar: buildUnsplashUrl("photo-1506794778202-cad84cf45f1d", 220),
      bio: "4ª • basket • 🍕", followers: 680, following: 540, posts: 66,
      mutualFriends: 3, suspicious: false,
      flags: ["amici in comune", "attività normale"],
    },
    {
      id: "fr3", user: "laura_mi",
      avatar: buildUnsplashUrl("photo-1517841905240-472988babdf9", 220),
      bio: "Milano • DM aperti", followers: 5200, following: 12, posts: 3,
      mutualFriends: 0, suspicious: true,
      flags: ["0 amici in comune", "follower sospetti", "segue pochissimi"],
    },
    {
      id: "fr4", user: "sara.foto",
      avatar: buildUnsplashUrl("photo-1524638431109-93d95c968f03", 220),
      bio: "Roma • foto • booking", followers: 3100, following: 900, posts: 210,
      mutualFriends: 5, suspicious: false,
      flags: ["portfolio reale", "amici in comune"],
    },
  ], []);

  const baseDMs = useMemo(() => [
    {
      id: "dm1", user: "giu.rossi",
      avatar: buildUnsplashUrl("photo-1539571696357-5a69c17a67c6", 220),
      preview: "Hai visto cosa ha postato Sofi?? 😱", scam: false,
      messages: [
        { from: "them", text: "Ehi! tutto ok?", time: "20:31" },
        { from: "them", text: "Hai visto cosa ha postato Sofi?? 😱", time: "20:32" },
      ],
    },
    {
      id: "dm2", user: "promo.official",
      avatar: buildUnsplashUrl("photo-1557992260-ec58e38d363c", 220),
      preview: "Congratulazioni! Hai vinto…", scam: true,
      messages: [
        { from: "them", text: "🎉 Congratulazioni! Hai vinto un iPhone!", time: "18:10" },
        { from: "them", text: "Clicca per riscattare → link", time: "18:10" },
      ],
    },
    {
      id: "dm3", user: "nico.mp4",
      avatar: buildUnsplashUrl("photo-1507003211169-0a1dd7228f2d", 220),
      preview: "Per il concerto, ti dico…", scam: false,
      messages: [
        { from: "them", text: "Hai sentito l'ultima traccia?", time: "16:42" },
        { from: "them", text: "Ci vediamo al live?", time: "16:43" },
      ],
    },
    {
      id: "dm_rare_familiar", user: "ale_05",
      avatar: buildUnsplashUrl("photo-1500648767791-00dcc994a43e", 220),
      preview: "Ci conosciamo? Mi sembri familiare…",
      scam: true, teenSafety: true, rare: true,
      messages: [
        { from: "them", text: "Ehi 👋", time: "adesso" },
        { from: "them", text: "Ci conosciamo? Mi sembri familiare…", time: "adesso" },
        { from: "them", text: "Sei di Roma?", time: "adesso" },
      ],
    },
  ], []);

  const [dmInbox, setDmInbox] = useState(baseDMs);

  const buildEscalationDM = useCallback((req) => {
    const asks = [
      "Sei di che zona?", "Che scuola fai?", "Quanti anni hai?",
      "Passiamo su WhatsApp? qui mi bugga", "Mi mandi una foto? (solo per capire)",
    ];
    const ask = pick(asks);
    return {
      id: `dm_escal_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      user: req.user, avatar: req.avatar,
      preview: `Ehi 🙂 ${ask}`,
      scam: true, teenSafety: true,
      messages: [
        { from: "them", text: "Ehi 🙂", time: "adesso" },
        { from: "them", text: ask, time: "adesso" },
      ],
    };
  }, []);

  const notificationTypes = useMemo(() => [
    { text: `❤️ A @sofi_roma piace il post di @${myHandle}`, hasContent: true, mood: 8 },
    { text: `💬 @nico.mp4 ti ha scritto: "Top!"`, hasContent: true, mood: 10, action: "dm" },
    { text: `👤 @giada_03 vuole seguire @${myHandle}`, hasContent: true, mood: 2, action: "friendRequest" },
    { text: `🔔 Nuove notifiche per @${myHandle}`, hasContent: false, mood: -6 },
    { text: `📸 @giu.rossi ti ha taggato`, hasContent: false, mood: -3 },
    { text: `👀 Qualcuno ha visitato il profilo di @${myHandle}`, hasContent: false, mood: -8 },
    { text: `🔥 Il post di @${myHandle} sta andando bene`, hasContent: false, mood: -2 },
    { text: `📩 Nuovo messaggio in richieste`, hasContent: true, mood: 4, action: "dm" },
    { text: `📸 Qualcuno ha fatto screenshot della tua storia`, hasContent: false, mood: -12, rare: true },
    { text: `🔥 VIRALE: il tuo post ha 10.000+ visualizzazioni!`, hasContent: false, mood: 15, rare: true },
  ], [myHandle]);

  const typingUsers = useMemo(() => [
    "giu.rossi", "nico.mp4", "sofi_roma", "la tua crush 💕", "qualcuno…"
  ], []);

  // ==================== BUILD POST (NO MUTATIONS) ====================
  // Build post with coherent content (photo + caption match)
  const buildPost = useCallback(({
    id, user, cat, caption, isAd = false,
    imageUrl, imageOverlay, postType, isFake, fomoText
  }) => {
    // Pick coherent content pack if available
    const catPacks = contentPacks[cat] || contentPacks.friends;
    const contentPack = pick(catPacks);
    const coherentCaption = caption || contentPack.caption;
    const coherentImg = imageUrl || buildUnsplashUrl(contentPack.img, 900);
    
    const overlay = pick(overlaysByCat[cat] || overlaysByCat.friends);
    const avatarId = pick(imageDB.friends);

    return {
      id,
      user,
      avatar: buildUnsplashUrl(avatarId, 180),
      verified: isAd || Math.random() > 0.84,
      content: coherentCaption,
      image: {
        type: cat,
        url: coherentImg,
        overlay: imageOverlay !== undefined ? imageOverlay : (isAd ? "SPONSORED" : overlay),
      },
      likes: Math.floor(Math.random() * 8000) + 120,
      comments: Math.floor(Math.random() * 280) + 8,
      time: pick(["adesso", "2 min", "12 min", "1 ora", "ieri"]),
      isAd,
      type: postType !== undefined ? postType : (isAd ? "ad" : "normal"),
      fake: isFake !== undefined ? isFake : false,
      fomoText: fomoText !== undefined ? fomoText : null,
      commentsList: [
        { user: pick(teenUsernames), text: pick(["🔥🔥", "top", "bellissima", "wow", "😍", "💀"]), avatar: 11 },
        { user: pick(teenUsernames), text: pick(["dove??", "taggami", "voglio", "ahahah", "bella"]), avatar: 22 },
      ],
    };
  }, [contentPacks, imageDB, overlaysByCat, teenUsernames]);

  // Build Reel post with coherent video + caption
  const buildReel = useCallback(({ id, user }) => {
    const reelPack = pick(reelPacks);
    const avatarId = pick(imageDB.friends);
    
    return {
      id,
      user,
      avatar: buildUnsplashUrl(avatarId, 180),
      verified: Math.random() > 0.7,
      content: reelPack.caption,
      isReel: true,
      youtubeId: reelPack.id,
      likes: Math.floor(Math.random() * 25000) + 1000,
      comments: Math.floor(Math.random() * 800) + 50,
      shares: Math.floor(Math.random() * 500) + 20,
      time: pick(["adesso", "5 min", "1 ora", "3 ore"]),
      isAd: false,
      type: "reel",
      commentsList: [
        { user: pick(teenUsernames), text: pick(["🔥🔥🔥", "tutorial", "manda", "wow", "💀💀", "assurdo"]), avatar: 11 },
        { user: pick(teenUsernames), text: pick(["come?", "pazzesco", "raga", "oddio", "bello"]), avatar: 22 },
      ],
    };
  }, [reelPacks, imageDB, teenUsernames]);

  const initialPosts = useMemo(() => [
    buildPost({ id: 1, user: "giu.rossi", cat: "friends" }),
    buildPost({ id: 2, user: "nico.mp4", cat: "music" }),
    buildReel({ id: 3, user: "emma_x" }),
    buildPost({ id: 4, user: "fra_04", cat: "memes" }),
    buildPost({ id: 5, user: "SPONSORED", cat: "style", caption: "🔥 Solo oggi: sconto del 60%! Tocca per vedere", isAd: true }),
    buildReel({ id: 6, user: "leo_gamer" }),
    buildPost({ id: 7, user: "ale.style", cat: "style" }),
    buildPost({ id: 8, user: "marco_fit", cat: "sports" }),
  ], [buildPost, buildReel]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (gameState !== "playing") return;
    setActivePosts(initialPosts);
    startTimeRef.current = Date.now();
    setTimeSpent(0);
    lastScrollRef.current = 0;
    setShowStreakWarning(false);
    setShowNotificationPopup(false);
    setActiveNotification(null);
    setCurrentTyping(null);
    setShowDM(false);
    setCurrentDM(null);
    setShowDMInbox(false);
    setShowFriendRequest(false);
    setCurrentFriendRequest(null);
    setShowStory(false);
    setCurrentStory(null);
    setStoryProgress(0);
    setShowComments(false);
    setCurrentComments(null);
    setShowProfile(false);
    setCurrentProfile(null);
    setNotificationsLog([]);
    setShowNotificationsInbox(false);
    setDmInbox(baseDMs);
    setStoryList(initialStories);
    setTypingShownCount(0);
    setPostCounter(1000);
  }, [gameState, initialPosts, baseDMs, initialStories]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const t = setInterval(() => {
      if (!startTimeRef.current) return;
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [gameState]);

  useEffect(() => { moodRef.current = mood; }, [mood]);

  // Fix scroll when entering reveal
  useEffect(() => {
    if (gameState === "reveal") {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
      window.scrollTo(0, 0);
    } else if (gameState === "playing") {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const moodTimer = setInterval(() => {
      setMoodHistory((prev) => {
        const next = prev.concat([moodRef.current]);
        return next.length > 45 ? next.slice(next.length - 45) : next;
      });
      setMood((m) => clamp(m - 1, 15, 100));
    }, 2000);
    return () => clearInterval(moodTimer);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const likeTimer = setInterval(() => {
      if (Math.random() > 0.55) {
        const plus = Math.floor(Math.random() * 4) + 1;
        setLikesReceived((x) => x + plus);
        setMood((m) => clamp(m + 3, 0, 100));
        setDopamineSpikes((d) => d + 1);
        playPop();
      }
    }, 5200 + Math.floor(Math.random() * 2500));
    return () => clearInterval(likeTimer);
  }, [gameState, playPop]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const typingTimer = setInterval(() => {
      const blocked = showDM || showStory || showFriendRequest || showDMInbox || showNotificationsInbox;
      if (Math.random() > 0.65 && !blocked) {
        setCurrentTyping(pick(typingUsers));
        setTypingShownCount((c) => c + 1);
        setTimeout(() => setCurrentTyping(null), 2200 + Math.floor(Math.random() * 1600));
      }
    }, 11000);
    return () => clearInterval(typingTimer);
  }, [gameState, showDM, showStory, showFriendRequest, showDMInbox, showNotificationsInbox, typingUsers]);

  useEffect(() => {
    if (gameState !== "playing") return;
    let alive = true;
    let timerId = null;
    const blocked = () => showDM || showDMInbox || showStory || showFriendRequest || showComments || showProfile || showNotificationsInbox;
    const schedule = () => {
      if (!alive) return;
      const delay = 6000 + Math.floor(Math.random() * 4500);
      timerId = setTimeout(() => {
        if (!alive) return;
        if (!blocked() && Math.random() > 0.45) {
          const availableNotifs = rareEventShown ? notificationTypes.filter((n) => !n.rare) : notificationTypes;
          const notif = pick(availableNotifs);
          if (notif.rare && !rareEventShown) setRareEventShown(true);
          const entry = {
            id: `n_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            ts: Date.now(), text: notif.text, hasContent: notif.hasContent,
            mood: notif.mood, action: notif.action, rare: notif.rare,
          };
          setActiveNotification(entry);
          setShowNotificationPopup(true);
          setNotificationsLog((prev) => [entry].concat(prev).slice(0, 40));
          playPop();
          if (notifHideTimerRef.current) clearTimeout(notifHideTimerRef.current);
          notifHideTimerRef.current = setTimeout(() => setShowNotificationPopup(false), 4200);
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      alive = false;
      if (timerId) clearTimeout(timerId);
      if (notifHideTimerRef.current) clearTimeout(notifHideTimerRef.current);
    };
  }, [gameState, showDM, showDMInbox, showStory, showFriendRequest, showComments, showProfile, showNotificationsInbox, notificationTypes, playPop, rareEventShown]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const timer = setTimeout(() => {
      const blocked = showDM || showDMInbox || showStory || showComments || showProfile || showFriendRequest || showNotificationsInbox;
      if (!blocked) {
        // Filter out already accepted requests
        const pendingRequests = friendRequests.filter(r => !acceptedFriendRequests.some(a => a.user === r.user));
        if (pendingRequests.length > 0) {
          setCurrentFriendRequest(pick(pendingRequests));
          setShowFriendRequest(true);
        }
      }
    }, 14000 + Math.floor(Math.random() * 7000));
    return () => clearTimeout(timer);
  }, [gameState, showDM, showDMInbox, showStory, showComments, showProfile, showFriendRequest, showNotificationsInbox, friendRequests, acceptedFriendRequests]);

  // Timer streak warning rimosso - nessun suggerimento durante la simulazione

  useEffect(() => {
    if (!showStory || !currentStory) return;
    const interval = setInterval(() => {
      setStoryProgress((p) => {
        const slides = currentStory.slides.length;
        const inc = 100 / (slides * 30);
        if (p >= 100) {
          setShowStory(false);
          setStoriesWatched((s) => s + 1);
          setStoryList((prev) => prev.map((st) => st.id === currentStory.id ? { ...st, seen: true } : st));
          return 0;
        }
        return p + inc;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [showStory, currentStory]);

  // ==================== HANDLERS ====================
  const weightedCategoryPick = useCallback((weights) => {
    const entries = Object.entries(weights);
    const total = entries.reduce((acc, [, w]) => acc + w, 0);
    let r = Math.random() * total;
    for (const [cat, w] of entries) {
      r -= w;
      if (r <= 0) return cat;
    }
    return "friends";
  }, []);

  const generateNewPosts = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setPostCounter((prevCounter) => {
        let currentId = prevCounter;
        setActivePosts((prev) => {
          const currentCount = prev.length;
          const batch = [];
          const weightsSnapshot = { ...userInterests };
          for (let i = 0; i < 4; i += 1) {
            const cat = weightedCategoryPick(weightsSnapshot);
            const isAd = (currentCount + i) % 7 === 0 && i > 0;
            const isReel = !isAd && Math.random() > 0.7; // ~30% reels
            const postId = currentId;
            currentId = currentId + 1;
            
            if (isReel) {
              // Generate a Reel with coherent video + caption
              const newReel = buildReel({
                id: postId,
                user: pick(teenUsernames),
              });
              batch.push(newReel);
            } else {
              // Generate regular post with coherent photo + caption
              const isFomo = !isAd && Math.random() > 0.72;
              const isClickbait = !isAd && cat === "memes" && Math.random() > 0.75;
              const newPost = buildPost({
                id: postId,
                user: isAd ? "SPONSORED" : pick(teenUsernames),
                cat,
                caption: isAd ? "🔥 Offerta limitata: 'Solo per oggi'. Tocca per vedere." : undefined,
                isAd,
                postType: isAd ? "ad" : isClickbait ? "clickbait" : isFomo ? "fomo" : "normal",
                isFake: isClickbait,
                fomoText: isFomo ? `${Math.floor(Math.random() * 30) + 10} tuoi amici hanno interagito` : null,
              });
              batch.push(newPost);
            }
          }
          return prev.concat(batch);
        });
        return currentId;
      });
      setIsLoadingMore(false);
    }, 900);
  }, [userInterests, weightedCategoryPick, teenUsernames, buildPost, buildReel]);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const delta = Math.abs(scrollTop - lastScrollRef.current);
    lastScrollRef.current = scrollTop;
    setScrollDistance((d) => d + delta);
    if (scrollHeight - scrollTop - clientHeight < 420 && !isLoadingMore) {
      generateNewPosts();
    }
  }, [isLoadingMore, generateNewPosts]);

  const handleLike = useCallback((post) => {
    if (likedPosts.includes(post.id)) {
      setLikedPosts((prev) => prev.filter((id) => id !== post.id));
      return;
    }
    playPop();
    setLikedPosts((prev) => prev.concat([post.id]));
    setMood((m) => clamp(m + 3, 0, 100));
    setShowHeartAnimation(post.id);
    setDopamineSpikes((d) => d + 1);
    setTimeout(() => setShowHeartAnimation(null), 700);
    const t = post?.image?.type;
    if (t && Object.prototype.hasOwnProperty.call(userInterests, t)) {
      setUserInterests((u) => ({ ...u, [t]: u[t] + 2 }));
    }
  }, [likedPosts, playPop, userInterests]);

  const handlePostAction = useCallback((post, action) => {
    if (action === "comment") {
      setCurrentComments(post);
      setShowComments(true);
    } else if (action === "profile") {
      setCurrentProfile(post);
      setShowProfile(true);
      setProfileVisits((x) => x + 1);
    } else if (action === "share") {
      if (post.type === "clickbait" || post.fake) setSharedClickbait((x) => x + 1);
    } else if (action === "save") {
      setSavedPosts((s) => s.includes(post.id) ? s.filter((id) => id !== post.id) : s.concat([post.id]));
    } else if (action === "ad") {
      setAdsClicked((x) => x + 1);
    }
  }, []);

  const openDMInbox = useCallback(() => { playPop(); setShowDMInbox(true); setShowNotificationsInbox(false); }, [playPop]);
  const openDM = useCallback((dm) => { playPop(); setCurrentDM(dm); setShowDM(true); setShowDMInbox(false); setShowNotificationsInbox(false); }, [playPop]);
  const openNotificationsInbox = useCallback(() => { playPop(); setShowNotificationsInbox(true); setShowDMInbox(false); }, [playPop]);

  const triggerFriendRequestModal = useCallback(() => {
    // Filter out already accepted requests
    const pendingRequests = friendRequests.filter(r => !acceptedFriendRequests.some(a => a.user === r.user));
    if (pendingRequests.length === 0) return; // No more requests to show
    // Prioritize suspicious requests
    const req = pendingRequests.find((r) => r.suspicious) || pendingRequests[0];
    setCurrentFriendRequest(req);
    setShowFriendRequest(true);
    setShowNotificationsInbox(false);
  }, [friendRequests, acceptedFriendRequests]);

  const handleNotificationClick = useCallback((notif) => {
    setNotificationClicks((x) => x + 1);
    setShowNotificationPopup(false);
    if (!notif.hasContent) {
      setEmptyNotificationClicks((x) => x + 1);
      setMood((m) => clamp(m - 8, 0, 100));
      setIgnoredEmptyNotifs(false);
    } else {
      setMood((m) => clamp(m + (notif.mood || 0), 0, 100));
      setDopamineSpikes((d) => d + 1);
      playPop();
    }
    if (notif.action === "friendRequest") triggerFriendRequestModal();
    else if (notif.action === "dm") { setShowDMInbox(true); setShowNotificationsInbox(false); }
  }, [playPop, triggerFriendRequestModal]);

  const handleFriendRequestAction = useCallback((accept) => {
    const req = currentFriendRequest;
    if (!req) { setShowFriendRequest(false); return; }
    if (accept) {
      // Check if already accepted this user
      const alreadyAccepted = acceptedFriendRequests.some(r => r.user === req.user);
      if (!alreadyAccepted) {
        setAcceptedFriendRequests((prev) => prev.concat([req]));
        if (req.suspicious) {
          setRefusedSuspicious(false);
          // Check if DM from this user already exists
          const existingDM = dmInbox.find(dm => dm.user === req.user);
          if (existingDM) {
            // Add new messages to existing DM
            const newAsks = [
              "Sei di che zona?", "Che scuola fai?", "Quanti anni hai?",
              "Passiamo su WhatsApp? qui mi bugga", "Mi mandi una foto? (solo per capire)",
            ];
            const ask = pick(newAsks);
            setDmInbox((prev) => prev.map(dm => 
              dm.user === req.user 
                ? { ...dm, preview: ask, messages: [...dm.messages, { from: "them", text: ask, time: "adesso" }] }
                : dm
            ));
            setTimeout(() => openDM(existingDM), 2200);
          } else {
            // Create new DM
            const escal = buildEscalationDM(req);
            setDmInbox((prev) => [escal].concat(prev));
            setTimeout(() => openDM(escal), 2200);
          }
        } else {
          setMood((m) => clamp(m + 6, 0, 100));
        }
      }
    }
    setShowFriendRequest(false);
    setCurrentFriendRequest(null);
  }, [currentFriendRequest, buildEscalationDM, openDM, acceptedFriendRequests, dmInbox]);

  const handleStoryClick = useCallback((story) => { setCurrentStory(story); setStoryProgress(0); setShowStory(true); playPop(); }, [playPop]);
  const handleStoryPoll = useCallback(() => { setStoriesPollClicks((x) => x + 1); setMood((m) => clamp(m + 2, 0, 100)); playPop(); }, [playPop]);
  const handleDMReply = useCallback(() => { setDmReplies((x) => x + 1); setMood((m) => clamp(m + 5, 0, 100)); playPop(); }, [playPop]);

  const endGame = useCallback(() => {
    if (estimatedTime && timeSpent <= estimatedTime) setExitedOnTime(true);
    setGameState("reveal");
  }, [estimatedTime, timeSpent]);

  const resetAll = useCallback(() => {
    setGameState("intro");
    setEstimatedTime(null);
    setTimeSpent(0);
    setUserInterests({ friends: 1, crush: 1, music: 1, style: 1, sports: 1, memes: 1 });
    setMood(50);
    setMoodHistory([50]);
    setDopamineSpikes(0);
    setActivePosts([]);
    setIsLoadingMore(false);
    setLikedPosts([]);
    setSavedPosts([]);
    setLikesReceived(0);
    setNotificationClicks(0);
    setEmptyNotificationClicks(0);
    setScrollDistance(0);
    setAdsClicked(0);
    setDmReplies(0);
    setProfileVisits(0);
    setStoriesWatched(0);
    setReelsWatched(0);
    setSharedClickbait(0);
    setStoriesPollClicks(0);
    setTypingShownCount(0);
    setStreak(3);
    setShowStreakWarning(false);
    setShowNotificationPopup(false);
    setActiveNotification(null);
    setShowHeartAnimation(null);
    setCurrentTyping(null);
    setNotificationsLog([]);
    setShowNotificationsInbox(false);
    setShowDM(false);
    setCurrentDM(null);
    setShowDMInbox(false);
    setShowFriendRequest(false);
    setCurrentFriendRequest(null);
    setAcceptedFriendRequests([]);
    setShowStory(false);
    setCurrentStory(null);
    setStoryProgress(0);
    setShowComments(false);
    setCurrentComments(null);
    setShowProfile(false);
    setCurrentProfile(null);
    setDmInbox(baseDMs);
    setStoryList(initialStories);
    setExitedOnTime(false);
    setIgnoredEmptyNotifs(true);
    setRefusedSuspicious(true);
    setRareEventShown(false);
    setPostCounter(1000);
  }, [baseDMs, initialStories]);

  const getTopInterest = useCallback(() => {
    const entries = Object.entries(userInterests).slice();
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }, [userInterests]);

  const calculateManipulationScore = useCallback(() => {
    const suspiciousAccepted = acceptedFriendRequests.filter((r) => r.suspicious).length;
    let score = 0;
    score += Math.min(notificationClicks * 3, 15);
    score += Math.min(emptyNotificationClicks * 9, 28);
    score += Math.min(Math.floor(timeSpent / 15) * 2, 20);
    score += Math.min(Math.floor(scrollDistance / 650) * 2, 15);
    score += Math.min(suspiciousAccepted * 14, 30);
    score += Math.min(sharedClickbait * 12, 24);
    score += Math.min(adsClicked * 8, 20);
    score += Math.min(profileVisits * 2, 10);
    score += Math.min(storiesPollClicks * 2, 10);
    return clamp(score, 0, 100);
  }, [notificationClicks, emptyNotificationClicks, timeSpent, scrollDistance, acceptedFriendRequests, sharedClickbait, adsClicked, profileVisits, storiesPollClicks]);

  // ==================== RENDER: INTRO ====================
  if (gameState === "intro") {
    const nameOk = myHandle.length > 0;
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #111827 0%, #000 60%, #000 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif", color: "#fff" }} onMouseDown={unlockAudio} onTouchStart={unlockAudio}>
        <div style={{ width: "100%", maxWidth: 560, textAlign: "center" }}>
          <div style={{ fontSize: 76, marginBottom: 12 }}>📱</div>
          <div style={{ fontWeight: 900, fontSize: 44, letterSpacing: -1.5, background: "linear-gradient(135deg, #ff3366 0%, #ff6b6b 35%, #feca57 70%, #48dbfb 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>SCROLL TRAP</div>
          <div style={{ color: "#cbd5e1", fontSize: 19, lineHeight: 1.4, marginBottom: 8, fontWeight: 600 }}>Un gioco per aiutarti a capire come funzionano i social</div>
          <div style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.6, marginBottom: 18 }}>
            Un feed "normale". Stories, DM, notifiche.<br />Scegli quanto pensi di restare… poi scorri.<br />
            <span style={{ color: "#64ffda", fontWeight: 700 }}>Quando vuoi finire il gioco, clicca su "ESCI"</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16, marginBottom: 12, textAlign: "left" }}>
            <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700, marginBottom: 8 }}>Il tuo nome account (per rendere realistiche le notifiche)</div>
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="es. ernesto.ig (senza @)" style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.35)", color: "#fff", outline: "none", fontSize: 14, boxSizing: "border-box" }} />
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>Anteprima: <span style={{ color: "#fff", fontWeight: 700 }}>@{myHandle}</span></div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16, marginBottom: 16 }}>
            <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 10, fontWeight: 700 }}>Quanto tempo pensi di restare?</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {[{ label: "30 sec", value: 30 }, { label: "1 min", value: 60 }, { label: "2 min", value: 120 }, { label: "5 min", value: 300 }].map((opt) => {
                const active = estimatedTime === opt.value;
                return (<button key={opt.value} onClick={() => { unlockAudio(); setEstimatedTime(opt.value); playPop(); }} style={{ padding: "12px 18px", borderRadius: 14, border: active ? "2px solid #ff3366" : "1px solid rgba(255,255,255,0.12)", background: active ? "rgba(255,51,102,0.14)" : "rgba(255,255,255,0.04)", color: active ? "#ff3366" : "#9ca3af", fontWeight: 800, cursor: "pointer" }}>{opt.label}</button>);
              })}
            </div>
          </div>
          <button disabled={!estimatedTime || !nameOk} onClick={() => { unlockAudio(); playPop(); setGameState("playing"); }} style={{ width: "100%", padding: "16px 18px", borderRadius: 999, border: "none", cursor: estimatedTime && nameOk ? "pointer" : "not-allowed", fontSize: 17, fontWeight: 900, color: estimatedTime && nameOk ? "#fff" : "#6b7280", background: estimatedTime && nameOk ? "linear-gradient(135deg, #ff3366 0%, #ff6b6b 55%, #feca57 100%)" : "rgba(255,255,255,0.08)", boxShadow: estimatedTime && nameOk ? "0 18px 55px rgba(255,51,102,0.32)" : "none" }}>Inizia a scrollare →</button>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => { unlockAudio(); setSoundEnabled((s) => !s); playPop(); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#9ca3af", padding: "8px 12px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{soundEnabled ? "🔊 Audio ON" : "🔇 Audio OFF"}</button>
          </div>
          <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>Nota: l'audio funziona dopo un gesto (regola del browser).</div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: PLAYING ====================
  if (gameState === "playing") {
    const blocked = showDM || showDMInbox || showStory || showFriendRequest || showComments || showProfile || showNotificationsInbox;
    return (
      <div style={{ height: "100vh", background: "#000", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif", position: "relative", overflow: "hidden" }} onMouseDown={unlockAudio} onTouchStart={unlockAudio}>
        {/* HEADER */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 60, background: "rgba(0,0,0,0.96)", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", zIndex: 50, backdropFilter: "blur(10px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900 }}>⬡</span>
            <span style={{ fontWeight: 900, letterSpacing: -0.5, fontSize: 19 }}>socialgram</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => { unlockAudio(); setSoundEnabled((s) => !s); playPop(); }} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, opacity: 0.85, cursor: "pointer" }} title="Audio">{soundEnabled ? "🔊" : "🔇"}</button>
            <button onClick={openNotificationsInbox} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }} title="Notifiche"><span style={{ fontSize: 22 }}>🔔</span></button>
            <div style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 900, color: "#000", background: "linear-gradient(135deg,#ff6b6b,#feca57)" }} title="Streak">🔥 {streak}</div>
            <button onClick={openDMInbox} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }} title="DM"><span style={{ fontSize: 22 }}>💬</span></button>
            <div style={{ position: "relative" }} title="Like ricevuti (random)">
              <span style={{ fontSize: 22 }}>❤️</span>
              {likesReceived > 0 && <span style={{ position: "absolute", top: -7, right: -10, background: "#ff3366", color: "#fff", fontSize: 11, fontWeight: 900, padding: "2px 6px", borderRadius: 999 }}>+{likesReceived}</span>}
            </div>
          </div>
        </div>

        {/* NOTIFICATION POPUP */}
        {showNotificationPopup && activeNotification && !blocked && (
          <div onClick={() => handleNotificationClick(activeNotification)} style={{ position: "fixed", top: 70, left: 12, right: 12, background: "rgba(28,28,30,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "14px 16px", zIndex: 80, cursor: "pointer", boxShadow: "0 12px 40px rgba(0,0,0,0.55)", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📱</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{activeNotification.text}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>Tocca per vedere • adesso</div>
            </div>
          </div>
        )}

        {/* TYPING INDICATOR */}
        {currentTyping && !blocked && (
          <div style={{ position: "fixed", bottom: 92, left: "50%", transform: "translateX(-50%)", padding: "10px 18px", borderRadius: 999, background: "rgba(100,255,218,0.12)", border: "1px solid rgba(100,255,218,0.22)", color: "#64ffda", fontSize: 13, fontWeight: 800, zIndex: 70, backdropFilter: "blur(10px)" }}>💬 {currentTyping} sta scrivendo…</div>
        )}

        {/* FEED */}
        <div ref={feedRef} onScroll={handleScroll} style={{ height: "100vh", overflowY: "auto", paddingTop: 60, paddingBottom: 90 }}>
          {/* STORIES ROW */}
          <div style={{ display: "flex", gap: 14, padding: 14, overflowX: "auto", borderBottom: "1px solid #1c1c1e" }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6, position: "relative" }}>
                <SafeImg src={buildUnsplashUrl(pick(imageDB.friends), 180)} alt="Tu" style={{ width: 62, height: 62, borderRadius: "50%", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 180)} />
                <div style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: "#0095f6", border: "3px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 900 }}>+</div>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>@{myHandle}</div>
            </div>
            {storyList.map((st) => (
              <div key={st.id} style={{ textAlign: "center", flexShrink: 0, cursor: "pointer" }} onClick={() => handleStoryClick(st)}>
                <div style={{ width: 68, height: 68, borderRadius: "50%", background: st.seen ? "#333" : "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", padding: 3, marginBottom: 6 }}>
                  <SafeImg src={st.avatar} alt={st.user} style={{ width: "100%", height: "100%", borderRadius: "50%", border: "3px solid #000", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 200)} />
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{st.user.split(".")[0]}</div>
              </div>
            ))}
          </div>

          {/* POSTS */}
          {activePosts.map((post) => (
            <div key={post.id} style={{ borderBottom: "1px solid #1c1c1e" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer" }} onClick={() => handlePostAction(post, "profile")}>
                  <SafeImg src={post.avatar} alt={post.user} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 180)} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 900 }}>{post.user}</div>
                      {post.verified && <div style={{ color: "#3897f0", fontSize: 14 }}>✓</div>}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{post.isAd ? "Sponsorizzato" : post.isReel ? "Reel • " + post.time : post.time}</div>
                  </div>
                </div>
                <div style={{ color: "#fff", opacity: 0.8 }}>•••</div>
              </div>
              {post.fomoText && (
                <div style={{ background: "linear-gradient(90deg, rgba(255,107,107,0.12) 0%, rgba(254,202,87,0.10) 100%)", padding: "10px 16px", display: "flex", gap: 8, alignItems: "center" }}>
                  <span>🔥</span><span style={{ color: "#feca57", fontSize: 13, fontWeight: 900 }}>{post.fomoText}</span>
                </div>
              )}
              {post.isReel ? (
                /* REEL VIDEO */
                <div style={{ width: "100%", aspectRatio: "9 / 16", maxHeight: "70vh", position: "relative", overflow: "hidden", background: "#000" }} onDoubleClick={() => handleLike(post)}>
                  <ReelVideo 
                    youtubeId={post.youtubeId} 
                    onPlay={() => {
                      setUserInterests((prev) => {
                        const cat = post.type === "reel" ? "music" : post.type;
                        return { ...prev, [cat]: (prev[cat] || 1) + 2 };
                      });
                      setDopamineSpikes((d) => d + 1);
                      setReelsWatched((r) => r + 1);
                    }}
                    style={{ width: "100%", height: "100%" }}
                  />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: showHeartAnimation === post.id ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.7)", opacity: showHeartAnimation === post.id ? 1 : 0, transition: "all 0.25s ease", fontSize: 90, textShadow: "0 0 30px rgba(0,0,0,0.6)", pointerEvents: "none" }}>❤️</div>
                  {/* Reel sidebar */}
                  <div style={{ position: "absolute", right: 12, bottom: 80, display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <button onClick={() => handleLike(post)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                        <span style={{ fontSize: 32, color: likedPosts.includes(post.id) ? "#ed4956" : "#fff" }}>{likedPosts.includes(post.id) ? "❤️" : "🤍"}</span>
                      </button>
                      <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>{post.likes + (likedPosts.includes(post.id) ? 1 : 0)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <button onClick={() => handlePostAction(post, "comment")} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}><span style={{ fontSize: 32 }}>💬</span></button>
                      <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>{post.comments}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <button onClick={() => handlePostAction(post, "share")} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}><span style={{ fontSize: 32 }}>📤</span></button>
                      <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>{post.shares || 0}</div>
                    </div>
                  </div>
                  {/* Caption overlay */}
                  <div style={{ position: "absolute", bottom: 16, left: 12, right: 60, color: "#fff" }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>@{post.user}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>{post.content}</div>
                  </div>
                </div>
              ) : (
                /* REGULAR IMAGE POST */
                <div style={{ width: "100%", aspectRatio: "1 / 1", position: "relative", overflow: "hidden", cursor: "pointer" }} onDoubleClick={() => handleLike(post)}>
                  <SafeImg src={post.image.url} alt="post" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} getAltSrc={altSrcFromCategory(post.image.type, 900)} />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: showHeartAnimation === post.id ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.7)", opacity: showHeartAnimation === post.id ? 1 : 0, transition: "all 0.25s ease", fontSize: 90, textShadow: "0 0 30px rgba(0,0,0,0.6)", pointerEvents: "none" }}>❤️</div>
                  {post.image.overlay && <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(0,0,0,0.65)", padding: "8px 12px", borderRadius: 10, backdropFilter: "blur(8px)" }}><span style={{ fontSize: 13, fontWeight: 900 }}>{post.isAd ? "📢 " : "📍 "}{post.image.overlay}</span></div>}
                </div>
              )}
              {post.isAd ? (
                <div style={{ padding: "12px 16px", background: "#0a0a0a" }}>
                  <button onClick={() => handlePostAction(post, "ad")} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#0095f6", color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 15 }}>Scopri di più</button>
                </div>
              ) : !post.isReel ? (
                <div style={{ padding: "0 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 0" }}>
                    <button onClick={() => handleLike(post)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}><span style={{ fontSize: 26, color: likedPosts.includes(post.id) ? "#ed4956" : "#fff" }}>{likedPosts.includes(post.id) ? "❤️" : "🤍"}</span></button>
                    <button onClick={() => handlePostAction(post, "comment")} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}><span style={{ fontSize: 26 }}>💬</span></button>
                    <button onClick={() => handlePostAction(post, "share")} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}><span style={{ fontSize: 26 }}>📤</span></button>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => handlePostAction(post, "save")} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}><span style={{ fontSize: 26, color: savedPosts.includes(post.id) ? "#feca57" : "#fff" }}>{savedPosts.includes(post.id) ? "🔖" : "📑"}</span></button>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>{post.likes + (likedPosts.includes(post.id) ? 1 : 0)} Mi piace</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}><span style={{ fontWeight: 900 }}>{post.user}</span> {post.content}</div>
                  <button onClick={() => handlePostAction(post, "comment")} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: 0, marginBottom: 14, fontSize: 14 }}>Vedi tutti i {post.comments} commenti</button>
                </div>
              ) : null}
            </div>
          ))}
          {isLoadingMore && <div style={{ padding: 16 }}><div style={{ height: 18, width: 160, background: "#151515", borderRadius: 8, marginBottom: 10 }} /><div style={{ width: "100%", aspectRatio: "1 / 1", background: "#0d0d0d", borderRadius: 8 }} /><div style={{ height: 14, width: 220, background: "#151515", borderRadius: 8, marginTop: 12 }} /></div>}
        </div>

        {/* BOTTOM NAV */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.98)", borderTop: "1px solid #1c1c1e", padding: "10px 0 22px", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 60, backdropFilter: "blur(10px)" }}>
          <span style={{ fontSize: 24 }}>🏠</span>
          <span style={{ fontSize: 24 }}>🔍</span>
          <span style={{ fontSize: 24 }}>➕</span>
          <span style={{ fontSize: 24 }}>🎬</span>
          <div onClick={() => { setShowProfile(true); setCurrentProfile({ user: "@" + myHandle, avatar: buildUnsplashUrl(pick(imageDB.friends), 180), verified: false, image: { type: "friends" }, time: "adesso" }); }} style={{ cursor: "pointer" }}>
            <SafeImg src={buildUnsplashUrl(pick(imageDB.friends), 120)} alt="me" style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #fff", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 120)} />
          </div>
        </div>

        {/* EXIT BUTTON */}
        <button onClick={endGame} style={{ position: "fixed", bottom: 92, right: 16, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "10px 16px", color: "#9ca3af", fontSize: 12, cursor: "pointer", zIndex: 65, backdropFilter: "blur(10px)", fontWeight: 900 }}>ESCI</button>

        {/* TIME HUD - Rimosso per non alterare la simulazione */}

        {/* NOTIFICATIONS INBOX */}
        {showNotificationsInbox && (
          <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 150, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #1c1c1e", display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setShowNotificationsInbox(false)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>←</button>
              <div style={{ fontWeight: 1000 }}>Notifiche</div>
              <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>@{myHandle}</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {notificationsLog.length === 0 ? <div style={{ padding: 16, color: "#6b7280" }}>Nessuna notifica ancora.</div> : notificationsLog.map((n) => (
                <div key={n.id} onClick={() => handleNotificationClick(n)} style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid #111", cursor: "pointer" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔔</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 900, fontSize: 13 }}>{n.text}</div><div style={{ color: "#6b7280", fontSize: 11, marginTop: 3 }}>Tocca per aprire</div></div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>›</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STREAK WARNING MODAL - Rimosso per non alterare la simulazione */}

        {/* FRIEND REQUEST MODAL */}
        {showFriendRequest && currentFriendRequest && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 125, padding: 18 }}>
            <div style={{ width: "100%", maxWidth: 400, background: "linear-gradient(135deg,#1c1c1e,#0a0a0a)", borderRadius: 24, padding: 24 }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <SafeImg src={currentFriendRequest.avatar} alt={currentFriendRequest.user} style={{ width: 92, height: 92, borderRadius: "50%", objectFit: "cover", border: "4px solid #333", marginBottom: 10 }} getAltSrc={altSrcFromCategory("friends", 220)} />
                <div style={{ fontWeight: 1000, fontSize: 18 }}>{currentFriendRequest.user}</div>
                <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>{currentFriendRequest.bio}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 26, marginBottom: 12 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 1000 }}>{currentFriendRequest.posts}</div><div style={{ fontSize: 11, color: "#6b7280" }}>post</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 1000 }}>{currentFriendRequest.followers.toLocaleString("it-IT")}</div><div style={{ fontSize: 11, color: "#6b7280" }}>follower</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 1000 }}>{currentFriendRequest.following}</div><div style={{ fontSize: 11, color: "#6b7280" }}>seguiti</div></div>
              </div>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                {currentFriendRequest.mutualFriends > 0 ? <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 12, background: "rgba(100,255,218,0.10)", border: "1px solid rgba(100,255,218,0.22)", color: "#64ffda", fontSize: 12, fontWeight: 900 }}>👥 {currentFriendRequest.mutualFriends} amici in comune</div> : <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 12, background: "rgba(255,107,107,0.10)", border: "1px solid rgba(255,107,107,0.22)", color: "#ff6b6b", fontSize: 12, fontWeight: 900 }}>⚠️ Nessun amico in comune</div>}
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, color: "#9ca3af", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>Segnali: <span style={{ color: "#d1d5db", fontWeight: 900 }}>{currentFriendRequest.flags.join(" • ")}</span></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => handleFriendRequestAction(false)} style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.16)", background: "transparent", color: "#9ca3af", fontWeight: 900, cursor: "pointer" }}>Ignora</button>
                <button onClick={() => handleFriendRequestAction(true)} style={{ flex: 1, padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg,#667eea,#764ba2)", color: "#fff", fontWeight: 1000, cursor: "pointer" }}>Accetta</button>
              </div>
            </div>
          </div>
        )}

        {/* DM INBOX */}
        {showDMInbox && (
          <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 150, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #1c1c1e", display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setShowDMInbox(false)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>←</button>
              <div style={{ fontWeight: 1000 }}>Messaggi</div>
              <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>@{myHandle}</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {dmInbox.map((dm) => (
                <div key={dm.id} onClick={() => openDM(dm)} style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid #111", cursor: "pointer" }}>
                  <SafeImg src={dm.avatar} alt={dm.user} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 220)} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 1000, fontSize: 14 }}>{dm.user}</div><div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{dm.preview}</div></div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>›</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DM CONVERSATION */}
        {showDM && currentDM && (
          <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 160, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #1c1c1e", display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => { setShowDM(false); setCurrentDM(null); setShowDMInbox(true); }} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>←</button>
              <SafeImg src={currentDM.avatar} alt={currentDM.user} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 220)} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 1000, fontSize: 14 }}>{currentDM.user}</div><div style={{ fontSize: 12, color: "#6b7280" }}>Attivo ora</div></div>
            </div>
            <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
              {currentDM.messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.from === "me" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "78%", marginBottom: 10, padding: "12px 14px", borderRadius: 18, background: msg.from === "me" ? "linear-gradient(135deg,#667eea,#764ba2)" : "#1c1c1e" }}>
                    <div style={{ fontSize: 14, lineHeight: 1.45 }}>{msg.text}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>{msg.time}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-start" }}><div style={{ background: "#1c1c1e", padding: "10px 12px", borderRadius: 18, color: "#6b7280" }}>Sta scrivendo…</div></div>
            </div>
            <div style={{ padding: 14, borderTop: "1px solid #1c1c1e", display: "flex", gap: 10 }}>
              <input type="text" placeholder="Messaggio…" style={{ flex: 1, padding: "12px 14px", borderRadius: 999, border: "1px solid #333", background: "#111", color: "#fff", outline: "none" }} />
              <button onClick={handleDMReply} style={{ padding: "12px 16px", borderRadius: 999, border: "none", background: "linear-gradient(135deg,#667eea,#764ba2)", color: "#fff", fontWeight: 1000, cursor: "pointer" }}>Invia</button>
            </div>
          </div>
        )}

        {/* STORY MODAL */}
        {showStory && currentStory && (
          <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 170 }}>
            <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 4, zIndex: 5 }}>
              {currentStory.slides.map((_, i) => { const per = 100 / currentStory.slides.length; const base = i * per; const w = clamp((storyProgress - base) * currentStory.slides.length, 0, 100); return (<div key={i} style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 2 }}><div style={{ height: "100%", width: w + "%", background: "#fff" }} /></div>); })}
            </div>
            <div style={{ position: "absolute", top: 18, left: 14, right: 14, display: "flex", alignItems: "center", gap: 10, zIndex: 6 }}>
              <SafeImg src={currentStory.avatar} alt={currentStory.user} style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #fff", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 200)} />
              <div style={{ fontWeight: 1000, fontSize: 14, flex: 1 }}>{currentStory.user}</div>
              <button onClick={() => { setShowStory(false); setStoriesWatched((s) => s + 1); }} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            {(() => { const idx = Math.min(Math.floor(storyProgress / (100 / currentStory.slides.length)), currentStory.slides.length - 1); const slide = currentStory.slides[idx]; return (<><SafeImg src={slide.image} alt="story" style={{ width: "100%", height: "100%", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 900)} /><div style={{ position: "absolute", bottom: 110, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.58)", padding: "10px 16px", borderRadius: 999, backdropFilter: "blur(10px)", color: "#fff", fontWeight: 1000, fontSize: 16, textAlign: "center", maxWidth: "90%" }}>{slide.text}</div>{slide.poll && (<div style={{ position: "absolute", bottom: 36, left: 14, right: 14, display: "flex", gap: 10, zIndex: 7 }}><button onClick={handleStoryPoll} style={{ flex: 1, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.35)", color: "#fff", fontWeight: 1000, cursor: "pointer" }}>{slide.poll.a}</button><button onClick={handleStoryPoll} style={{ flex: 1, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.35)", color: "#fff", fontWeight: 1000, cursor: "pointer" }}>{slide.poll.b}</button></div>)}</>); })()}
          </div>
        )}

        {/* PROFILE MODAL */}
        {showProfile && currentProfile && (
          <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 142, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #1c1c1e", display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => { setShowProfile(false); setCurrentProfile(null); }} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>←</button>
              <div style={{ fontWeight: 1000 }}>{currentProfile.user}</div>
              <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>{currentProfile.verified ? "Verificato" : "Account"}</div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                <SafeImg src={currentProfile.avatar} alt={currentProfile.user} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} getAltSrc={altSrcFromCategory("friends", 180)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 1000, fontSize: 16 }}>{currentProfile.user}</div>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>{currentProfile.verified ? "Creator verificato ✓" : "Account personale"}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-around", padding: "16px 0", borderTop: "1px solid #1c1c1e", borderBottom: "1px solid #1c1c1e", marginBottom: 14 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontWeight: 1000, fontSize: 18 }}>{Math.floor(Math.random() * 200) + 30}</div><div style={{ color: "#6b7280", fontSize: 12 }}>Post</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontWeight: 1000, fontSize: 18 }}>{(Math.floor(Math.random() * 50) + 5) * 100}</div><div style={{ color: "#6b7280", fontSize: 12 }}>Follower</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontWeight: 1000, fontSize: 18 }}>{Math.floor(Math.random() * 800) + 200}</div><div style={{ color: "#6b7280", fontSize: 12 }}>Seguiti</div></div>
              </div>
              <button style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "#0095f6", color: "#fff", fontWeight: 900, cursor: "pointer" }}>Segui</button>
            </div>
          </div>
        )}

        {/* COMMENTS MODAL */}
        {showComments && currentComments && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "62vh", background: "#0a0a0a", borderRadius: "18px 18px 0 0", zIndex: 145, display: "flex", flexDirection: "column", borderTop: "1px solid #1c1c1e" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #1c1c1e", display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1, textAlign: "center", fontWeight: 1000 }}>Commenti</div>
              <button onClick={() => setShowComments(false)} style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {(currentComments.commentsList || []).map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🙂</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, lineHeight: 1.4 }}><span style={{ fontWeight: 1000 }}>{c.user}</span> <span style={{ color: "#d1d5db" }}>{c.text}</span></div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>2h • ❤️ {Math.floor(Math.random() * 80)}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== RENDER: REVEAL ====================
  if (gameState === "reveal") {
    const score = calculateManipulationScore();
    const timeRatio = estimatedTime ? timeSpent / estimatedTime : 0;
    const topInterest = getTopInterest();
    const totalWeight = Object.values(userInterests).reduce((a, b) => a + b, 0);
    const suspiciousAccepted = acceptedFriendRequests.filter((r) => r.suspicious);
    const acceptedTotal = acceptedFriendRequests.length;
    const notifTotal = notificationsLog.length;
    const notifEmptyApprox = notificationsLog.filter((n) => !n.hasContent).length;
    const adPostsShown = activePosts.filter((p) => p.isAd).length;
    const fomoBannersShown = activePosts.filter((p) => Boolean(p.fomoText)).length;
    const clickbaitShown = activePosts.filter((p) => p.type === "clickbait" || p.fake).length;
    const escalDMs = dmInbox.filter((d) => d.teenSafety).length;

    const badges = [];
    if (exitedOnTime) badges.push({ icon: "🏆", title: "Autodisciplina", desc: "Uscito nei tempi!" });
    if (ignoredEmptyNotifs) badges.push({ icon: "🛡️", title: "Scudo", desc: "Notifiche vuote ignorate" });
    if (refusedSuspicious) badges.push({ icon: "🔒", title: "Guardiano", desc: "Profili sospetti rifiutati" });

    const shareText = `Ho provato Scroll Trap: manipolazione ${score}%, tempo ${formatTime(timeSpent)} (account @${myHandle}). Badge guadagnati: ${badges.length}/3. Prova anche tu!`;
    const doShare = async () => { try { if (navigator.share) { await navigator.share({ title: "Scroll Trap", text: shareText }); return; } } catch (e) {} try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(shareText); alert("Copiato negli appunti."); return; } } catch (e) {} prompt("Copia questo testo:", shareText); };
    
    const downloadCertificate = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const W = 1080;
      const H = 1920;
      canvas.width = W;
      canvas.height = H;

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, "#0a0a0a");
      bgGrad.addColorStop(0.5, "#111827");
      bgGrad.addColorStop(1, "#0a0a0a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Decorative circles
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#ff3366";
      ctx.beginPath();
      ctx.arc(-100, 300, 400, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#64ffda";
      ctx.beginPath();
      ctx.arc(W + 100, H - 400, 450, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Header emoji
      ctx.font = "120px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🪤", W / 2, 180);

      // Title
      ctx.font = "bold 72px -apple-system, BlinkMacSystemFont, sans-serif";
      const titleGrad = ctx.createLinearGradient(W / 2 - 300, 0, W / 2 + 300, 0);
      titleGrad.addColorStop(0, "#ff3366");
      titleGrad.addColorStop(0.5, "#ff6b6b");
      titleGrad.addColorStop(1, "#feca57");
      ctx.fillStyle = titleGrad;
      ctx.fillText("SCROLL TRAP", W / 2, 290);

      // Subtitle
      ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#64ffda";
      ctx.fillText("CERTIFICATO DI CONSAPEVOLEZZA", W / 2, 360);

      // Divider
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 420);
      ctx.lineTo(W - 100, 420);
      ctx.stroke();

      // Account name
      ctx.font = "bold 42px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("@" + myHandle, W / 2, 510);

      // Score card background
      const scoreColor = score > 70 ? "#ff6b6b" : score > 40 ? "#feca57" : "#64ffda";
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      roundRect(ctx, 120, 560, W - 240, 280, 30);
      ctx.fill();
      ctx.strokeStyle = scoreColor;
      ctx.lineWidth = 3;
      roundRect(ctx, 120, 560, W - 240, 280, 30);
      ctx.stroke();

      // Score label
      ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("PUNTEGGIO MANIPOLAZIONE", W / 2, 620);

      // Score number
      ctx.font = "bold 140px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = scoreColor;
      ctx.fillText(score + "%", W / 2, 770);

      // Time section
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      roundRect(ctx, 120, 880, W - 240, 160, 30);
      ctx.fill();

      ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("TEMPO", W / 2, 940);

      const timeColor = timeRatio > 1.5 ? "#ff6b6b" : timeRatio > 1 ? "#feca57" : "#64ffda";
      ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#ffffff";
      const timeText = estimatedTime ? `${formatTime(estimatedTime)} stimato → ${formatTime(timeSpent)} reale` : formatTime(timeSpent);
      ctx.fillText(timeText, W / 2, 1005);

      // Badges section
      ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#64ffda";
      ctx.fillText("BADGE OTTENUTI: " + badges.length + "/3", W / 2, 1120);

      // Badge icons
      if (badges.length > 0) {
        const badgeWidth = 200;
        const totalBadgeWidth = badges.length * badgeWidth + (badges.length - 1) * 30;
        let startX = (W - totalBadgeWidth) / 2;
        
        badges.forEach((badge, i) => {
          const bx = startX + i * (badgeWidth + 30);
          ctx.fillStyle = "rgba(100,255,218,0.1)";
          roundRect(ctx, bx, 1150, badgeWidth, 180, 20);
          ctx.fill();
          ctx.strokeStyle = "rgba(100,255,218,0.3)";
          ctx.lineWidth = 2;
          roundRect(ctx, bx, 1150, badgeWidth, 180, 20);
          ctx.stroke();
          
          ctx.font = "60px Arial";
          ctx.fillText(badge.icon, bx + badgeWidth / 2, 1220);
          
          ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(badge.title, bx + badgeWidth / 2, 1280);
          
          ctx.font = "18px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillStyle = "#9ca3af";
          ctx.fillText(badge.desc, bx + badgeWidth / 2, 1310);
        });
      } else {
        ctx.font = "32px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#6b7280";
        ctx.fillText("Nessun badge questa volta", W / 2, 1240);
      }

      // Lessons learned
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      roundRect(ctx, 80, 1380, W - 160, 320, 24);
      ctx.fill();

      ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#feca57";
      ctx.fillText("LEZIONI APPRESE", W / 2, 1430);

      ctx.font = "24px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#d1d5db";
      ctx.textAlign = "left";
      const lessons = [
        "• I social ti profilano per tenerti dentro",
        "• Le notifiche vuote creano ansia",
        "• Lo scroll infinito non ha fine naturale",
        "• I profili sospetti vanno sempre rifiutati"
      ];
      lessons.forEach((l, i) => {
        ctx.fillText(l, 140, 1490 + i * 50);
      });

      // Footer
      ctx.textAlign = "center";
      ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("ScrollTrap - Progetto educativo", W / 2, 1780);
      
      ctx.font = "24px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("di Ernesto Belisario", W / 2, 1820);

      ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#6b7280";
      const today = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
      ctx.fillText(today, W / 2, 1870);

      // Download / Show
      const dataUrl = canvas.toDataURL("image/png");
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Su mobile: mostra il modal con l'immagine
        setCertificateImageUrl(dataUrl);
        setShowCertificateModal(true);
      } else {
        // Su desktop: download diretto
        try {
          const link = document.createElement("a");
          link.download = `ScrollTrap_${myHandle}_${Date.now()}.png`;
          link.href = dataUrl;
          link.click();
        } catch (e) {
          // Fallback: mostra modal anche su desktop se il download fallisce
          setCertificateImageUrl(dataUrl);
          setShowCertificateModal(true);
        }
      }
    };
    
    const shareCertificateImage = async () => {
      if (!certificateImageUrl) return;
      
      try {
        // Converti data URL in blob per Web Share API
        const response = await fetch(certificateImageUrl);
        const blob = await response.blob();
        const file = new File([blob], `ScrollTrap_${myHandle}.png`, { type: "image/png" });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Il mio certificato ScrollTrap",
            text: shareText,
            files: [file]
          });
        } else {
          // Fallback: copia il testo
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareText);
            alert("Testo copiato! Salva l'immagine tenendo premuto.");
          }
        }
      } catch (e) {
        console.log("Share failed:", e);
      }
    };

    // Helper function for rounded rectangles
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    const triggers = [
      { icon: "🎯", title: "Feed \"per te\"", stat: `Top: ${topInterest} (${Math.round((userInterests[topInterest] / totalWeight) * 100)}%)`, caption: "Ogni interazione (like, salvataggio, profilo) aggiorna un profilo di interessi; l'algoritmo aumenta la \"dose\" dei contenuti che ti tengono dentro." },
      { icon: "🔔", title: "Notifiche (vere e vuote)", stat: `${notifTotal} notif • ~${notifEmptyApprox} vuote • ${emptyNotificationClicks} click vuoti`, caption: "Le notifiche sono un \"gancio\": ti riportano nell'app. Quelle vuote creano ansia/curiosità e ti spingono a controllare ancora." },
      { icon: "🎬", title: "Reels / Video brevi", stat: `${reelsWatched} reels visti`, caption: "Video in autoplay con scroll verticale: il formato più \"addictivo\". Partono da soli, si fermano solo quando scorri. Impossibile resistere." },
      { icon: "💬", title: "\"Sta scrivendo…\" (attesa senza ricompensa)", stat: `${typingShownCount} volte mostrato`, caption: "Anticipazione senza messaggio: aumenta l'attenzione e crea micro-dipendenza al controllo (messaggio che forse arriva)." },
      { icon: "❤️", title: "Ricompense variabili", stat: `${dopamineSpikes} spike • +${likesReceived} like ricevuti`, caption: "Ricompense intermittenti (non prevedibili) funzionano come le slot: non sai quando arriva, quindi continui." },
      { icon: "📜", title: "Scroll infinito", stat: `${Math.round(scrollDistance / 100)}m • post generati: ${activePosts.length}`, caption: "Assenza di \"fine\" naturale: senza un punto di stop, l'azione di fermarsi richiede più sforzo di quella di continuare." },
      { icon: "🔥", title: "Streak & perdita (loss aversion)", stat: `Streak: ${streak}`, caption: "Minaccia di perdere qualcosa (anche se simbolico) è più potente del premio: ti trattiene anche quando vuoi uscire." },
      { icon: "👁️", title: "Stories & micro-azioni", stat: `${storiesWatched} stories • ${storiesPollClicks} tap sondaggi`, caption: "Interazioni rapidissime e \"facili\" aumentano tempo e segnali di interesse (profilazione), senza che tu te ne accorga." },
      { icon: "🔥", title: "FOMO (banner \"i tuoi amici hanno interagito\")", stat: `${fomoBannersShown} banner mostrati`, caption: "Pressione sociale: sapere che \"gli altri\" stanno partecipando riduce la soglia di uscita e aumenta il coinvolgimento." },
      { icon: "💰", title: "Pubblicità camuffate", stat: `${adPostsShown} post sponsorizzati • ${adsClicked} click`, caption: "Ads che sembrano post: meno difese cognitive, più probabilità di clic. Nel reale è una leva economica centrale." },
      { icon: "⚠️", title: "Clickbait / condivisioni impulsive", stat: `${clickbaitShown} contenuti • ${sharedClickbait} condivisi`, caption: "Titoli/format che attivano urgenza e rabbia: aumentano share e tempo, spesso sacrificando qualità e verifica." },
      { icon: "🧑‍🤝‍🧑", title: "Richieste di amicizia da sconosciuti", stat: `${acceptedTotal} accettate • ${suspiciousAccepted.length} sospette • ${escalDMs} DM di escalation`, caption: "Accettare profili \"credibili\" può aprire escalation in DM (zona, scuola, età, numero, spostamento su altre app)." },
    ];

    return (
      <div style={{ minHeight: "100vh", height: "100%", overflowY: "auto", overflowX: "hidden", background: "linear-gradient(180deg,#0a0a0a 0%, #111827 45%, #0a0a0a 100%)", padding: "34px 18px 56px", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif", color: "#fff", WebkitOverflowScrolling: "touch" }} onMouseDown={unlockAudio} onTouchStart={unlockAudio}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ fontSize: 70, marginBottom: 10 }}>🪤</div>
            <div style={{ fontSize: 36, fontWeight: 1000, letterSpacing: -1 }}>Ecco la trappola.</div>
            <div style={{ marginTop: 10, color: "#9ca3af", lineHeight: 1.6 }}>Quello che hai vissuto era progettato per trattenerti.<br />Il tuo account: <span style={{ color: "#fff", fontWeight: 900 }}>@{myHandle}</span></div>
          </div>

          {badges.length > 0 && (
            <div style={{ background: "linear-gradient(135deg, rgba(100,255,218,0.12), rgba(72,219,251,0.06))", border: "1px solid rgba(100,255,218,0.22)", borderRadius: 20, padding: 18, marginBottom: 14 }}>
              <div style={{ color: "#64ffda", fontSize: 12, fontWeight: 900, letterSpacing: 1.6, marginBottom: 12, textAlign: "center" }}>🎖️ TRAGUARDI DI CONSAPEVOLEZZA</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {badges.map((badge, i) => (<div key={i} style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(100,255,218,0.3)", borderRadius: 14, padding: "12px 16px", textAlign: "center", minWidth: 140 }}><div style={{ fontSize: 32, marginBottom: 6 }}>{badge.icon}</div><div style={{ fontWeight: 900, fontSize: 13, marginBottom: 3 }}>{badge.title}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{badge.desc}</div></div>))}
              </div>
              <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: "#9ca3af" }}>Hai sbloccato {badges.length} su 3 badge!</div>
            </div>
          )}

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 18, marginBottom: 14 }}>
            <div style={{ color: "#64ffda", fontSize: 12, fontWeight: 900, letterSpacing: 1.6, marginBottom: 10 }}>⏱️ IL TEMPO</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}><div style={{ color: "#6b7280", fontSize: 12 }}>Pensavi</div><div style={{ fontWeight: 1000, fontSize: 34 }}>{estimatedTime ? formatTime(estimatedTime) : "—"}</div></div>
              <div style={{ color: timeRatio > 1 ? "#ff6b6b" : "#64ffda", fontSize: 30 }}>→</div>
              <div style={{ textAlign: "center" }}><div style={{ color: "#6b7280", fontSize: 12 }}>Realtà</div><div style={{ fontWeight: 1000, fontSize: 34, color: timeRatio > 1.5 ? "#ff6b6b" : timeRatio > 1 ? "#feca57" : "#64ffda" }}>{formatTime(timeSpent)}</div></div>
            </div>
            {estimatedTime && timeRatio > 1 && <div style={{ marginTop: 12, background: "rgba(255,107,107,0.10)", borderRadius: 12, padding: 10, textAlign: "center", color: "#ff6b6b", fontWeight: 900, fontSize: 13 }}>Sei rimasto circa {Math.round((timeRatio - 1) * 100)}% in più del previsto</div>}
          </div>

          <div style={{ background: score > 70 ? "linear-gradient(135deg, rgba(255,107,107,0.16), rgba(238,90,90,0.08))" : score > 40 ? "linear-gradient(135deg, rgba(254,202,87,0.16), rgba(255,159,67,0.08))" : "linear-gradient(135deg, rgba(100,255,218,0.16), rgba(72,219,251,0.08))", borderRadius: 20, padding: 20, border: score > 70 ? "1px solid rgba(255,107,107,0.25)" : score > 40 ? "1px solid rgba(254,202,87,0.25)" : "1px solid rgba(100,255,218,0.25)", textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Punteggio di manipolazione</div>
            <div style={{ fontSize: 74, fontWeight: 1000, lineHeight: 1, color: score > 70 ? "#ff6b6b" : score > 40 ? "#feca57" : "#64ffda" }}>{score}%</div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 18, marginBottom: 14 }}>
            <div style={{ color: "#64ffda", fontSize: 12, fontWeight: 900, letterSpacing: 1.6, marginBottom: 10 }}>📈 UMORE (DOPAMINA → CALO → RICERCA)</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 92, padding: "0 2px" }}>
              {moodHistory.slice(-35).map((m, i) => { const h = clamp(m, 5, 100); const bg = m >= 60 ? "linear-gradient(180deg,#64ffda,#48dbfb)" : m >= 40 ? "linear-gradient(180deg,#feca57,#ff9f43)" : "linear-gradient(180deg,#ff6b6b,#ee5a5a)"; return (<div key={i} style={{ flex: 1, height: h + "%", background: bg, borderRadius: "4px 4px 0 0" }} />); })}
            </div>
            <div style={{ marginTop: 10, color: "#9ca3af", fontSize: 13, lineHeight: 1.55, textAlign: "center" }}>Piccoli segnali (notifiche, like, "sta scrivendo…") alzano l'umore.<br />Poi cala: e torni a cercare un altro segnale.</div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 18, marginBottom: 16 }}>
            <div style={{ color: "#64ffda", fontSize: 12, fontWeight: 900, letterSpacing: 1.6, marginBottom: 14 }}>🎯 I TRIGGER CHE TI HANNO TENUTO DENTRO</div>
            {triggers.map((t, idx) => (
              <div key={idx} style={{ display: "flex", gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: idx < triggers.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)", fontSize: 22, flexShrink: 0 }}>{t.icon}</div>
                <div><div style={{ fontWeight: 1000, fontSize: 15 }}>{t.title}</div><div style={{ marginTop: 4, color: "#d1d5db", fontSize: 13, lineHeight: 1.55 }}>{t.caption}</div><div style={{ marginTop: 6, color: "#9ca3af", fontWeight: 800, fontSize: 12 }}>📊 {t.stat}</div></div>
              </div>
            ))}
          </div>

          <div style={{ background: "linear-gradient(135deg, rgba(255,107,107,0.14), rgba(255,51,102,0.06))", border: "1px solid rgba(255,107,107,0.20)", borderRadius: 20, padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>Lezione: richieste di amicizia e DM (cosa fare nella vita reale)</div>
            <div style={{ color: "#d1d5db", lineHeight: 1.6, fontSize: 13 }}>Nella simulazione hai visto quanto è facile accettare profili "credibili" e poi ricevere DM che chiedono: zona, scuola, età, numero o di spostarsi su WhatsApp/Telegram/Snap.<br /><span style={{ color: "#fff", fontWeight: 1000 }}>Regola pratica: se non conosci davvero la persona nella vita reale, non accettare.</span><br />Se hai già accettato: non condividere info personali, non spostarti su altre app, blocca/segnala e parlane con un adulto.</div>
            <div style={{ marginTop: 10, fontWeight: 1000 }}>Profili accettati: <span style={{ color: "#fff" }}>{acceptedTotal}</span> • Sospetti: <span style={{ color: suspiciousAccepted.length > 0 ? "#ff6b6b" : "#64ffda" }}>{suspiciousAccepted.length}</span> • DM di escalation generati: <span style={{ color: "#fff" }}>{escalDMs}</span></div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 18, marginBottom: 12 }}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>👨‍💻 Chi sono</div>
            <div style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6 }}>Mi chiamo <span style={{ color: "#fff", fontWeight: 1000 }}>Ernesto Belisario</span>, sono un avvocato esperto di diritto delle tecnologie, ma prima di tutto sono padre e zio. Ho creato <span style={{ color: "#fff", fontWeight: 1000 }}>ScrollTrap</span> come progetto educativo no-profit perché ho capito che, a volte, un'app funziona meglio dei miei sermoni. 😅<br /><br />L'obiettivo non è demonizzare i social, ma aiutare ragazzi (e adulti) a riconoscere le tecniche che ci tengono incollati. <span style={{ color: "#64ffda", fontWeight: 900 }}>Sapere come funzionano i social ci rende davvero liberi di usarli.</span><br /><br />📧 Suggerimenti? <span style={{ color: "#fff" }}>edu@ernestobelisario.eu</span></div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>🔒 Privacy policy</div>
            <div style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6 }}>ScrollTrap è una <strong>simulazione locale</strong>: non viene raccolto né salvato alcun dato personale. Il nome account che inserisci serve solo a personalizzare la scena nel tuo browser.<br /><br /><span style={{ color: "#fff", fontWeight: 900 }}>Zero tracking, zero cookie, zero analytics, zero server.</span><br />Quando chiudi la pagina, tutto scompare. (Diversamente dai social reali, che tracciano ogni click per profilazione e pubblicità.)</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={resetAll} style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.16)", background: "transparent", color: "#fff", fontWeight: 900, cursor: "pointer" }}>Rigioca</button>
              <button onClick={doShare} style={{ flex: 1, padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg,#64ffda,#48dbfb)", color: "#000", fontWeight: 1000, cursor: "pointer" }}>Condividi</button>
            </div>
            <button onClick={downloadCertificate} style={{ width: "100%", padding: 14, borderRadius: 14, border: "2px solid rgba(254,202,87,0.4)", background: "linear-gradient(135deg, rgba(254,202,87,0.12), rgba(255,107,107,0.08))", color: "#feca57", fontWeight: 1000, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><span style={{ fontSize: 18 }}>🎓</span>Scarica certificato</button>
          </div>

          <div style={{ marginTop: 14, color: "#6b7280", fontSize: 12, textAlign: "center" }}>Nota: è una simulazione educativa. I trigger sono intenzionali.</div>
        </div>

        {/* CERTIFICATE MODAL */}
        {showCertificateModal && certificateImageUrl && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <button onClick={() => setShowCertificateModal(false)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: "50%", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#64ffda", marginBottom: 8 }}>📱 Il tuo certificato</div>
              <div style={{ color: "#9ca3af", fontSize: 14 }}>Tieni premuto sull'immagine per salvarla</div>
            </div>
            
            <div style={{ maxWidth: "100%", maxHeight: "65vh", overflow: "auto", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
              <img src={certificateImageUrl} alt="Certificato ScrollTrap" style={{ width: "100%", maxWidth: 400, height: "auto", display: "block", borderRadius: 16 }} />
            </div>
            
            <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={shareCertificateImage} style={{ padding: "14px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#64ffda,#48dbfb)", color: "#000", fontWeight: 900, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📤</span> Condividi
              </button>
              <button onClick={() => { const link = document.createElement("a"); link.download = `ScrollTrap_${myHandle}.png`; link.href = certificateImageUrl; link.click(); }} style={{ padding: "14px 24px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#fff", fontWeight: 900, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <span>💾</span> Scarica
              </button>
            </div>
            
            <div style={{ marginTop: 16, color: "#6b7280", fontSize: 12, textAlign: "center" }}>
              💡 Su iPhone: tieni premuto → "Aggiungi a Foto"<br />
              Su Android: tieni premuto → "Scarica immagine"
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
