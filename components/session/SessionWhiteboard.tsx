"use client";

import { useEffect, useRef, useState } from "react";
import type { WhiteboardStroke } from "@/lib/socket";
import { getSingleton } from "@/lib/socket";

type SessionWhiteboardProps = {
  strokes?: WhiteboardStroke[];
  isTeacher: boolean;
  isLocked: boolean;
  onToggleLock: () => void;
  onDraw?: (strokes: WhiteboardStroke[]) => void;
  onClear: () => void;
};

export default function SessionWhiteboard({
  isTeacher,
  isLocked,
  onToggleLock,
  onClear,
}: SessionWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#f5f5f5");
  const [roomId, setRoomId] = useState<string>("");
  const socketRef = useRef<ReturnType<typeof import("socket.io-client")["io"]> | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Extract RoomID from URL
  useEffect(() => {
    const match = window.location.pathname.match(/\/session\/([^\/]+)/);
    if (match?.[1]) setRoomId(match[1]);
  }, []);

  // Initialize Socket.io Subscriptions
  useEffect(() => {
    if (!roomId) return;
    let socket: ReturnType<typeof import("socket.io-client")["io"]>;

    getSingleton().then((singleton) => {
      if (singleton.kind === "socket") {
        socket = singleton.client;
        socketRef.current = socket;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        
        socket.on("whiteboard-draw", (data: { x0: number, y0: number, x1: number, y1: number, color: string, lineWidth: number }) => {
          if (!ctx || !canvas) return;
          ctx.beginPath();
          ctx.strokeStyle = data.color;
          ctx.lineWidth = data.lineWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.moveTo(data.x0 * canvas.width, data.y0 * canvas.height);
          ctx.lineTo(data.x1 * canvas.width, data.y1 * canvas.height);
          ctx.stroke();
        });

        socket.on("whiteboard-clear", () => {
          if (!ctx || !canvas) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        socket.on("request-snapshot", (payload: { targetSocketId: string }) => {
          if (!canvas) return;
          socket.emit("canvas-snapshot", {
            roomId,
            data: canvas.toDataURL(),
            targetSocketId: payload.targetSocketId,
          });
        });

        socket.on("canvas-snapshot", (payload: { data: string }) => {
          if (!ctx || !canvas || !payload.data) return;
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = payload.data;
        });

        // Request initial state
        socket.emit("request-snapshot", { roomId });

        if (isTeacher) {
          socket.emit("whiteboard-active", { isActive: true, roomId });
        }
      }
    });

    return () => {
      if (socket) {
        socket.off("whiteboard-draw");
        socket.off("whiteboard-clear");
        socket.off("request-snapshot");
        socket.off("canvas-snapshot");
        if (isTeacher) socket.emit("whiteboard-active", { isActive: false, roomId });
      }
    };
  }, [roomId, isTeacher]);

  // Handle Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      // Save existing to restore after resize
      const dataUrl = canvas.toDataURL();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = dataUrl;
      }
    }
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isTeacher && isLocked) return;
    e.preventDefault();
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    lastPosRef.current = {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPosRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    // Draw locally immediately
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(lastPosRef.current.x * canvas.width, lastPosRef.current.y * canvas.height);
      ctx.lineTo(x * canvas.width, y * canvas.height);
      ctx.stroke();
    }

    // Throttle emit to network via requestAnimationFrame cycle simulation (~16ms)
    if (socketRef.current) {
      socketRef.current.emit("whiteboard-draw", {
        roomId,
        x0: lastPosRef.current.x,
        y0: lastPosRef.current.y,
        x1: x,
        y1: y,
        color,
        lineWidth: 3,
      });
    }

    lastPosRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    
    if (socketRef.current) {
      socketRef.current.emit("whiteboard-clear", { roomId });
    }
    onClear();
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#161616] rounded-2xl overflow-hidden shadow-2xl border border-[#2a2a2a]">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[rgba(255,255,255,0.08)] backdrop-blur-md px-4 py-2 rounded-full border border-[rgba(255,255,255,0.1)]">
        {isTeacher && (
          <>
            <button
              onClick={onToggleLock}
              className={`px-3 py-1 flex items-center gap-1 text-[11px] font-bold rounded-md uppercase tracking-wider transition-colors ${
                isLocked ? "bg-red-500/20 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {isLocked ? "Locked" : "Unlocked"}
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
          </>
        )}
        <button
          onClick={() => setColor("#f5f5f5")}
          className={`w-6 h-6 rounded-full border-2 ${
            color === "#f5f5f5" ? "border-emerald-400" : "border-transparent"
          }`}
          style={{ backgroundColor: "#f5f5f5" }}
        />
        <button
          onClick={() => setColor("#f87171")}
          className={`w-6 h-6 rounded-full border-2 ${
            color === "#f87171" ? "border-emerald-400" : "border-transparent"
          }`}
          style={{ backgroundColor: "#f87171" }}
        />
        <button
          onClick={() => setColor("#4ade80")}
          className={`w-6 h-6 rounded-full border-2 ${
            color === "#4ade80" ? "border-white" : "border-transparent"
          }`}
          style={{ backgroundColor: "#4ade80" }}
        />
        <div className="w-px h-6 bg-white/20 mx-2" />
        <button
          onClick={handleClear}
          className="text-xs font-medium text-white/80 hover:text-white px-2 py-1"
        >
          Clear All
        </button>
      </div>

      <canvas
        id="whiteboard-canvas"
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-full cursor-crosshair touch-none"
      />
    </div>
  );
}
