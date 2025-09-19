import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface SentimentPoint {
  x: number; // Sentiment: -1 (negative), 0 (neutral), +1 (positive)
  y: number; // Minutes: 0-1439 (0 = midnight, 1439 = 11:59 PM)
  z: number; // Day: 1-31
  sentiment: string;
  confidence: number;
  tweetId: number;
}

interface SentimentGraph3DProps {
  data: SentimentPoint[];
}

const SentimentPoints = ({ data }: { data: SentimentPoint[] }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Debug logging
  console.log(`🎯 SentimentPoints received ${data.length} data points`)
  if (data.length > 0) {
    console.log(`🎯 Sample data points:`, data.slice(0, 3))
  }

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.05;
    }
  });

  const points = useMemo(() => {
    // Group points by location to handle clustering
    const pointGroups = new Map<string, typeof data>();
    
    data.forEach((point, index) => {
      const key = `${point.x}-${point.y}-${point.z}`;
      if (!pointGroups.has(key)) {
        pointGroups.set(key, []);
      }
      pointGroups.get(key)!.push({ ...point, originalIndex: index });
    });

    console.log(`🎯 Found ${pointGroups.size} unique locations from ${data.length} points`);

    return Array.from(pointGroups.entries()).map(([key, groupPoints]) => {
      const basePoint = groupPoints[0];
      
      // Scale the coordinates for better visualization
      // X-axis: Sentiment (-1 to +1)
      // Y-axis: Minutes (0-1439) 
      // Z-axis: Day (1-31)
      const scaledX = basePoint.x * 2; // Spread sentiment across X-axis
      const scaledY = basePoint.y * 0.02; // Minutes 0-1439 scaled to reasonable height (0-28.78)
      const scaledZ = (basePoint.z - 16) * 0.5; // Center days around 16

      // Color based on sentiment
      let color: string;
      switch (basePoint.sentiment) {
        case 'positive':
          color = '#22c55e'; // Green
          break;
        case 'negative':
          color = '#ef4444'; // Red
          break;
        case 'neutral':
          color = '#f59e0b'; // Orange/Yellow
          break;
        default:
          color = '#6b7280'; // Gray
      }

      // Size based on number of points at this location and average confidence
      const avgConfidence = groupPoints.reduce((sum, p) => sum + p.confidence, 0) / groupPoints.length;
      const clusterSize = Math.min(0.3, 0.1 + (groupPoints.length * 0.05)); // Larger for clusters
      const confidenceSize = 0.1 + (avgConfidence * 0.2);
      const size = Math.max(clusterSize, confidenceSize);

      // Add slight random offset for multiple points at same location
      const offsetX = groupPoints.length > 1 ? (Math.random() - 0.5) * 0.3 : 0;
      const offsetY = groupPoints.length > 1 ? (Math.random() - 0.5) * 0.2 : 0;
      const offsetZ = groupPoints.length > 1 ? (Math.random() - 0.5) * 0.3 : 0;

      return (
        <mesh 
          key={`cluster-${key}`} 
          position={[scaledX + offsetX, scaledY + offsetY, scaledZ + offsetZ]}
        >
          <sphereGeometry args={[size, 8, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
            transparent
            opacity={0.9}
          />
        </mesh>
      );
    });
  }, [data]);

  return (
    <group ref={groupRef}>
      {points}

      {/* Grid lines */}
      <gridHelper args={[20, 10, '#4f46e5', '#374151']} position={[0, 0, 0]} />

      {/* Axis labels */}
      <Text
        position={[0, -2, 0]}
        fontSize={0.5}
        color="#a3a3a3"
        anchorX="center"
        anchorY="middle"
      >
        X: Sentiment (-1 Negative, 0 Neutral, +1 Positive)
      </Text>

      <Text
        position={[0, 15, 0]}
        fontSize={0.5}
        color="#a3a3a3"
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
      >
        Y: Minutes (0-1439)
      </Text>

      <Text
        position={[-10, -2, 0]}
        fontSize={0.5}
        color="#a3a3a3"
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
      >
        Z: Days (1-31)
      </Text>

      {/* Reference lines for sentiment levels on X-axis */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={6}
            array={new Float32Array([
              -2, 0, -10, -2, 30, -10, // Negative line
               0, 0, -10,  0, 30, -10, // Neutral line
               2, 0, -10,  2, 30, -10  // Positive line
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#6b7280" opacity={0.3} transparent />
      </lineSegments>
    </group>
  );
};

export const SentimentGraph3D: React.FC<SentimentGraph3DProps> = ({ data }) => {
  return (
    <div className="w-full h-full bg-card rounded-lg border shadow-card overflow-hidden relative">
      <Canvas
        camera={{ position: [8, 5, 8], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <directionalLight position={[-10, 10, 5]} intensity={0.5} />

        <SentimentPoints data={data} />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          autoRotate={false}
        />
      </Canvas>

      <div className="absolute top-4 left-4 bg-card/80 backdrop-blur-sm rounded-lg p-3 border">
        <h3 className="text-sm font-semibold mb-2">Legend</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Positive (+1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Negative (-1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Neutral (0)</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          <div>Point size = Confidence level</div>
          <div>Larger points = Multiple tweets</div>
        </div>
      </div>

      <div className="absolute top-4 right-4 bg-card/80 backdrop-blur-sm rounded-lg p-3 border">
        <h3 className="text-sm font-semibold mb-2">3D Controls</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Click + drag to rotate</div>
          <div>Scroll to zoom</div>
          <div>Right-click + drag to pan</div>
        </div>
      </div>
    </div>
  );
};