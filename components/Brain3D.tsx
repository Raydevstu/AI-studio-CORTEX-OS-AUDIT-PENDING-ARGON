"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import {
  BrainNode,
  SourceCategory,
  SOURCES,
  computeBrainNodeLayouts,
  GraphLayoutMode,
  NodeKind,
  NodeArea,
  GraphTheme,
  GRAPH_THEMES,
  AREA_HUBS,
  KIND_LABELS,
} from "@/lib/knowledge-data";
import {
  Search,
  Sparkles,
  Maximize2,
  Minimize2,
  RotateCcw,
  Play,
  Eye,
  AlertTriangle,
  Radio,
  Boxes,
  Circle as CircleIcon,
  GitFork,
  Calendar,
  Flame,
  Activity,
  Layers,
  Sliders,
  Filter,
  CheckCircle2,
  Zap,
} from "lucide-react";

interface Brain3DProps {
  onSelectNode: (node: BrainNode) => void;
  selectedNodeId?: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  customNodes?: BrainNode[];
}

export default function Brain3D({
  onSelectNode,
  selectedNodeId,
  searchQuery,
  onSearchChange,
  customNodes = [],
}: Brain3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dbGraph, setDbGraph] = useState<{
    nodes: BrainNode[];
    connections: [string, string][];
  }>(() => computeBrainNodeLayouts([]));

  useEffect(() => {
    let active = true;
    fetch("/api/graph/all?depth=2")
      .then((res) => res.json())
      .then((data) => {
        if (!active || !Array.isArray(data.nodes)) return;
        const edges: [string, string][] = Array.isArray(data.relationships)
          ? data.relationships.map(
              (r: { from_id: string; to_id: string }) =>
                [r.from_id, r.to_id] as [string, string]
            )
          : [];
        setDbGraph(computeBrainNodeLayouts(data.nodes, edges));
      })
      .catch(() => {
        // Keep current graph cache on transient network error
      });
    return () => {
      active = false;
    };
  }, [customNodes.length]);

  const graphData = useMemo(() => {
    if (!customNodes || customNodes.length === 0) return dbGraph;
    const existingIds = new Set(dbGraph.nodes.map((n) => n.id));
    const newNodes = customNodes.filter((n) => !existingIds.has(n.id));
    if (newNodes.length === 0) return dbGraph;
    const extraConns: [string, string][] = [];
    newNodes.forEach((n) => {
      n.connections.forEach((tgt) => {
        extraConns.push([n.id, tgt]);
      });
    });
    return computeBrainNodeLayouts(
      [...newNodes, ...dbGraph.nodes],
      [...extraConns, ...dbGraph.connections]
    );
  }, [dbGraph, customNodes]);

  // Layout & Theme State
  const [currentLayout, setCurrentLayout] = useState<GraphLayoutMode>("orbit");
  const [currentTheme, setCurrentTheme] = useState<GraphTheme>("obsidian");

  // Display Customization Toggles
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [labelMode, setLabelMode] = useState<"anchors" | "all" | "none">("anchors");
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [useGeometricShapes, setUseGeometricShapes] = useState(true);
  const [focusIsolation, setFocusIsolation] = useState(false);
  const [viewAngle, setViewAngle] = useState<"3d" | "topdown">("3d");

  // Filter States
  const [selectedArea, setSelectedArea] = useState<NodeArea | "all">("all");
  const [selectedKind, setSelectedKind] = useState<NodeKind | "all">("all");
  const [activeSources, setActiveSources] = useState<Record<SourceCategory, boolean>>({
    "Business wiki": true,
    Meetings: true,
    "Video knowledge": true,
    "Claude memory": true,
    "Codex memory": true,
    Projects: true,
    "Skills & agents": true,
  });

  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(false);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<BrainNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isReplayingDemo, setIsReplayingDemo] = useState(false);

  // References to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodeMeshesRef = useRef<{ mesh: THREE.Mesh; node: BrainNode; origScale: THREE.Vector3 }[]>([]);
  const coreGroupRef = useRef<THREE.Group | null>(null);
  const linesMeshRef = useRef<THREE.LineSegments | null>(null);
  const sampleConnectionsRef = useRef<[string, string][]>([]);
  const guideGroupRef = useRef<THREE.Group | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const nodeMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // Interactive camera control state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const cameraDistanceRef = useRef(380);
  const cameraRotationRef = useRef({ phi: Math.PI / 2.3, theta: 0.4 });
  const demoTimeRef = useRef<number | null>(null);

  // Synchronize layout selection with layout ref
  const currentLayoutRef = useRef<GraphLayoutMode>(currentLayout);
  useEffect(() => {
    currentLayoutRef.current = currentLayout;
  }, [currentLayout]);

  const motionEnabledRef = useRef<boolean>(motionEnabled);
  useEffect(() => {
    motionEnabledRef.current = motionEnabled;
  }, [motionEnabled]);

  // Compute 1-hop & 2-hop neighbor set for focus isolation
  const activeFocusSet = useMemo(() => {
    const focusId = selectedNodeId || (hoveredNode ? hoveredNode.id : null);
    if (!focusIsolation || !focusId) return null;

    const set = new Set<string>();
    set.add(focusId);

    const directNeighbors = graphData.nodes.find((n) => n.id === focusId)?.connections || [];
    directNeighbors.forEach((id) => set.add(id));

    // 2-hop expansion
    directNeighbors.forEach((neighborId) => {
      const neighbor = graphData.nodes.find((n) => n.id === neighborId);
      neighbor?.connections.slice(0, 5).forEach((id) => set.add(id));
    });

    return set;
  }, [focusIsolation, selectedNodeId, hoveredNode, graphData.nodes]);

  // Filtered nodes count
  const filteredNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return graphData.nodes.filter((node) => {
      const isSourceActive = activeSources[node.category];
      const matchesSearch =
        !query ||
        node.title.toLowerCase().includes(query) ||
        node.tags.some((t) => t.toLowerCase().includes(query));
      const matchesAttention = !onlyNeedsAttention || node.needsAttention;
      const matchesArea = selectedArea === "all" || node.area === selectedArea;
      const matchesKind = selectedKind === "all" || node.kind === selectedKind;
      const matchesFocus = !activeFocusSet || activeFocusSet.has(node.id);

      return isSourceActive && matchesAttention && matchesSearch && matchesArea && matchesKind && matchesFocus;
    });
  }, [graphData.nodes, activeSources, onlyNeedsAttention, searchQuery, selectedArea, selectedKind, activeFocusSet]);

  const statsNoteCount = filteredNodes.length;

  const toggleSource = (name: SourceCategory) => {
    setActiveSources((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Switch camera view angle
  const handleViewAngleChange = (mode: "3d" | "topdown") => {
    setViewAngle(mode);
    if (mode === "topdown") {
      cameraRotationRef.current = { phi: 0.08, theta: 0 };
      cameraDistanceRef.current = 540;
      cameraTargetRef.current.set(0, 0, 0);
    } else {
      cameraRotationRef.current = { phi: Math.PI / 2.3, theta: 0.4 };
      cameraDistanceRef.current = 380;
      cameraTargetRef.current.set(0, 0, 0);
    }
  };

  // Replay Demo cinematic camera sequence
  const startReplayDemo = useCallback(() => {
    setIsReplayingDemo(true);
    demoTimeRef.current = performance.now();
  }, []);

  // Reset camera view
  const resetCamera = useCallback(() => {
    cameraDistanceRef.current = 380;
    cameraRotationRef.current = { phi: Math.PI / 2.3, theta: 0.4 };
    cameraTargetRef.current.set(0, 0, 0);
    setViewAngle("3d");
  }, []);

  // Fit camera bounds to current visible nodes
  const fitCameraBounds = useCallback(() => {
    if (filteredNodes.length === 0) return;
    cameraTargetRef.current.set(0, 0, 0);
    cameraDistanceRef.current = currentLayout === "timeline" ? 560 : 420;
  }, [filteredNodes.length, currentLayout]);

  // Three.js Mount & Render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect software WebGL
    let isSoftwareGl = false;
    try {
      const glCanvas = document.createElement("canvas");
      const gl = glCanvas.getContext("webgl") || glCanvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          const rendererStr = (gl as WebGLRenderingContext)
            .getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            .toLowerCase();
          if (
            rendererStr.includes("swiftshader") ||
            rendererStr.includes("llvmpipe") ||
            rendererStr.includes("software")
          ) {
            isSoftwareGl = true;
          }
        }
      }
    } catch {
      // Ignore
    }

    const themeConfig = GRAPH_THEMES[currentTheme];

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeConfig.canvasBg);
    scene.fog = new THREE.FogExp2(themeConfig.fogColor, 0.0011);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      2500
    );
    camera.position.set(160, 120, 320);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(
      new THREE.Color(themeConfig.accentColor),
      3.2,
      700
    );
    pointLight.position.set(0, 30, 0);
    scene.add(pointLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 1.4);
    rimLight.position.set(220, 320, 220);
    scene.add(rimLight);

    // 5. Starfield / Dust
    const starsCount = isSoftwareGl ? 250 : 1000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 1400;
      starPositions[i + 1] = (Math.random() - 0.5) * 1400;
      starPositions[i + 2] = (Math.random() - 0.5) * 1400;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(themeConfig.gridColor),
      size: 1.6,
      transparent: true,
      opacity: 0.45,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);
    starFieldRef.current = starField;

    // 6. Central Core (Glowing Icosahedron Wireframe + Inner Sphere)
    const coreGroup = new THREE.Group();
    const coreGeometry = new THREE.IcosahedronGeometry(22, 1);
    const coreWireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(themeConfig.accentColor),
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const coreWireMesh = new THREE.Mesh(coreGeometry, coreWireMat);
    coreGroup.add(coreWireMesh);

    const coreInnerGeo = new THREE.SphereGeometry(13, 16, 16);
    const coreInnerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(themeConfig.accentColor),
      transparent: true,
      opacity: 0.4,
    });
    const coreInnerMesh = new THREE.Mesh(coreInnerGeo, coreInnerMat);
    coreGroup.add(coreInnerMesh);
    scene.add(coreGroup);
    coreGroupRef.current = coreGroup;

    // 7. Dynamic Architectural Guide Overlays (Rings, Tilted Orbitals, Timeline Grid)
    const guideGroup = new THREE.Group();

    // Orbital celestial rings (for "orbit" mode)
    const celestialRadii = [140, 190, 240];
    const celestialRotations = [
      { x: 0.4, y: 0.2, z: 0.6 },
      { x: -0.5, y: 0.6, z: -0.3 },
      { x: 0.2, y: -0.7, z: 0.4 },
    ];
    celestialRadii.forEach((r, idx) => {
      const curve = new THREE.EllipseCurve(0, 0, r, r * 0.95, 0, 2 * Math.PI, false, 0);
      const pts = curve.getPoints(64);
      const ringGeo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, p.y, 0))
      );
      const ringMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(themeConfig.gridColor),
        transparent: true,
        opacity: 0.35,
      });
      const ringLine = new THREE.LineLoop(ringGeo, ringMat);
      ringLine.rotation.set(
        celestialRotations[idx].x,
        celestialRotations[idx].y,
        celestialRotations[idx].z
      );
      ringLine.userData = { guideType: "orbit" };
      guideGroup.add(ringLine);
    });

    // Concentric ground-plane rings (for "rings" mode)
    const concentricBands = [35, 105, 170, 235, 300, 360, 415];
    concentricBands.forEach((r) => {
      const curve = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false, 0);
      const pts = curve.getPoints(96);
      const ringGeo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, 0, p.y))
      );
      const ringMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(themeConfig.accentColor),
        transparent: true,
        opacity: 0.2,
      });
      const ringLine = new THREE.LineLoop(ringGeo, ringMat);
      ringLine.userData = { guideType: "rings" };
      guideGroup.add(ringLine);
    });

    // Outer circle perimeter loop (for "circle" mode)
    const outerCircleCurve = new THREE.EllipseCurve(0, 0, 330, 330, 0, 2 * Math.PI, false, 0);
    const outerCirclePts = outerCircleCurve.getPoints(120);
    const outerCircleGeo = new THREE.BufferGeometry().setFromPoints(
      outerCirclePts.map((p) => new THREE.Vector3(p.x, 0, p.y))
    );
    const outerCircleMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(themeConfig.accentColor),
      transparent: true,
      opacity: 0.3,
    });
    const outerCircleLine = new THREE.LineLoop(outerCircleGeo, outerCircleMat);
    outerCircleLine.userData = { guideType: "circle" };
    guideGroup.add(outerCircleLine);

    // Timeline grid bounds (for "timeline" mode)
    [-140, 0, 140].forEach((xMark) => {
      const linePts = [new THREE.Vector3(xMark, -200, 0), new THREE.Vector3(xMark, 200, 0)];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(themeConfig.accentColor),
        transparent: true,
        opacity: 0.22,
      });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      lineMesh.userData = { guideType: "timeline" };
      guideGroup.add(lineMesh);
    });

    scene.add(guideGroup);
    guideGroupRef.current = guideGroup;

    // 8. Nodes Geometry Cache & Creation
    const sphereCache: Record<number, THREE.SphereGeometry> = {};
    const octaCache: Record<number, THREE.OctahedronGeometry> = {};
    const boxCache: Record<number, THREE.BoxGeometry> = {};
    const torusCache: Record<number, THREE.TorusGeometry> = {};
    const cylCache: Record<number, THREE.CylinderGeometry> = {};

    const getGeo = (kind: NodeKind | undefined, rad: number) => {
      const rounded = Math.round(rad * 10) / 10;
      if (!useGeometricShapes || kind === "note") {
        if (!sphereCache[rounded]) sphereCache[rounded] = new THREE.SphereGeometry(rad, 12, 12);
        return sphereCache[rounded];
      }
      if (kind === "skill") {
        if (!octaCache[rounded]) octaCache[rounded] = new THREE.OctahedronGeometry(rad * 1.15, 0);
        return octaCache[rounded];
      }
      if (kind === "project") {
        if (!boxCache[rounded]) boxCache[rounded] = new THREE.BoxGeometry(rad * 1.5, rad * 1.5, rad * 1.5);
        return boxCache[rounded];
      }
      if (kind === "routine") {
        if (!torusCache[rounded]) torusCache[rounded] = new THREE.TorusGeometry(rad * 1.1, rad * 0.4, 8, 16);
        return torusCache[rounded];
      }
      if (kind === "app") {
        if (!cylCache[rounded]) cylCache[rounded] = new THREE.CylinderGeometry(rad * 0.9, rad * 0.9, rad * 1.4, 6);
        return cylCache[rounded];
      }
      if (!sphereCache[rounded]) sphereCache[rounded] = new THREE.SphereGeometry(rad, 12, 12);
      return sphereCache[rounded];
    };

    const nodeMeshes: { mesh: THREE.Mesh; node: BrainNode; origScale: THREE.Vector3 }[] = [];
    const nodeMeshMap = new Map<string, THREE.Mesh>();
    const sourceColorMap: Record<string, THREE.Color> = {};
    SOURCES.forEach((s) => {
      sourceColorMap[s.name] = new THREE.Color(s.color);
    });

    const nodesToRender = isSoftwareGl
      ? graphData.nodes.filter((n, idx) => n.isKeyAnchor || idx % 5 === 0)
      : graphData.nodes;

    nodesToRender.forEach((node) => {
      let color = sourceColorMap[node.category] || new THREE.Color(0x38bdf8);

      // Thematic override for monochrome themes (Phosphor / Amber)
      if (currentTheme === "phosphor") {
        color = new THREE.Color(0x22c55e);
      } else if (currentTheme === "amber") {
        color = new THREE.Color(0xf59e0b);
      }

      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: node.isKeyAnchor ? 0.75 : 0.4,
        roughness: 0.25,
        metalness: 0.2,
      });

      const meshRadius = node.isKeyAnchor ? 4.8 : Math.max(1.8, node.radius * 0.8);
      const geo = getGeo(node.kind, meshRadius);
      const mesh = new THREE.Mesh(geo, mat);

      // Start position from node coordinates
      mesh.position.set(node.x, node.y, node.z);
      mesh.userData = { nodeId: node.id, nodeData: node };

      scene.add(mesh);
      nodeMeshes.push({ mesh, node, origScale: mesh.scale.clone() });
      nodeMeshMap.set(node.id, mesh);
    });

    nodeMeshesRef.current = nodeMeshes;
    nodeMeshMapRef.current = nodeMeshMap;

    // 9. Connection Lines
    const lineLimit = isSoftwareGl ? 200 : 750;
    const sampleConnections = graphData.connections.slice(0, lineLimit);
    sampleConnectionsRef.current = sampleConnections;

    const linePoints: number[] = [];
    const lineColors: number[] = [];

    sampleConnections.forEach(([srcId, tgtId]) => {
      const srcNode = nodeMeshMap.get(srcId)?.userData.nodeData as BrainNode | undefined;
      const tgtNode = nodeMeshMap.get(tgtId)?.userData.nodeData as BrainNode | undefined;
      if (srcNode && tgtNode) {
        linePoints.push(srcNode.x, srcNode.y, srcNode.z);
        linePoints.push(tgtNode.x, tgtNode.y, tgtNode.z);

        const c1 = sourceColorMap[srcNode.category] || new THREE.Color(0x38bdf8);
        const c2 = sourceColorMap[tgtNode.category] || new THREE.Color(0xa855f7);
        lineColors.push(c1.r * 0.4, c1.g * 0.4, c1.b * 0.4);
        lineColors.push(c2.r * 0.4, c2.g * 0.4, c2.b * 0.4);
      }
    });

    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePoints, 3));
    linesGeo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));

    const linesMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: themeConfig.lineOpacity,
      blending: THREE.AdditiveBlending,
    });

    const linesMesh = new THREE.LineSegments(linesGeo, linesMat);
    scene.add(linesMesh);
    linesMeshRef.current = linesMesh;

    // 10. Pointer Events & Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDraggingRef.current = true;
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.x = x;
      mouse.y = y;

      if (isDraggingRef.current) {
        const deltaX = e.clientX - previousMousePositionRef.current.x;
        const deltaY = e.clientY - previousMousePositionRef.current.y;

        cameraRotationRef.current.theta -= deltaX * 0.005;
        cameraRotationRef.current.phi = Math.max(
          0.05,
          Math.min(Math.PI - 0.05, cameraRotationRef.current.phi - deltaY * 0.005)
        );

        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      } else {
        raycaster.setFromCamera(mouse, camera);
        const visibleMeshes = nodeMeshesRef.current
          .filter((item) => item.mesh.visible)
          .map((item) => item.mesh);
        const intersects = raycaster.intersectObjects(visibleMeshes);

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh;
          const nodeData = hit.userData.nodeData as BrainNode;
          setHoveredNode(nodeData);
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          container.style.cursor = "pointer";
        } else {
          setHoveredNode(null);
          container.style.cursor = isDraggingRef.current ? "grabbing" : "grab";
        }
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      container.style.cursor = "grab";
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.x = x;
      mouse.y = y;

      raycaster.setFromCamera(mouse, camera);
      const visibleMeshes = nodeMeshesRef.current
        .filter((item) => item.mesh.visible)
        .map((item) => item.mesh);
      const intersects = raycaster.intersectObjects(visibleMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const nodeData = hit.userData.nodeData as BrainNode;
        onSelectNode(nodeData);
        cameraTargetRef.current.lerp(hit.position, 0.35);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistanceRef.current = Math.max(
        100,
        Math.min(850, cameraDistanceRef.current + e.deltaY * 0.4)
      );
    };

    container.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    container.addEventListener("click", handleClick);
    container.addEventListener("wheel", handleWheel, { passive: false });

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 11. Animation Loop with Fluid Position Interpolation
    const startTime = performance.now();
    let swTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;

    const scheduleNextFrame = () => {
      if (isDisposed) return;
      if (isSoftwareGl) {
        swTimeoutId = setTimeout(() => {
          if (!isDisposed) {
            animationFrameIdRef.current = requestAnimationFrame(animate);
          }
        }, 80);
      } else {
        animationFrameIdRef.current = requestAnimationFrame(animate);
      }
    };

    const animate = () => {
      if (isDisposed) return;
      const now = performance.now();
      const elapsedTime = (now - startTime) / 1000;

      const activeLayout = currentLayoutRef.current;
      const isMotion = motionEnabledRef.current;

      // Rotate core slowly
      if (coreGroup) {
        coreGroup.rotation.y += 0.005;
        coreGroup.rotation.x += 0.002;
        coreGroup.visible = activeLayout === "orbit" || activeLayout === "rings";
      }

      // Update guide visibility based on active layout
      if (guideGroup) {
        guideGroup.children.forEach((child) => {
          const gType = child.userData.guideType;
          child.visible = gType === activeLayout;
        });
      }

      // Smoothly morph nodes toward active layout target position
      nodeMeshesRef.current.forEach(({ mesh, node }) => {
        const target = node.targetPositions?.[activeLayout] || { x: node.x, y: node.y, z: node.z };
        mesh.position.lerp(target, 0.065);

        // Subtle ambient jitter / oscillation if motion is enabled
        if (isMotion && mesh.visible) {
          const jitter = Math.sin(elapsedTime * 2 + mesh.position.x * 0.05) * 0.2;
          mesh.position.y += jitter * 0.1;
        }
      });

      // Update connection line positions to follow moving nodes
      if (linesMesh && linesMesh.visible) {
        const posAttr = linesMesh.geometry.attributes.position as THREE.Float32BufferAttribute;
        const posArr = posAttr.array as Float32Array;
        let ptr = 0;
        const sampled = sampleConnectionsRef.current;
        for (let i = 0; i < sampled.length; i++) {
          const [srcId, tgtId] = sampled[i];
          const srcMesh = nodeMeshMap.get(srcId);
          const tgtMesh = nodeMeshMap.get(tgtId);
          if (srcMesh && tgtMesh) {
            posArr[ptr++] = srcMesh.position.x;
            posArr[ptr++] = srcMesh.position.y;
            posArr[ptr++] = srcMesh.position.z;
            posArr[ptr++] = tgtMesh.position.x;
            posArr[ptr++] = tgtMesh.position.y;
            posArr[ptr++] = tgtMesh.position.z;
          }
        }
        posAttr.needsUpdate = true;
      }

      // Replay Demo animation path
      if (demoTimeRef.current !== null) {
        const demoElapsed = (now - demoTimeRef.current) / 1000;
        if (demoElapsed < 12) {
          cameraRotationRef.current.theta += 0.015;
          cameraDistanceRef.current = 280 + Math.sin(demoElapsed * 0.8) * 90;
          cameraRotationRef.current.phi =
            Math.PI / 2.4 + Math.sin(demoElapsed * 0.5) * 0.25;
        } else {
          demoTimeRef.current = null;
          setIsReplayingDemo(false);
        }
      } else if (!isDraggingRef.current && isMotion) {
        // Ambient gentle camera drift
        cameraRotationRef.current.theta += 0.0008;
      }

      // Convert spherical coordinates to Cartesian camera position
      const phi = cameraRotationRef.current.phi;
      const theta = cameraRotationRef.current.theta;
      const dist = cameraDistanceRef.current;

      const targetX =
        cameraTargetRef.current.x + dist * Math.sin(phi) * Math.sin(theta);
      const targetY = cameraTargetRef.current.y + dist * Math.cos(phi);
      const targetZ =
        cameraTargetRef.current.z + dist * Math.sin(phi) * Math.cos(theta);

      camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.1);
      camera.lookAt(cameraTargetRef.current);

      if (starField) {
        starField.rotation.y = elapsedTime * 0.0002;
      }

      renderer.render(scene, camera);
      scheduleNextFrame();
    };

    animate();

    // Cleanup
    return () => {
      isDisposed = true;
      if (swTimeoutId) {
        clearTimeout(swTimeoutId);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      container.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      container.removeEventListener("click", handleClick);
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", handleResize);

      scene.clear();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [graphData, currentTheme, useGeometricShapes, onSelectNode]);

  // Update node colors & visibility based on filters, heatmap, and search
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    const sourceColorMap: Record<string, THREE.Color> = {};
    SOURCES.forEach((s) => {
      sourceColorMap[s.name] = new THREE.Color(s.color);
    });

    nodeMeshesRef.current.forEach(({ mesh, node }) => {
      const isSourceActive = activeSources[node.category];
      const matchesSearch =
        !query ||
        node.title.toLowerCase().includes(query) ||
        node.tags.some((t) => t.toLowerCase().includes(query));
      const matchesAttention = !onlyNeedsAttention || node.needsAttention;
      const matchesArea = selectedArea === "all" || node.area === selectedArea;
      const matchesKind = selectedKind === "all" || node.kind === selectedKind;
      const matchesFocus = !activeFocusSet || activeFocusSet.has(node.id);

      const isVisible =
        isSourceActive && matchesAttention && matchesArea && matchesKind && matchesFocus;
      mesh.visible = isVisible;

      if (isVisible) {
        const material = mesh.material as THREE.MeshStandardMaterial;

        // Color calculation: heatmap vs theme
        let targetColor: THREE.Color;
        if (showHeatmap) {
          if (node.stalenessDays < 14) {
            targetColor = new THREE.Color(0x22c55e); // Green fresh
          } else if (node.stalenessDays <= 35) {
            targetColor = new THREE.Color(0xeab308); // Yellow warning
          } else {
            targetColor = new THREE.Color(0xef4444); // Crimson stale
          }
        } else if (currentTheme === "phosphor") {
          targetColor = new THREE.Color(0x22c55e);
        } else if (currentTheme === "amber") {
          targetColor = new THREE.Color(0xf59e0b);
        } else {
          targetColor = sourceColorMap[node.category] || new THREE.Color(0x38bdf8);
        }

        material.color.copy(targetColor);
        material.emissive.copy(targetColor);

        if (query && !matchesSearch) {
          material.opacity = 0.15;
          material.transparent = true;
          material.emissiveIntensity = 0.05;
        } else {
          material.opacity = 1;
          material.transparent = false;
          material.emissiveIntensity =
            node.id === selectedNodeId
              ? 1.4
              : onlyNeedsAttention && node.needsAttention
              ? 0.95
              : node.isKeyAnchor
              ? 0.7
              : 0.35;
        }
      }
    });
  }, [
    graphData,
    activeSources,
    onlyNeedsAttention,
    searchQuery,
    selectedNodeId,
    showHeatmap,
    currentTheme,
    selectedArea,
    selectedKind,
    activeFocusSet,
  ]);

  return (
    <div
      className={`relative w-full h-full select-none overflow-hidden transition-colors duration-500 ${
        isFullscreen ? "fixed inset-0 z-50 bg-[#050814]" : "bg-[#050814]"
      }`}
    >
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab" />

      {/* Top Header Dock (Search Bar + Theme & Quick Controls) */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 sm:p-5 flex items-center justify-between pointer-events-none transition-opacity duration-300 z-20 ${
          isCinemaMode ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* Left Branding Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-md flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-bold font-mono tracking-wider text-slate-100">
              MAPS OS
            </span>
            <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
              v2.4
            </span>
          </div>
        </div>

        {/* Center Global Search Bar */}
        <div className="flex-1 max-w-md mx-3 pointer-events-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes, people, videos, skills... [/]"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900/90 border border-slate-700/60 focus:border-cyan-500 text-xs sm:text-sm text-slate-100 placeholder-slate-400 backdrop-blur-md outline-none transition-all shadow-xl"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right Tools & Theme Selector */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Theme Selector */}
          <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg">
            <span className="text-[10px] font-mono text-slate-400 px-2 uppercase">Theme</span>
            {(["obsidian", "blueprint", "neon", "phosphor", "amber"] as GraphTheme[]).map((thm) => (
              <button
                key={thm}
                onClick={() => setCurrentTheme(thm)}
                title={GRAPH_THEMES[thm].name}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono capitalize transition-all ${
                  currentTheme === thm
                    ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {thm}
              </button>
            ))}
          </div>

          <button
            onClick={resetCamera}
            title="Reset Camera View"
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white backdrop-blur-md transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-400 backdrop-blur-md transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Top Left Headline & Multi-Layout Switcher Bar (MAPS Dashboard Style) */}
      <div
        className={`absolute top-16 left-4 sm:left-6 max-w-sm pointer-events-none transition-opacity duration-300 z-10 ${
          isCinemaMode ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase flex items-center gap-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          MAPS MULTI-LAYOUT ENGINE
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-none mb-2">
          Every idea.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">
            Connected.
          </span>
        </h1>

        {/* Layout Mode Switcher Pills (Rings, Circle, Areas, Links, Timeline, 3D Orbit) */}
        <div className="pointer-events-auto flex items-center flex-wrap gap-1 p-1 rounded-2xl bg-slate-950/85 border border-slate-800/90 backdrop-blur-xl shadow-2xl mb-2">
          <button
            onClick={() => setCurrentLayout("rings")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all ${
              currentLayout === "rings"
                ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="w-3 h-3 text-cyan-400" />
            rings
          </button>

          <button
            onClick={() => setCurrentLayout("circle")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all ${
              currentLayout === "circle"
                ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CircleIcon className="w-3 h-3 text-sky-400" />
            circle
          </button>

          <button
            onClick={() => setCurrentLayout("areas")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all ${
              currentLayout === "areas"
                ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Boxes className="w-3 h-3 text-emerald-400" />
            areas
          </button>

          <button
            onClick={() => setCurrentLayout("links")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all ${
              currentLayout === "links"
                ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitFork className="w-3 h-3 text-purple-400" />
            links
          </button>

          <button
            onClick={() => setCurrentLayout("timeline")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all ${
              currentLayout === "timeline"
                ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-3 h-3 text-amber-400" />
            timeline
          </button>

          <button
            onClick={() => setCurrentLayout("orbit")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all ${
              currentLayout === "orbit"
                ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            3d orbit
          </button>
        </div>

        {/* View Customization Controls (Heat, Names, Motion, Camera Angle) */}
        <div className="pointer-events-auto flex items-center flex-wrap gap-1.5 p-1.5 rounded-xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-md shadow-xl text-xs">
          {/* Heatmap Toggle */}
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] transition-all ${
              showHeatmap
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame className="w-3 h-3 text-amber-400" />
            heat map
          </button>

          {/* Labels Toggle */}
          <button
            onClick={() =>
              setLabelMode((prev) => (prev === "anchors" ? "all" : prev === "all" ? "none" : "anchors"))
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] transition-all ${
              labelMode !== "none"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3 h-3 text-cyan-400" />
            names ({labelMode})
          </button>

          {/* Motion Toggle */}
          <button
            onClick={() => setMotionEnabled(!motionEnabled)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] transition-all ${
              motionEnabled
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-3 h-3 text-indigo-400" />
            motion
          </button>

          {/* 3D vs 2D Top-Down View */}
          <button
            onClick={() => handleViewAngleChange(viewAngle === "3d" ? "topdown" : "3d")}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/60 text-slate-400 hover:text-slate-200 font-mono text-[10px] transition-all"
          >
            <Sliders className="w-3 h-3 text-sky-400" />
            view: {viewAngle}
          </button>

          {/* Focus Isolation */}
          <button
            onClick={() => setFocusIsolation(!focusIsolation)}
            title="Focus isolation: dim all nodes outside 2-hop radius of selected"
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] transition-all ${
              focusIsolation
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3 h-3 text-purple-400" />
            focus
          </button>

          {/* Geometric Shapes Toggle */}
          <button
            onClick={() => setUseGeometricShapes(!useGeometricShapes)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] transition-all ${
              useGeometricShapes
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Boxes className="w-3 h-3 text-teal-400" />
            3d shapes
          </button>
        </div>

        {/* Filter Chips Bar (Area Chips & Kind Chips) */}
        <div className="pointer-events-auto mt-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800/60 backdrop-blur-md space-y-1.5">
          {/* Area Chips */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-sm py-0.5 scrollbar-none">
            <span className="text-[9px] font-mono text-slate-400 uppercase shrink-0 mr-1">Area:</span>
            {(["all", "business", "clients", "career", "content", "youtube", "personal", "system"] as (NodeArea | "all")[]).map((area) => (
              <button
                key={area}
                onClick={() => setSelectedArea(area)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono capitalize shrink-0 transition-all ${
                  selectedArea === area
                    ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/60 font-semibold"
                    : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {area === "all" ? "all" : area}
              </button>
            ))}
          </div>

          {/* Kind Chips */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-sm py-0.5 scrollbar-none">
            <span className="text-[9px] font-mono text-slate-400 uppercase shrink-0 mr-1">Kind:</span>
            {(["all", "skill", "project", "note", "memory", "routine", "app", "run"] as (NodeKind | "all")[]).map((k) => (
              <button
                key={k}
                onClick={() => setSelectedKind(k)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono capitalize shrink-0 transition-all ${
                  selectedKind === k
                    ? "bg-indigo-500/30 text-indigo-200 border border-indigo-500/60 font-semibold"
                    : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {k === "all" ? "all" : k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Left Sources Filter Legend */}
      <div
        className={`absolute bottom-6 left-4 sm:left-6 w-60 rounded-2xl bg-slate-950/85 border border-slate-800/80 p-3.5 backdrop-blur-xl shadow-2xl transition-all duration-300 z-10 ${
          isCinemaMode ? "opacity-20 hover:opacity-100" : "opacity-100"
        }`}
      >
        <div className="text-[10px] font-mono tracking-wider uppercase text-slate-400 mb-2 flex items-center justify-between">
          <span>Sources</span>
          <span className="text-slate-400 font-mono text-[9px]">Click to filter</span>
        </div>

        <div className="space-y-1">
          {SOURCES.map((source) => {
            const isActive = activeSources[source.name];
            return (
              <button
                key={source.name}
                onClick={() => toggleSource(source.name)}
                className={`w-full flex items-center justify-between py-1 px-2 rounded-lg text-xs transition-all ${
                  isActive
                    ? "text-slate-200 bg-slate-900/60 hover:bg-slate-800/80"
                    : "text-slate-400 line-through opacity-50 hover:opacity-80"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shadow-sm"
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="font-medium truncate">{source.name}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {graphData.nodes.filter((n) => n.category === source.name).length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-800/80">
          <label className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyNeedsAttention}
              onChange={(e) => setOnlyNeedsAttention(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
            />
            <span className="flex items-center gap-1.5 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Only what needs attention
            </span>
          </label>
        </div>
      </div>

      {/* Floating 2D Anchor Labels (when enabled) */}
      {labelMode !== "none" && !isCinemaMode && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {graphData.nodes.slice(0, 5).map((anchor, idx) => {
            const positions = [
              { top: "22%", left: "45%" },
              { top: "35%", left: "62%" },
              { bottom: "35%", right: "22%" },
              { bottom: "22%", left: "52%" },
              { bottom: "42%", left: "30%" },
            ];
            const pos = positions[idx] || positions[0];
            return (
              <div
                key={anchor.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-slate-950/85 border border-cyan-500/50 text-[11px] font-mono text-cyan-200 backdrop-blur-md shadow-lg"
                style={pos}
              >
                {anchor.title}
              </div>
            );
          })}

          {/* Area badges in "areas" mode */}
          {currentLayout === "areas" && (
            <>
              <div className="absolute top-1/5 left-1/3 px-2 py-0.5 rounded bg-sky-950/90 border border-sky-400 text-[10px] font-mono text-sky-300">
                [Business Hub]
              </div>
              <div className="absolute bottom-1/4 right-1/4 px-2 py-0.5 rounded bg-amber-950/90 border border-amber-400 text-[10px] font-mono text-amber-300">
                [YouTube Engine]
              </div>
              <div className="absolute top-1/2 right-1/3 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-400 text-[10px] font-mono text-emerald-300">
                [Content & Media]
              </div>
            </>
          )}

          {/* Timeline horizon markers in "timeline" mode */}
          {currentLayout === "timeline" && (
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex items-center gap-12 font-mono text-[10px] text-slate-400">
              <span className="text-emerald-400">← Fresh (&lt;14d)</span>
              <span className="text-amber-400">● Stable (14-35d)</span>
              <span className="text-rose-400">Review Needed (&gt;35d) →</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Center Controls & Demo Replay */}
      <div
        className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 transition-opacity duration-300 z-10 ${
          isCinemaMode ? "opacity-0" : "opacity-100"
        }`}
      >
        <button
          onClick={startReplayDemo}
          disabled={isReplayingDemo}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 hover:text-white font-medium text-xs backdrop-blur-md shadow-xl transition-all disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isReplayingDemo ? "Playing Demo..." : "Replay demo"}
        </button>

        <button
          onClick={fitCameraBounds}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium text-xs backdrop-blur-md shadow-xl transition-all"
        >
          Fit View
        </button>

        <button
          onClick={() => setIsCinemaMode(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium text-xs backdrop-blur-md shadow-xl transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Cinema
        </button>
      </div>

      {/* Bottom Right Growth & Health Card (MAPS OS Real-time Telemetry) */}
      <div
        className={`absolute bottom-6 right-4 sm:right-6 w-72 rounded-2xl bg-slate-950/85 border border-slate-800/80 p-4 backdrop-blur-xl shadow-2xl transition-all duration-300 z-10 ${
          isCinemaMode ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-cyan-400 mb-1">
          <span>CORTEXOS BRAIN GRAPH</span>
          <span className="text-slate-400 font-mono text-[9px]">POSTGRES v1</span>
        </div>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-3xl font-extrabold text-white font-mono">
            {graphData.nodes.length}
          </span>
          <span className="text-xs text-slate-400">objects in the brain</span>
        </div>
        <div className="text-xs font-semibold text-slate-200 mb-1.5">
          Your entire brain. Connected.
        </div>

        {/* MAPS Check Metrics Grid */}
        <div className="grid grid-cols-3 gap-1 py-1.5 px-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[10px] font-mono mb-2">
          <div>
            <div className="text-cyan-400 font-bold">100%</div>
            <div className="text-slate-400 text-[8px] uppercase">Provenance</div>
          </div>
          <div>
            <div className="text-emerald-400 font-bold">
              {graphData.connections.length}
            </div>
            <div className="text-slate-400 text-[8px] uppercase">Edges</div>
          </div>
          <div>
            <div className="text-purple-400 font-bold">
              {(
                graphData.connections.length /
                Math.max(1, graphData.nodes.length)
              ).toFixed(2)}
            </div>
            <div className="text-slate-400 text-[8px] uppercase">Links/Node</div>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between" suppressHydrationWarning>
          <span>Active view</span>
          <span className="font-mono text-cyan-300">{statsNoteCount} of {graphData.nodes.length} nodes</span>
        </div>

        {/* Glowing progress line */}
        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 rounded-full transition-all duration-500"
            style={{
              width: `${
                (statsNoteCount / Math.max(1, graphData.nodes.length)) * 100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-2 left-6 text-[10px] font-mono text-slate-400 pointer-events-none z-10 hidden sm:block">
        Layout: <span className="text-cyan-400 font-bold">{currentLayout}</span> • Drag to orbit • Scroll to zoom • Click node to inspect
      </div>

      {/* Hover Tooltip Card */}
      {hoveredNode && tooltipPos && (
        <div
          className="absolute pointer-events-none z-40 transform -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="p-3 rounded-xl bg-slate-900/95 border border-cyan-500/50 shadow-2xl shadow-cyan-950/50 backdrop-blur-md max-w-xs text-left">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    SOURCES.find((s) => s.name === hoveredNode.category)?.color || "#38bdf8",
                }}
              />
              <span className="text-[10px] font-mono uppercase text-cyan-400">
                {hoveredNode.category}
              </span>
              {hoveredNode.kind && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono">
                  {hoveredNode.kind}
                </span>
              )}
              {hoveredNode.area && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                  {hoveredNode.area}
                </span>
              )}
              {hoveredNode.needsAttention && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  Needs review
                </span>
              )}
            </div>
            <div className="text-xs font-bold text-white mb-1">{hoveredNode.title}</div>
            <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
              {hoveredNode.summary}
            </p>
            <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>{hoveredNode.connections.length} connections</span>
              <span>Updated {hoveredNode.stalenessDays}d ago</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
