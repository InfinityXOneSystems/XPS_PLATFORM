export const BackgroundMeshSVG = () => (
  <svg
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    className="absolute inset-0 pointer-events-none"
  >
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path
          d="M 40 0 L 0 0 0 40"
          fill="none"
          stroke="rgba(212, 175, 55, 0.05)"
          strokeWidth="1"
        />
      </pattern>
      <linearGradient id="fadeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(212, 175, 55, 0.1)" />
        <stop offset="50%" stopColor="rgba(212, 175, 55, 0.03)" />
        <stop offset="100%" stopColor="transparent" />
      </linearGradient>
      <radialGradient id="goldGlow" cx="30%" cy="30%">
        <stop offset="0%" stopColor="rgba(212, 175, 55, 0.15)" />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
    <rect width="100%" height="100%" fill="url(#fadeGradient)" />
    <ellipse cx="30%" cy="30%" rx="40%" ry="40%" fill="url(#goldGlow)" />
  </svg>
)

export const ConnectionLinesSVG = () => (
  <svg
    width="400"
    height="300"
    viewBox="0 0 400 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g opacity="0.6">
      <circle cx="50" cy="50" r="8" fill="#D4AF37" />
      <circle cx="200" cy="150" r="8" fill="#C0C0C0" />
      <circle cx="350" cy="100" r="8" fill="#CD7F32" />
      <circle cx="150" cy="250" r="8" fill="#8B0023" />
      
      <line
        x1="50" y1="50"
        x2="200" y2="150"
        stroke="url(#connectionGradient1)"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <line
        x1="200" y1="150"
        x2="350" y2="100"
        stroke="url(#connectionGradient2)"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <line
        x1="200" y1="150"
        x2="150" y2="250"
        stroke="url(#connectionGradient3)"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
    </g>
    
    <defs>
      <linearGradient id="connectionGradient1" x1="50" y1="50" x2="200" y2="150">
        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#C0C0C0" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="connectionGradient2" x1="200" y1="150" x2="350" y2="100">
        <stop offset="0%" stopColor="#C0C0C0" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#CD7F32" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="connectionGradient3" x1="200" y1="150" x2="150" y2="250">
        <stop offset="0%" stopColor="#C0C0C0" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#8B0023" stopOpacity="0.6" />
      </linearGradient>
    </defs>
  </svg>
)

export const DataFlowArrowSVG = () => (
  <svg
    width="120"
    height="40"
    viewBox="0 0 120 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M 5 20 L 100 20 L 95 15 M 100 20 L 95 25"
      stroke="url(#arrowGradient)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#D4AF37" stopOpacity="1" />
      </linearGradient>
    </defs>
  </svg>
)

export const NodeDiagramSVG = () => (
  <svg
    width="500"
    height="400"
    viewBox="0 0 500 400"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g id="central-node">
      <rect
        x="210"
        y="170"
        width="80"
        height="60"
        rx="8"
        fill="rgba(212, 175, 55, 0.1)"
        stroke="#D4AF37"
        strokeWidth="2"
      />
      <text x="250" y="205" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="600">
        Core
      </text>
    </g>
    
    <g id="satellite-nodes">
      <rect x="50" y="80" width="70" height="50" rx="6" fill="rgba(192, 192, 192, 0.08)" stroke="#C0C0C0" strokeWidth="1.5" />
      <rect x="380" y="80" width="70" height="50" rx="6" fill="rgba(192, 192, 192, 0.08)" stroke="#C0C0C0" strokeWidth="1.5" />
      <rect x="50" y="270" width="70" height="50" rx="6" fill="rgba(192, 192, 192, 0.08)" stroke="#C0C0C0" strokeWidth="1.5" />
      <rect x="380" y="270" width="70" height="50" rx="6" fill="rgba(192, 192, 192, 0.08)" stroke="#C0C0C0" strokeWidth="1.5" />
    </g>
    
    <g id="connections" opacity="0.4">
      <line x1="120" y1="105" x2="210" y2="190" stroke="#C0C0C0" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="380" y1="105" x2="290" y2="190" stroke="#C0C0C0" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="120" y1="295" x2="210" y2="230" stroke="#C0C0C0" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="380" y1="295" x2="290" y2="230" stroke="#C0C0C0" strokeWidth="1.5" strokeDasharray="3 3" />
    </g>
  </svg>
)

export const EmptyStateIllustrationSVG = () => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="100" cy="100" r="80" stroke="rgba(212, 175, 55, 0.2)" strokeWidth="2" strokeDasharray="5 5" />
    <circle cx="100" cy="100" r="60" stroke="rgba(212, 175, 55, 0.15)" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="100" cy="100" r="40" stroke="rgba(212, 175, 55, 0.1)" strokeWidth="1" strokeDasharray="2 2" />
    
    <path
      d="M 100 60 L 100 140 M 60 100 L 140 100"
      stroke="rgba(212, 175, 55, 0.25)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    
    <circle cx="100" cy="100" r="8" fill="#D4AF37" opacity="0.3" />
  </svg>
)

export const LoadingSpinnerSVG = ({ className }: { className?: string }) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle
      cx="24"
      cy="24"
      r="20"
      stroke="rgba(212, 175, 55, 0.2)"
      strokeWidth="4"
    />
    <path
      d="M 24 4 A 20 20 0 0 1 44 24"
      stroke="#D4AF37"
      strokeWidth="4"
      strokeLinecap="round"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 24 24"
        to="360 24 24"
        dur="1s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
)

export const WorkflowGraphSVG = () => (
  <svg
    width="600"
    height="300"
    viewBox="0 0 600 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#D4AF37" />
        <stop offset="33%" stopColor="#C0C0C0" />
        <stop offset="66%" stopColor="#CD7F32" />
        <stop offset="100%" stopColor="#8B0023" />
      </linearGradient>
    </defs>
    
    <g id="stages">
      <rect x="20" y="120" width="100" height="60" rx="8" fill="rgba(212, 175, 55, 0.1)" stroke="#D4AF37" strokeWidth="2" />
      <text x="70" y="155" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="600">Start</text>
      
      <rect x="170" y="120" width="100" height="60" rx="8" fill="rgba(192, 192, 192, 0.08)" stroke="#C0C0C0" strokeWidth="2" />
      <text x="220" y="155" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="600">Process</text>
      
      <rect x="320" y="120" width="100" height="60" rx="8" fill="rgba(205, 127, 50, 0.08)" stroke="#CD7F32" strokeWidth="2" />
      <text x="370" y="155" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="600">Validate</text>
      
      <rect x="470" y="120" width="100" height="60" rx="8" fill="rgba(139, 0, 35, 0.08)" stroke="#8B0023" strokeWidth="2" />
      <text x="520" y="155" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="600">Complete</text>
    </g>
    
    <g id="arrows">
      <path d="M 120 150 L 160 150" stroke="url(#flowGradient)" strokeWidth="2" markerEnd="url(#arrowhead)" />
      <path d="M 270 150 L 310 150" stroke="url(#flowGradient)" strokeWidth="2" markerEnd="url(#arrowhead)" />
      <path d="M 420 150 L 460 150" stroke="url(#flowGradient)" strokeWidth="2" markerEnd="url(#arrowhead)" />
    </g>
    
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 10 3, 0 6" fill="#D4AF37" />
      </marker>
    </defs>
  </svg>
)
