"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ALL_MARS_PLACES, ScienceTargetFeature } from "@/lib/marsData";
import { DrawnProfileResult } from "@/lib/marsTerrain";

interface Mars3DGlobeViewProps {
  onSelectPlace?: (place: ScienceTargetFeature) => void;
  selectedPlace?: ScienceTargetFeature;
  drawnRouteCoords?: [number, number][] | null;
  drawnProfile?: DrawnProfileResult | null;
}

// Convert Martian (Lon, Lat) in degrees to 3D Sphere Vector3 (Radius R)
export function latLonToSphereVector3(lonDeg: number, latDeg: number, radius: number): THREE.Vector3 {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export function Mars3DGlobeView({
  onSelectPlace,
  drawnRouteCoords,
}: Mars3DGlobeViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredPlace, setHoveredPlace] = useState<ScienceTargetFeature | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, WebGL Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020306);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 2.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 2. Realistic Starfield Background
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 120;
      starPositions[i + 1] = (Math.random() - 0.5) * 120;
      starPositions[i + 2] = (Math.random() - 0.5) * 120;
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xcfd8dc, size: 0.12 });
    scene.add(new THREE.Points(starsGeo, starsMat));

    // 3. Realistic Sunlight & Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    sunLight.position.set(5, 2, 4);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    fillLight.position.set(-5, -2, -3);
    scene.add(fillLight);

    // 4. Mars Sphere (High Subdivision 128x128)
    const sphereRadius = 1.0;
    const globeGeometry = new THREE.SphereGeometry(sphereRadius, 128, 128);

    // Load High-Res NASA Texture (2K crisp local asset with polar ice cap)
    const textureLoader = new THREE.TextureLoader();
    const marsTexture = textureLoader.load("/mars_texture_hd.jpg");
    marsTexture.colorSpace = THREE.SRGBColorSpace;
    marsTexture.generateMipmaps = true;
    marsTexture.minFilter = THREE.LinearMipmapLinearFilter;

    const globeMaterial = new THREE.MeshStandardMaterial({
      map: marsTexture,
      roughness: 0.85,
      metalness: 0.04,
    });

    const marsGlobe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(marsGlobe);

    // 5. NASA Trek Style Mars Atmosphere Ring (Thin Sunset Halo)
    const haloGeo = new THREE.SphereGeometry(sphereRadius * 1.018, 64, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xc2410c,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
    });
    marsGlobe.add(new THREE.Mesh(haloGeo, haloMat));

    // 6. Synchronized Landmark POI Pins (Matching 2D Map)
    const poiGroup = new THREE.Group();
    const pinMeshes: { mesh: THREE.Mesh; feat: ScienceTargetFeature }[] = [];

    for (const feat of ALL_MARS_PLACES) {
      const [lon, lat] = feat.geometry.coordinates;
      const isJezero = feat.properties.inJezeroGrid;

      const pos = latLonToSphereVector3(lon, lat, sphereRadius * 1.008);
      const pinColor = isJezero ? 0x0284c7 : 0xe11d48;

      const pinGeo = new THREE.SphereGeometry(isJezero ? 0.016 : 0.02, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: pinColor });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.copy(pos);

      // White Pin stem pointing outwards
      const stemGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.024, 8);
      const stemMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stemMesh = new THREE.Mesh(stemGeo, stemMat);
      stemMesh.position.copy(latLonToSphereVector3(lon, lat, sphereRadius * 1.015));
      stemMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());

      poiGroup.add(pinMesh);
      poiGroup.add(stemMesh);
      pinMeshes.push({ mesh: pinMesh, feat });
    }
    marsGlobe.add(poiGroup);

    // 7. Synchronized Route Line on 3D Globe
    if (drawnRouteCoords && drawnRouteCoords.length >= 2) {
      const curvePoints = drawnRouteCoords.map(([lon, lat]) =>
        latLonToSphereVector3(lon, lat, sphereRadius * 1.012)
      );
      const lineCurve = new THREE.CatmullRomCurve3(curvePoints);
      const tubeGeo = new THREE.TubeGeometry(lineCurve, 64, 0.005, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const routeTube = new THREE.Mesh(tubeGeo, tubeMat);
      marsGlobe.add(routeTube);
    }

    // 8. Interactive Orbit Drag & Zoom
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycaster for Landmark hover
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
      const intersects = raycaster.intersectObjects(pinMeshes.map((p) => p.mesh));

      if (intersects.length > 0) {
        const found = pinMeshes.find((p) => p.mesh === intersects[0].object);
        if (found) setHoveredPlace(found.feat);
      } else {
        setHoveredPlace(null);
      }

      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      prevMousePos = { x: e.clientX, y: e.clientY };

      marsGlobe.rotation.y += deltaX * 0.005;
      marsGlobe.rotation.x += deltaY * 0.005;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(1.35, Math.min(4.8, camera.position.z + e.deltaY * 0.0015));
    };

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
      const intersects = raycaster.intersectObjects(pinMeshes.map((p) => p.mesh));

      if (intersects.length > 0) {
        const found = pinMeshes.find((p) => p.mesh === intersects[0].object);
        if (found && onSelectPlace) {
          onSelectPlace(found.feat);
        }
      }
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("click", onClick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 9. Smooth Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isDragging) {
        marsGlobe.rotation.y += 0.0008; // slow realistic rotation
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("click", onClick);
      window.removeEventListener("resize", handleResize);

      renderer.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      marsTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [drawnRouteCoords, onSelectPlace]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#020306] select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* NASA Trek 3D Globe HUD Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-1.5 border border-sky-400 text-white text-xs font-mono shadow-2xl flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-bold">NASA MARS TREK 3D GLOBE</span>
        <span className="text-slate-400">· Drag untuk memutar · Scroll zoom</span>
      </div>

      {/* Hovered Landmark Tooltip */}
      {hoveredPlace && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900/95 px-3 py-2 border border-sky-400 text-white shadow-2xl pointer-events-none text-center font-mono">
          <div className="text-xs font-bold text-sky-300">{hoveredPlace.properties.name}</div>
          <div className="text-[10px] text-slate-300 mt-0.5">
            Lat: {hoveredPlace.geometry.coordinates[1].toFixed(2)}°, Lon: {hoveredPlace.geometry.coordinates[0].toFixed(2)}° | Elev: {hoveredPlace.properties.elevation_m}m
          </div>
        </div>
      )}
    </div>
  );
}
