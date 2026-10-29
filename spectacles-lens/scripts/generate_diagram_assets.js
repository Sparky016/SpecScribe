const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../Assets/Textures');
fs.mkdirSync(outDir, { recursive: true });

// 1. Clean Whiteboard Backdrop (Pristine, empty, zero marker drawings)
const whiteboardBackdropSvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" stroke-width="1"/>
    </pattern>
    <linearGradient id="metalFrame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="50%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="boardSurface" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F8FAFC"/>
    </linearGradient>
  </defs>

  <!-- Outer Board Frame -->
  <rect x="10" y="10" width="1180" height="780" rx="20" fill="url(#metalFrame)" stroke="#475569" stroke-width="6" filter="url(#shadow)"/>
  
  <!-- Board Surface (Clean Whiteboard) -->
  <rect x="22" y="22" width="1156" height="756" rx="14" fill="url(#boardSurface)"/>
  <rect x="22" y="22" width="1156" height="756" rx="14" fill="url(#grid)" opacity="0.4"/>
  
  <!-- Board Header -->
  <rect x="36" y="34" width="400" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
  <circle cx="52" cy="51" r="5" fill="#10B981"/>
  <text x="66" y="57" font-family="sans-serif" font-size="14" font-weight="700" fill="#334155" letter-spacing="1.2">SPECSCRIBE WHITEBOARD // SESSION 01</text>
  
  <!-- Empty Board State Indicator -->
  <g opacity="0.6">
    <rect x="450" y="34" width="310" height="34" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
    <text x="466" y="56" font-family="sans-serif" font-size="12" font-weight="600" fill="#64748B">WALL MOUNTED • CLEAN SURFACE READY</text>
  </g>

  <!-- Bottom Marker Pen Tray -->
  <rect x="400" y="760" width="400" height="12" rx="4" fill="#334155"/>
  <!-- Black marker in tray -->
  <rect x="430" y="756" width="90" height="6" rx="2" fill="#0F172A"/>
  <!-- Blue marker in tray -->
  <rect x="540" y="756" width="90" height="6" rx="2" fill="#2563EB"/>
  <!-- Red marker in tray -->
  <rect x="650" y="756" width="90" height="6" rx="2" fill="#DC2626"/>
  <!-- Eraser -->
  <rect x="750" y="752" width="45" height="10" rx="3" fill="#1E293B"/>
</svg>`;

// 2. Whiteboard Selection Reticle Overlay (Active during whiteboard calibration / selection mode)
const whiteboardSelectAreaSvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#00E5FF" flood-opacity="0.95"/>
    </filter>
  </defs>

  <!-- Calibration Bounding Frame -->
  <rect x="24" y="24" width="1152" height="752" rx="16" fill="none" stroke="#00E5FF" stroke-width="4" stroke-dasharray="16,10" filter="url(#glowCyan)"/>

  <!-- Corner Alignment Brackets -->
  <g stroke="#00E5FF" stroke-width="7" fill="none" filter="url(#glowCyan)">
    <!-- Top-Left -->
    <path d="M 24 90 L 24 24 L 90 24"/>
    <!-- Top-Right -->
    <path d="M 1110 24 L 1176 24 L 1176 90"/>
    <!-- Bottom-Left -->
    <path d="M 24 710 L 24 776 L 90 776"/>
    <!-- Bottom-Right -->
    <path d="M 1110 776 L 1176 776 L 1176 710"/>
  </g>

  <!-- Center Target Reticle & Instructions -->
  <g filter="url(#glowCyan)">
    <!-- Target Crosshairs -->
    <circle cx="600" cy="360" r="70" fill="#020617" fill-opacity="0.85" stroke="#00E5FF" stroke-width="3" stroke-dasharray="10,6"/>
    <circle cx="600" cy="360" r="22" fill="#00E5FF" fill-opacity="0.35" stroke="#00E5FF" stroke-width="3"/>
    <circle cx="600" cy="360" r="6" fill="#00E5FF"/>
    <line x1="480" y1="360" x2="550" y2="360" stroke="#00E5FF" stroke-width="3"/>
    <line x1="650" y1="360" x2="720" y2="360" stroke="#00E5FF" stroke-width="3"/>
    <line x1="600" y1="240" x2="600" y2="310" stroke="#00E5FF" stroke-width="3"/>
    <line x1="600" y1="410" x2="600" y2="480" stroke="#00E5FF" stroke-width="3"/>

    <!-- Target Label -->
    <rect x="420" y="390" width="360" height="34" rx="8" fill="#020617" fill-opacity="0.95" stroke="#00E5FF" stroke-width="2"/>
    <text x="600" y="413" font-family="sans-serif" font-size="14" font-weight="900" fill="#00E5FF" text-anchor="middle" letter-spacing="1.5">⊙ PINCH CENTER TO SET</text>

    <!-- Central Banner -->
    <rect x="290" y="460" width="620" height="48" rx="12" fill="#020617" fill-opacity="0.95" stroke="#00E5FF" stroke-width="2.5"/>
    <text x="600" y="491" font-family="sans-serif" font-size="16" font-weight="800" fill="#00E5FF" text-anchor="middle" letter-spacing="1.5">DRAG &amp; RESIZE WHITEBOARD AREA</text>

    <!-- Subtitle instruction -->
    <rect x="310" y="520" width="580" height="38" rx="8" fill="#0F172A" fill-opacity="0.9" stroke="#38BDF8" stroke-width="1.5"/>
    <text x="600" y="544" font-family="sans-serif" font-size="13" font-weight="600" fill="#E0F2FE" text-anchor="middle">Drag Board to Move Lower • Stretch to Resize • Pinch Middle to Set</text>
  </g>

  <!-- Dimension tags & Corner Resize badges -->
  <text x="600" y="65" font-family="sans-serif" font-size="14" font-weight="700" fill="#00E5FF" text-anchor="middle" filter="url(#glowCyan)" letter-spacing="2">ADJUSTABLE WIDTH (120 CM)</text>
  <text x="55" y="400" font-family="sans-serif" font-size="14" font-weight="700" fill="#00E5FF" text-anchor="middle" transform="rotate(-90 55 400)" filter="url(#glowCyan)" letter-spacing="2">ADJUSTABLE HEIGHT (80 CM)</text>
  <text x="100" y="55" font-family="sans-serif" font-size="12" font-weight="700" fill="#38BDF8" filter="url(#glowCyan)">⤡ RESIZE</text>
  <text x="1100" y="55" font-family="sans-serif" font-size="12" font-weight="700" fill="#38BDF8" text-anchor="end" filter="url(#glowCyan)">⤢ RESIZE</text>
  <text x="100" y="750" font-family="sans-serif" font-size="12" font-weight="700" fill="#38BDF8" filter="url(#glowCyan)">⤢ RESIZE</text>
  <text x="1100" y="750" font-family="sans-serif" font-size="12" font-weight="700" fill="#38BDF8" text-anchor="end" filter="url(#glowCyan)">⤡ RESIZE</text>
</svg>`;

// 3. Hand-Drawn Marker Sketches (When drawing is ingested / active on whiteboard)
const whiteboardDrawnSvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" stroke-width="1"/>
    </pattern>
    <linearGradient id="metalFrame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="50%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="boardSurface" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F8FAFC"/>
    </linearGradient>
  </defs>

  <!-- Outer Board Frame -->
  <rect x="10" y="10" width="1180" height="780" rx="20" fill="url(#metalFrame)" stroke="#475569" stroke-width="6" filter="url(#shadow)"/>
  
  <!-- Board Surface -->
  <rect x="22" y="22" width="1156" height="756" rx="14" fill="url(#boardSurface)"/>
  <rect x="22" y="22" width="1156" height="756" rx="14" fill="url(#grid)" opacity="0.4"/>
  
  <!-- Board Header -->
  <rect x="36" y="34" width="400" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
  <circle cx="52" cy="51" r="5" fill="#10B981"/>
  <text x="66" y="57" font-family="sans-serif" font-size="14" font-weight="700" fill="#334155" letter-spacing="1.2">SPECSCRIBE WHITEBOARD // SESSION 01</text>

  <!-- Hand-Drawn Marker Sketches -->
  <g stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.88">
    <!-- Client sketch -->
    <rect x="80" y="240" width="180" height="90" rx="8" stroke-dasharray="3,1"/>
    <text x="115" y="292" font-family="sans-serif" font-size="18" font-weight="600" fill="#0F172A" stroke="none">Client Web/App</text>
    
    <!-- Arrow 1 -->
    <path d="M 260 285 Q 310 285 360 285 M 350 277 L 362 285 L 350 293"/>
    
    <!-- Gateway sketch -->
    <rect x="365" y="240" width="200" height="90" rx="8"/>
    <text x="405" y="292" font-family="sans-serif" font-size="18" font-weight="600" fill="#0F172A" stroke="none">API Gateway</text>
    
    <!-- Arrow 2 -->
    <path d="M 565 285 Q 615 285 665 285 M 655 277 L 667 285 L 655 293"/>
    
    <!-- Core Service sketch -->
    <rect x="670" y="240" width="210" height="90" rx="8"/>
    <text x="710" y="292" font-family="sans-serif" font-size="18" font-weight="600" fill="#0F172A" stroke="none">Core Microservice</text>
    
    <!-- Arrow 3 -->
    <path d="M 880 285 Q 925 285 965 285 M 955 277 L 967 285 L 955 293"/>
    
    <!-- Database sketch -->
    <ellipse cx="1040" cy="255" rx="60" ry="20"/>
    <path d="M 980 255 L 980 315 A 60 20 0 0 0 1100 315 L 1100 255"/>
    <ellipse cx="1040" cy="315" rx="60" ry="20" stroke-dasharray="4,2"/>
    <text x="1005" y="295" font-family="sans-serif" font-size="16" font-weight="600" fill="#0F172A" stroke="none">Postgres DB</text>
    
    <!-- Hand written note -->
    <text x="85" y="370" font-family="sans-serif" font-size="15" font-style="italic" fill="#64748B" stroke="none">* Note: Add token validation before dispatching to core service!</text>
  </g>

  <!-- Bottom Marker Pen Tray -->
  <rect x="400" y="760" width="400" height="12" rx="4" fill="#334155"/>
  <rect x="430" y="756" width="90" height="6" rx="2" fill="#0F172A"/>
  <rect x="540" y="756" width="90" height="6" rx="2" fill="#2563EB"/>
  <rect x="650" y="756" width="90" height="6" rx="2" fill="#DC2626"/>
  <rect x="750" y="752" width="45" height="10" rx="3" fill="#1E293B"/>
</svg>`;

// 4. Empty / Clean Overlay (100% transparent when board is clean)
const diagramEmptySvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <!-- Completely empty/transparent overlay for clean board -->
</svg>`;

// 5. Initial Sugiyama DAG overlay (4 nodes, 3 directed edges)
const diagramInitialSvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#00FF66" flood-opacity="0.9"/>
    </filter>
    <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#00E5FF" flood-opacity="0.9"/>
    </filter>
  </defs>
  
  <!-- Digital Overlay Badge -->
  <g filter="url(#glowCyan)">
    <rect x="70" y="140" width="440" height="40" rx="10" fill="#020617" stroke="#00E5FF" stroke-width="2" fill-opacity="0.85"/>
    <text x="90" y="166" font-family="sans-serif" font-size="15" font-weight="700" fill="#00E5FF" letter-spacing="1">DIGITAL OVERLAY // 4 NODES • 3 EDGES (SUGIYAMA DAG)</text>
  </g>
  
  <!-- Directed DAG Edges -->
  <g stroke="#00E5FF" stroke-width="4" fill="none" filter="url(#glowCyan)">
    <path d="M 270 285 L 355 285"/>
    <polygon points="365,285 350,277 350,293" fill="#00E5FF"/>
    
    <path d="M 575 285 L 660 285"/>
    <polygon points="670,285 655,277 655,293" fill="#00E5FF"/>
    
    <path d="M 890 285 L 965 285"/>
    <polygon points="975,285 960,277 960,293" fill="#00E5FF"/>
  </g>
  
  <!-- Node 1: Client Entrypoint -->
  <g filter="url(#glowCyan)">
    <rect x="75" y="235" width="190" height="100" rx="14" fill="#030712" fill-opacity="0.9" stroke="#00E5FF" stroke-width="3.5"/>
    <rect x="85" y="245" width="90" height="22" rx="6" fill="#00E5FF" fill-opacity="0.2"/>
    <text x="95" y="261" font-family="sans-serif" font-size="12" font-weight="800" fill="#00E5FF">TERMINAL</text>
    <text x="90" y="295" font-family="sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">Client HTTPS</text>
    <text x="90" y="318" font-family="sans-serif" font-size="13" fill="#94A3B8">React / Mobile</text>
  </g>

  <!-- Node 2: API Gateway -->
  <g filter="url(#glowGreen)">
    <rect x="370" y="235" width="200" height="100" rx="14" fill="#030712" fill-opacity="0.9" stroke="#00FF66" stroke-width="3.5"/>
    <rect x="380" y="245" width="80" height="22" rx="6" fill="#00FF66" fill-opacity="0.2"/>
    <text x="390" y="261" font-family="sans-serif" font-size="12" font-weight="800" fill="#00FF66">SERVICE</text>
    <text x="385" y="295" font-family="sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">API Gateway</text>
    <text x="385" y="318" font-family="sans-serif" font-size="13" fill="#94A3B8">Reverse Proxy / TLS</text>
  </g>

  <!-- Node 3: Core Microservice -->
  <g filter="url(#glowGreen)">
    <rect x="675" y="235" width="210" height="100" rx="14" fill="#030712" fill-opacity="0.9" stroke="#00FF66" stroke-width="3.5"/>
    <rect x="685" y="245" width="80" height="22" rx="6" fill="#00FF66" fill-opacity="0.2"/>
    <text x="695" y="261" font-family="sans-serif" font-size="12" font-weight="800" fill="#00FF66">SERVICE</text>
    <text x="690" y="295" font-family="sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">Core Engine</text>
    <text x="690" y="318" font-family="sans-serif" font-size="13" fill="#94A3B8">Transaction Logic</text>
  </g>

  <!-- Node 4: Database -->
  <g filter="url(#glowCyan)">
    <rect x="980" y="235" width="160" height="100" rx="14" fill="#030712" fill-opacity="0.9" stroke="#00E5FF" stroke-width="3.5"/>
    <rect x="990" y="245" width="90" height="22" rx="6" fill="#00E5FF" fill-opacity="0.2"/>
    <text x="1000" y="261" font-family="sans-serif" font-size="12" font-weight="800" fill="#00E5FF">DATABASE</text>
    <text x="995" y="295" font-family="sans-serif" font-size="17" font-weight="700" fill="#FFFFFF">Postgres DB</text>
    <text x="995" y="318" font-family="sans-serif" font-size="13" fill="#94A3B8">Relational Store</text>
  </g>
</svg>`;

// 6. Node Added (Verify JWT Decision Node injected)
const diagramNodeAddedSvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#00FF66" flood-opacity="0.9"/>
    </filter>
    <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#00E5FF" flood-opacity="0.9"/>
    </filter>
    <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#FFB300" flood-opacity="0.95"/>
    </filter>
  </defs>
  
  <!-- Digital Overlay Badge -->
  <g filter="url(#glowAmber)">
    <rect x="70" y="120" width="560" height="42" rx="10" fill="#020617" stroke="#FFB300" stroke-width="2" fill-opacity="0.9"/>
    <text x="90" y="147" font-family="sans-serif" font-size="15" font-weight="700" fill="#FFB300" letter-spacing="1">LIVE NODE INJECTED: [DECISION: ENFORCE JWT HMAC] (5 NODES)</text>
  </g>
  
  <!-- Directed DAG Edges -->
  <g stroke="#00E5FF" stroke-width="4" fill="none" filter="url(#glowCyan)">
    <path d="M 230 285 L 290 285"/>
    <polygon points="300,285 285,277 285,293" fill="#00E5FF"/>
    
    <path d="M 480 285 L 530 285"/>
    <polygon points="540,285 525,277 525,293" fill="#00E5FF"/>
  </g>
  <g stroke="#FFB300" stroke-width="4" fill="none" filter="url(#glowAmber)">
    <path d="M 710 285 L 755 285"/>
    <polygon points="765,285 750,277 750,293" fill="#FFB300"/>
  </g>
  <g stroke="#00FF66" stroke-width="4" fill="none" filter="url(#glowGreen)">
    <path d="M 935 285 L 980 285"/>
    <polygon points="990,285 975,277 975,293" fill="#00FF66"/>
  </g>
  
  <!-- Node 1: Client -->
  <g filter="url(#glowCyan)">
    <rect x="60" y="235" width="165" height="100" rx="14" fill="#030712" fill-opacity="0.9" stroke="#00E5FF" stroke-width="3.5"/>
    <text x="75" y="261" font-family="sans-serif" font-size="11" font-weight="800" fill="#00E5FF">TERMINAL</text>
    <text x="75" y="295" font-family="sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">Client HTTPS</text>
  </g>

  <!-- Node 2: Gateway -->
  <g filter="url(#glowGreen)">
    <rect x="305" y="235" width="170" height="100" rx="14" fill="#030712" fill-opacity="0.9" stroke="#00FF66" stroke-width="3.5"/>
    <text x="320" y="261" font-family="sans-serif" font-size="11" font-weight="800" fill="#00FF66">SERVICE</text>
    <text x="320" y="295" font-family="sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">API Gateway</text>
  </g>

  <!-- Node 3: Injected Decision Diamond -->
  <g filter="url(#glowAmber)">
    <polygon points="625,220 705,285 625,350 545,285" fill="#030712" fill-opacity="0.95" stroke="#FFB300" stroke-width="4"/>
    <text x="625" y="275" font-family="sans-serif" font-size="12" font-weight="800" fill="#FFB300" text-anchor="middle">DECISION</text>
    <text x="625" y="298" font-family="sans-serif" font-size="14" font-weight="700" fill="#FFFFFF" text-anchor="middle">Verify JWT</text>
    <text x="625" y="316" font-family="sans-serif" font-size="11" fill="#CBD5E1" text-anchor="middle">HMAC-SHA256</text>
  </g>

  <!-- Node 4: Core Service -->
  <g filter="url(#glowGreen)">
    <rect x="770" y="235" width="165" height="100" rx="14" fill="#030712" fill-opacity="0.9" stroke="#00FF66" stroke-width="3.5"/>
    <text x="785" y="261" font-family="sans-serif" font-size="11" font-weight="800" fill="#00FF66">SERVICE</text>
    <text x="785" y="295" font-family="sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">Core Engine</text>
  </g>

  <!-- Node 5: Database -->
  <g filter="url(#glowCyan)">
    <rect x="995" y="235" width="150" height="100" rx="14" fill="#030712" fill-opacity="0.9" stroke="#00E5FF" stroke-width="3.5"/>
    <text x="1010" y="261" font-family="sans-serif" font-size="11" font-weight="800" fill="#00E5FF">DATABASE</text>
    <text x="1010" y="295" font-family="sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">Postgres DB</text>
  </g>
</svg>`;

// 7. Snapshot Updated (Multi-tier Sugiyama DAG)
const diagramSnapshotSvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#00FF66" flood-opacity="0.9"/>
    </filter>
    <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#00E5FF" flood-opacity="0.9"/>
    </filter>
    <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#FFB300" flood-opacity="0.95"/>
    </filter>
  </defs>
  
  <!-- Digital Overlay Badge -->
  <g filter="url(#glowCyan)">
    <rect x="70" y="90" width="620" height="42" rx="10" fill="#020617" stroke="#00E5FF" stroke-width="2" fill-opacity="0.9"/>
    <text x="90" y="117" font-family="sans-serif" font-size="15" font-weight="700" fill="#00E5FF" letter-spacing="1">SNAPSHOT SYNCED // MULTI-TIER DAG • 6 NODES • 7 EDGES (OPTIMIZED)</text>
  </g>
  
  <!-- Edges -->
  <g stroke="#00E5FF" stroke-width="3.5" fill="none" filter="url(#glowCyan)">
    <!-- Client to Gateway -->
    <path d="M 230 280 L 295 280"/>
    <polygon points="305,280 290,273 290,287" fill="#00E5FF"/>
    
    <!-- Gateway to Decision -->
    <path d="M 480 280 L 530 280"/>
    <polygon points="540,280 525,273 525,287" fill="#00E5FF"/>
    
    <!-- Decision to Auth Service -->
    <path d="M 685 280 L 735 280"/>
    <polygon points="745,280 730,273 730,287" fill="#00E5FF"/>
    
    <!-- Auth Service to Redis Cache (branch up) -->
    <path d="M 840 230 C 840 190 920 180 970 180"/>
    <polygon points="980,180 965,173 965,187" fill="#00E5FF"/>
    
    <!-- Auth Service to Core Service -->
    <path d="M 925 280 L 975 280"/>
    <polygon points="985,280 970,273 970,287" fill="#00E5FF"/>
    
    <!-- Core Service to Postgres DB (branch down) -->
    <path d="M 1070 330 C 1070 370 1000 390 975 390"/>
    <polygon points="975,390 990,383 990,397" fill="#00E5FF"/>
  </g>

  <!-- Node 1: Client -->
  <g filter="url(#glowCyan)">
    <rect x="60" y="235" width="165" height="90" rx="12" fill="#030712" fill-opacity="0.9" stroke="#00E5FF" stroke-width="3"/>
    <text x="75" y="257" font-family="sans-serif" font-size="11" font-weight="800" fill="#00E5FF">TERMINAL</text>
    <text x="75" y="288" font-family="sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">Client Web/App</text>
  </g>

  <!-- Node 2: Gateway -->
  <g filter="url(#glowGreen)">
    <rect x="310" y="235" width="165" height="90" rx="12" fill="#030712" fill-opacity="0.9" stroke="#00FF66" stroke-width="3"/>
    <text x="325" y="257" font-family="sans-serif" font-size="11" font-weight="800" fill="#00FF66">SERVICE</text>
    <text x="325" y="288" font-family="sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">API Gateway</text>
  </g>

  <!-- Node 3: Decision -->
  <g filter="url(#glowAmber)">
    <polygon points="615,225 685,280 615,335 545,280" fill="#030712" fill-opacity="0.95" stroke="#FFB300" stroke-width="3.5"/>
    <text x="615" y="275" font-family="sans-serif" font-size="12" font-weight="800" fill="#FFB300" text-anchor="middle">DECISION</text>
    <text x="615" y="294" font-family="sans-serif" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">Verify JWT</text>
  </g>

  <!-- Node 4: Auth Gateway Service -->
  <g filter="url(#glowGreen)">
    <rect x="750" y="235" width="175" height="90" rx="12" fill="#030712" fill-opacity="0.9" stroke="#00FF66" stroke-width="3"/>
    <text x="765" y="257" font-family="sans-serif" font-size="11" font-weight="800" fill="#00FF66">SERVICE</text>
    <text x="765" y="288" font-family="sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">Auth Service</text>
  </g>

  <!-- Node 5: Redis Token Cache (Upper Branch) -->
  <g filter="url(#glowCyan)">
    <rect x="985" y="140" width="165" height="80" rx="12" fill="#030712" fill-opacity="0.9" stroke="#00E5FF" stroke-width="3"/>
    <text x="1000" y="160" font-family="sans-serif" font-size="11" font-weight="800" fill="#00E5FF">DATABASE</text>
    <text x="1000" y="190" font-family="sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">Redis Cache</text>
    <text x="1000" y="208" font-family="sans-serif" font-size="11" fill="#94A3B8">Session Store</text>
  </g>

  <!-- Node 6: Primary Postgres DB (Lower Branch) -->
  <g filter="url(#glowCyan)">
    <rect x="985" y="260" width="165" height="80" rx="12" fill="#030712" fill-opacity="0.9" stroke="#00E5FF" stroke-width="3"/>
    <text x="1000" y="280" font-family="sans-serif" font-size="11" font-weight="800" fill="#00E5FF">DATABASE</text>
    <text x="1000" y="310" font-family="sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">Postgres DB</text>
    <text x="1000" y="328" font-family="sans-serif" font-size="11" fill="#94A3B8">Primary ACID</text>
  </g>
</svg>`;

// 8. Concluded (Final Technical Specification Banner)
const diagramConcludedSvg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#00FF66" flood-opacity="0.95"/>
    </filter>
  </defs>
  
  <g filter="url(#glowGreen)">
    <rect x="140" y="160" width="920" height="420" rx="24" fill="#030712" fill-opacity="0.95" stroke="#00FF66" stroke-width="4"/>
    
    <circle cx="600" cy="250" r="45" fill="#00FF66" fill-opacity="0.15" stroke="#00FF66" stroke-width="3"/>
    <path d="M 580 250 L 595 265 L 625 235" fill="none" stroke="#00FF66" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    
    <text x="600" y="335" font-family="sans-serif" font-size="32" font-weight="900" fill="#00FF66" text-anchor="middle" letter-spacing="2">TECHNICAL SPECIFICATION GENERATED</text>
    <text x="600" y="375" font-family="sans-serif" font-size="22" font-weight="700" fill="#FFFFFF" text-anchor="middle">Meeting Session Successfully Concluded</text>
    
    <line x1="260" y1="405" x2="940" y2="405" stroke="#00FF66" stroke-width="2" stroke-opacity="0.4"/>
    
    <text x="600" y="445" font-family="sans-serif" font-size="20" font-weight="700" fill="#00FF66" text-anchor="middle">6 Architecture Nodes • 7 Directed Edges • 0 Open Vulnerabilities</text>
    <text x="600" y="485" font-family="sans-serif" font-size="20" font-weight="700" fill="#00E5FF" text-anchor="middle">Exported to GitHub Issues, Jira &amp; OpenAPI Contract</text>
    <text x="600" y="530" font-family="sans-serif" font-size="16" font-weight="800" fill="#38BDF8" text-anchor="middle">SPECSCRIBE AR // DEVPOST HACKATHON</text>
  </g>
</svg>`;

fs.writeFileSync(path.join(outDir, 'Whiteboard_Backdrop.svg'), whiteboardBackdropSvg);
fs.writeFileSync(path.join(outDir, 'Whiteboard_SelectArea.svg'), whiteboardSelectAreaSvg);
fs.writeFileSync(path.join(outDir, 'Whiteboard_Drawn.svg'), whiteboardDrawnSvg);
fs.writeFileSync(path.join(outDir, 'Diagram_Empty.svg'), diagramEmptySvg);
fs.writeFileSync(path.join(outDir, 'Diagram_Initial.svg'), diagramInitialSvg);
fs.writeFileSync(path.join(outDir, 'Diagram_NodeAdded.svg'), diagramNodeAddedSvg);
fs.writeFileSync(path.join(outDir, 'Diagram_SnapshotUpdated.svg'), diagramSnapshotSvg);
fs.writeFileSync(path.join(outDir, 'Diagram_Concluded.svg'), diagramConcludedSvg);

console.log('All SVGs written successfully!');
