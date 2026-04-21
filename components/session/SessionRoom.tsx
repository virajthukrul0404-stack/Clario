"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPeerConnection } from "@/lib/webrtc";
import {
  connectSessionRoom,
  type SessionChatMessage,
  type SessionParticipantMediaState,
  type SessionRoomConnection,
  type SessionRoomPresence,
  type WhiteboardStroke,
  type SharedResource,
} from "@/lib/socket";
import SessionWhiteboard from "./SessionWhiteboard";
import SessionNotes from "./SessionNotes";
import SessionResources from "./SessionResources";
import SessionSummaryTab from "./SessionSummaryTab";

type SessionRoomProps = {
  session: {
    id: string;
    roomIdentifier: string;
    status: string;
    booking: {
      teacher: { userId: string; user: { firstName: string; lastName: string } };
      learner: { userId: string; user: { firstName: string; lastName: string } };
    };
    messages: SessionChatMessage[];
  };
  currentUserId: string;
};

type IceConfigResponse = {
  iceServers?: RTCIceServer[];
};

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const response = await fetch("/api/rtc-config", {
      cache: "no-store",
    });

    if (!response.ok) {
      return FALLBACK_ICE_SERVERS;
    }

    const payload = (await response.json().catch(() => null)) as
      | IceConfigResponse
      | null;

    return payload?.iceServers && payload.iceServers.length > 0
      ? payload.iceServers
      : FALLBACK_ICE_SERVERS;
  } catch {
    return FALLBACK_ICE_SERVERS;
  }
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = "Participant"
) {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim() || fallback;
}

export default function SessionRoom({
  session,
  currentUserId,
}: SessionRoomProps) {
  const router = useRouter();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [messages, setMessages] = useState<SessionChatMessage[]>(session.messages);
  const [messageInput, setMessageInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "waiting" | "connecting" | "connected" | "reconnecting"
  >("waiting");
  const [remoteMediaState, setRemoteMediaState] =
    useState<SessionParticipantMediaState | null>(null);
  const [roomPresence, setRoomPresence] = useState<SessionRoomPresence>({
    roomIdentifier: session.roomIdentifier,
    participantCount: 1,
    participantUserIds: [currentUserId],
  });
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [hasHydrated, setHasHydrated] = useState(false);

  // New Feature States
  const [activeTab, setActiveTab] = useState<"CHAT" | "NOTES" | "FILES" | "SUMMARY" | "AI">("CHAT");
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [isWhiteboardLocked, setIsWhiteboardLocked] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<WhiteboardStroke[]>([]);
  const [notesContent, setNotesContent] = useState("");
  const [resources, setResources] = useState<SharedResource[]>([]);
  
  const [aiMessages, setAiMessages] = useState<
    {role: "user" | "assistant"; content: string}[]
  >([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function handleAiSend() {
    if (!aiInput.trim()) return;
    const userMsg = { role: "user" as const, content: aiInput };
    const newHistory = [...aiMessages, userMsg];
    setAiMessages(newHistory);
    setAiInput("");
    setAiLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: aiInput,
          history: aiMessages,
          sessionContext: `Tutoring session ${session.id}`
        }),
      });
      const data = await res.json();
      setAiMessages([
        ...newHistory,
        { role: "assistant", content: data.reply }
      ]);
    } catch {
      setAiMessages([
        ...newHistory,
        { role: "assistant", 
          content: "Sorry, something went wrong." }
      ]);
    } finally {
      setAiLoading(false);
    }
  }
  
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const roomConnectionRef = useRef<SessionRoomConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const joinedRoomRef = useRef(false);
  const readySentRef = useRef(false);
  const sessionClosedRef = useRef(false);
  const navigationFallbackRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);
  const isMicOnRef = useRef(true);
  const isCamOnRef = useRef(true);

  const isHost = session.booking.teacher.userId === currentUserId;
  const teacherName = getDisplayName(
    session.booking.teacher.user.firstName,
    session.booking.teacher.user.lastName,
    "Teacher"
  );
  const learnerName = getDisplayName(
    session.booking.learner.user.firstName,
    session.booking.learner.user.lastName,
    "Learner"
  );
  const myName = isHost ? teacherName : learnerName;
  const otherParticipantName = isHost ? learnerName : teacherName;
  const otherUserId = isHost
    ? session.booking.learner.userId
    : session.booking.teacher.userId;
  const dashboardPath = isHost ? "/teacher-dashboard" : "/dashboard";
  const roomCode = session.roomIdentifier.slice(0, 8);

  const clearNavigationFallback = () => {
    if (typeof window === "undefined" || navigationFallbackRef.current === null) {
      return;
    }

    window.clearTimeout(navigationFallbackRef.current);
    navigationFallbackRef.current = null;
  };

  const clearRemoteParticipant = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemoteStream(null);
    setRemoteMediaState(null);
  };

  const destroyPeerConnection = () => {
    pendingIceCandidatesRef.current = [];

    const peer = peerRef.current;
    if (!peer) {
      return;
    }

    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.onconnectionstatechange = null;
    peer.oniceconnectionstatechange = null;
    peer.close();
    peerRef.current = null;
  };

  const stopLocalMedia = (resetState = true) => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    stream.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (resetState && isMountedRef.current) {
      setLocalStream(null);
    }
  };

  const emitRoomEvent = async (
    event:
      | "webrtc:offer"
      | "webrtc:answer"
      | "webrtc:ice"
      | "webrtc:ready"
      | "media:state"
      | "session:end"
      | "session:leave"
      | "screen:state"
      | "whiteboard:state"
      | "whiteboard:draw"
      | "whiteboard:clear"
      | "notes:sync"
      | "resource:share",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any = {}
  ) => {
    const connection = roomConnectionRef.current;
    if (!connection) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await connection.emit(event, payload as any);
  };

  const emitLocalMediaState = (
    micEnabled = isMicOnRef.current,
    cameraEnabled = isCamOnRef.current
  ) => {
    if (!joinedRoomRef.current) {
      return;
    }

    void emitRoomEvent("media:state", {
      cameraEnabled,
      micEnabled,
      userId: currentUserId,
    }).catch(() => {
      if (!sessionClosedRef.current) {
        setRoomError("Unable to sync media state right now.");
      }
    });
  };

  const emitReadyIfPossible = () => {
    if (readySentRef.current || !joinedRoomRef.current || !localStreamRef.current) {
      return;
    }

    emitLocalMediaState();
    readySentRef.current = true;
    setRoomError(null);

    void emitRoomEvent("webrtc:ready").catch(() => {
      readySentRef.current = false;
      if (!sessionClosedRef.current) {
        setRoomError("Unable to connect to the live room right now.");
      }
    });

    if (pendingOfferRef.current && !isHost) {
      void (async () => {
        try {
          const offer = pendingOfferRef.current as RTCSessionDescriptionInit;
          pendingOfferRef.current = null;
          setConnectionStatus("connecting");
          const peer = await createPeer(localStreamRef.current!);
          await peer.setRemoteDescription(new RTCSessionDescription(offer));
          await flushPendingIceCandidates(peer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await emitRoomEvent("webrtc:answer", { answer });
        } catch (e: any) {
          destroyPeerConnection();
          setConnectionStatus("reconnecting");
          setRoomError("We hit a connection issue and are retrying. " + String(e));
        }
      })();
    }
  };

  const syncRemoteMediaState = (payloads: SessionParticipantMediaState[]) => {
    const remoteParticipant =
      payloads.find((item) => item.userId === otherUserId) ??
      payloads.find((item) => item.userId !== currentUserId) ??
      null;

    setRemoteMediaState(remoteParticipant);
  };

  const flushPendingIceCandidates = async (peer: RTCPeerConnection) => {
    if (!peer.remoteDescription) {
      return;
    }

    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale ICE candidates during peer replacement/reconnect.
      }
    }
  };

  const createPeer = async (stream: MediaStream) => {
    destroyPeerConnection();

    const iceServers = await fetchIceServers();
    const peer = await createPeerConnection({
      iceServers,
      localStream: stream,
    });

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void emitRoomEvent("webrtc:ice", {
        candidate: event.candidate,
      }).catch(() => {
        if (!sessionClosedRef.current) {
          setRoomError("We hit a connection issue and are retrying.");
        }
      });
    };

    peer.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (!incomingStream) {
        return;
      }

      setRemoteStream(incomingStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = incomingStream;
      }

      setConnectionStatus("connected");
      setRoomError(null);
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setConnectionStatus("connected");
        return;
      }

      if (
        peer.connectionState === "disconnected" ||
        peer.connectionState === "failed"
      ) {
        clearRemoteParticipant();
        setConnectionStatus("reconnecting");
        return;
      }

      if (peer.connectionState === "closed" && !sessionClosedRef.current) {
        clearRemoteParticipant();
        setConnectionStatus("waiting");
      }
    };

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed" && !sessionClosedRef.current) {
        clearRemoteParticipant();
        setConnectionStatus("reconnecting");
      }
    };

    peerRef.current = peer;
    return peer;
  };

  const navigateToDashboard = () => {
    clearNavigationFallback();
    router.replace(dashboardPath);

    if (typeof window !== "undefined") {
      navigationFallbackRef.current = window.setTimeout(() => {
        if (window.location.pathname.startsWith("/session/")) {
          window.location.replace(dashboardPath);
        }
      }, 500);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    isMountedRef.current = true;
    setHasHydrated(true);

    return () => {
      isMountedRef.current = false;
      clearNavigationFallback();
    };
  }, []);

  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  useEffect(() => {
    isCamOnRef.current = isCamOn;
  }, [isCamOn]);

  useEffect(() => {
    let isCancelled = false;
    const remoteVideoElement = remoteVideoRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError("Camera and microphone are not available in this browser.");
      setIsMicOn(false);
      setIsCamOn(false);
      isMicOnRef.current = false;
      isCamOnRef.current = false;
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        if (isCancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const micEnabled = mediaStream.getAudioTracks()[0]?.enabled ?? true;
        const cameraEnabled = mediaStream.getVideoTracks()[0]?.enabled ?? true;

        localStreamRef.current = mediaStream;
        isMicOnRef.current = micEnabled;
        isCamOnRef.current = cameraEnabled;

        setLocalStream(mediaStream);
        setIsMicOn(micEnabled);
        setIsCamOn(cameraEnabled);
        setMediaError(null);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        emitLocalMediaState(micEnabled, cameraEnabled);
        emitReadyIfPossible();
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setMediaError(
          "Camera or microphone access is blocked. Chat will still work until permission is granted."
        );
        setIsMicOn(false);
        setIsCamOn(false);
        isMicOnRef.current = false;
        isCamOnRef.current = false;
      });

    return () => {
      isCancelled = true;
      destroyPeerConnection();
      stopLocalMedia(false);

      if (remoteVideoElement) {
        remoteVideoElement.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let disconnect: (() => void) | null = null;

    void connectSessionRoom({
      roomIdentifier: session.roomIdentifier,
      senderName: myName,
      userId: currentUserId,
      bindings: {
        onConnect: () => {
          if (sessionClosedRef.current) {
            return;
          }

          setRoomError(null);
          setConnectionStatus((current) =>
            current === "connected" ? current : "waiting"
          );
        },
        onConnectError: () => {
          if (sessionClosedRef.current) {
            return;
          }

          setRoomError("Unable to connect to the live room right now.");
          setConnectionStatus("reconnecting");
        },
        onDisconnect: () => {
          if (sessionClosedRef.current) {
            return;
          }

          joinedRoomRef.current = false;
          readySentRef.current = false;
          destroyPeerConnection();
          clearRemoteParticipant();
          setConnectionStatus("reconnecting");
        },
        onJoined: () => {
          joinedRoomRef.current = true;
          setRoomError(null);
          emitLocalMediaState();
          emitReadyIfPossible();
        },
        onEvent: (event, payload) => {
          if (event === "chat:history") {
            setMessages(payload as SessionChatMessage[]);
            return;
          }

          if (event === "chat:message") {
            setMessages((prev) => [...prev, payload as SessionChatMessage]);
            return;
          }

          if (event === "media:sync") {
            syncRemoteMediaState(payload as SessionParticipantMediaState[]);
            return;
          }

          if (event === "media:state") {
            const mediaState = payload as SessionParticipantMediaState;

            if (mediaState.userId === currentUserId) {
              return;
            }

            setRemoteMediaState(mediaState);
            return;
          }

          if (event === "room:presence") {
            const presence = payload as SessionRoomPresence;

            setRoomPresence(presence);
            if (presence.participantCount > 1) {
              emitLocalMediaState();
            }
            return;
          }

          if (event === "peer:left") {
            const peerLeft = payload as { userId?: string | null };

            if (peerLeft.userId && peerLeft.userId !== otherUserId) {
              return;
            }

            readySentRef.current = false;
            destroyPeerConnection();
            clearRemoteParticipant();
            setConnectionStatus("waiting");
            return;
          }

          if (event === "whiteboard:draw") {
            setWhiteboardStrokes((prev) => [...prev, ...(payload as WhiteboardStroke[])]);
            return;
          }
          if (event === "whiteboard:clear") {
            setWhiteboardStrokes([]);
            return;
          }
          if (event === "whiteboard:state") {
            const statePayload = payload as { isActive: boolean; isLocked: boolean };
            setIsWhiteboardActive(statePayload.isActive);
            setIsWhiteboardLocked(statePayload.isLocked);
            return;
          }
          if (event === "notes:sync") {
            setNotesContent((payload as { content: string }).content);
            return;
          }
          if (event === "resource:share") {
            setResources((prev) => [...prev, payload as SharedResource]);
            return;
          }
          if (event === "screen:state") {
            return;
          }

          if (event === "session:ended") {
            if (sessionClosedRef.current) {
              return;
            }

            sessionClosedRef.current = true;
            setIsEndingSession(true);
            destroyPeerConnection();
            clearRemoteParticipant();
            stopLocalMedia();
            navigateToDashboard();
            return;
          }

          if (event === "webrtc:peer-ready") {
            if (sessionClosedRef.current) {
              return;
            }

            if (!isHost) {
              if (localStreamRef.current) {
                void emitRoomEvent("webrtc:ready").catch(() => {});
              }
              emitReadyIfPossible();
              return;
            }

            const stream = localStreamRef.current;
            if (!stream) {
              return;
            }

            const existingPeer = peerRef.current;
            if (
              existingPeer &&
              (existingPeer.connectionState === "connecting" ||
                existingPeer.connectionState === "connected")
            ) {
              return;
            }

            void (async () => {
              try {
                setConnectionStatus("connecting");
                const peer = await createPeer(stream);
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                await emitRoomEvent("webrtc:offer", { offer });
              } catch (e: any) {
                destroyPeerConnection();
                setConnectionStatus("reconnecting");
                setRoomError("We hit a connection issue and are retrying. " + String(e));
              }
            })();
            return;
          }

          if (event === "webrtc:offer") {
            if (isHost || sessionClosedRef.current) {
              return;
            }

            const stream = localStreamRef.current;
            if (!stream) {
              pendingOfferRef.current = (payload as { offer: RTCSessionDescriptionInit }).offer;
              return;
            }

            void (async () => {
              try {
                setConnectionStatus("connecting");
                const peer = await createPeer(stream);
                await peer.setRemoteDescription(
                  new RTCSessionDescription(
                    (payload as { offer: RTCSessionDescriptionInit }).offer
                  )
                );
                await flushPendingIceCandidates(peer);
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                await emitRoomEvent("webrtc:answer", { answer });
              } catch (e: any) {
                destroyPeerConnection();
                setConnectionStatus("reconnecting");
                setRoomError("We hit a connection issue and are retrying. " + String(e));
              }
            })();
            return;
          }

          if (event === "webrtc:answer") {
            if (sessionClosedRef.current) {
              return;
            }

            const peer = peerRef.current;
            if (!peer) {
              return;
            }

            void (async () => {
              try {
                await peer.setRemoteDescription(
                  new RTCSessionDescription(
                    (payload as { answer: RTCSessionDescriptionInit }).answer
                  )
                );
                await flushPendingIceCandidates(peer);
              } catch (e: any) {
                destroyPeerConnection();
                setConnectionStatus("reconnecting");
                setRoomError("We hit a connection issue and are retrying. " + String(e));
              }
            })();
            return;
          }

          if (event === "webrtc:ice") {
            if (sessionClosedRef.current) {
              return;
            }

            const peer = peerRef.current;
            if (!peer?.remoteDescription) {
              pendingIceCandidatesRef.current.push(
                (payload as { candidate: RTCIceCandidateInit }).candidate
              );
              return;
            }

            void (async () => {
              try {
                await peer.addIceCandidate(
                  new RTCIceCandidate(
                    (payload as { candidate: RTCIceCandidateInit }).candidate
                  )
                );
              } catch {
                pendingIceCandidatesRef.current.push(
                  (payload as { candidate: RTCIceCandidateInit }).candidate
                );
              }
            })();
          }
        },
      },
    })
      .then((connection) => {
        if (isCancelled) {
          connection.disconnect();
          return;
        }

        roomConnectionRef.current = connection;
        disconnect = connection.disconnect;
      })
      .catch(() => {
        if (!sessionClosedRef.current) {
          setRoomError("Unable to connect to the live room right now.");
          setConnectionStatus("reconnecting");
        }
      });

    return () => {
      isCancelled = true;
      disconnect?.();
      roomConnectionRef.current = null;
      joinedRoomRef.current = false;
      readySentRef.current = false;
    };
  }, [currentUserId, isHost, myName, otherUserId, session.roomIdentifier]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const sendMessage = () => {
    const trimmedMessage = messageInput.trim();
    const connection = roomConnectionRef.current;

    if (!trimmedMessage || !connection) {
      return;
    }

    void connection
      .sendChat({
        content: trimmedMessage,
        roomIdentifier: session.roomIdentifier,
        senderId: currentUserId,
        senderName: myName,
      })
      .then(() => {
        setMessageInput("");
      })
      .catch(() => {
        setRoomError("Unable to send that message right now.");
      });
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    const nextMicState = !isMicOnRef.current;

    if (track) {
      track.enabled = nextMicState;
    }

    isMicOnRef.current = nextMicState;
    setIsMicOn(nextMicState);
    emitLocalMediaState(nextMicState, isCamOnRef.current);
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    const nextCamState = !isCamOnRef.current;

    if (track) {
      track.enabled = nextCamState;
    }

    isCamOnRef.current = nextCamState;
    setIsCamOn(nextCamState);
    emitLocalMediaState(isMicOnRef.current, nextCamState);
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        screenTrackRef.current?.stop();
        screenTrackRef.current = null;
        setIsScreenSharing(false);

        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (peerRef.current && videoTrack) {
          const sender = peerRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        await emitRoomEvent("screen:state", { userId: currentUserId, isSharing: false });
        return;
      }

      if (!navigator.mediaDevices?.getDisplayMedia) {
        setRoomError("Screen sharing is not supported in your browser.");
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;
      setIsScreenSharing(true);

      screenTrack.onended = () => {
        if (isMountedRef.current) toggleScreenShare();
      };

      if (peerRef.current) {
        const sender = peerRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream;
      }
      await emitRoomEvent("screen:state", { userId: currentUserId, isSharing: true });
    } catch (error) {
      console.error("Screen share failed", error);
    }
  };

  const endSession = async () => {
    if (isEndingSession) {
      return;
    }

    setIsEndingSession(true);
    setRoomError(null);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ENDED" }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        setIsEndingSession(false);
        setRoomError(payload?.error ?? "Unable to end the session right now.");
        return;
      }

      sessionClosedRef.current = true;
      await emitRoomEvent("session:end", {
        endedByUserId: currentUserId,
        sessionId: session.id,
      });

      destroyPeerConnection();
      clearRemoteParticipant();
      stopLocalMedia();
      navigateToDashboard();
    } catch {
      setIsEndingSession(false);
      setRoomError("Unable to end the session right now.");
    }
  };

  const copySessionLink = async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    window.setTimeout(() => {
      setCopyState("idle");
    }, 2000);
  };

  const connectionCopy =
    connectionStatus === "reconnecting"
      ? "Reconnecting..."
      : connectionStatus === "connecting"
        ? "Connecting..."
        : "Waiting for participant...";

  const presenceCopy =
    roomPresence.participantCount >= 2
      ? `${roomPresence.participantCount}/2 participants connected`
      : `Waiting for ${otherParticipantName} to open this exact session link`;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white relative">
      {/* DEBUG OVERLAY */}
      <div className="absolute top-0 right-[320px] bg-red-900 text-white p-2 z-[999] font-mono text-[10px] whitespace-pre-wrap opacity-80 pointer-events-auto">
        host: {isHost ? "Y" : "N"}{"\n"}
        cUserId: {currentUserId}{"\n"}
        count: {roomPresence.participantCount}{"\n"}
        presIds: {roomPresence.participantUserIds.join(",")}{"\n"}
        conn: {connectionStatus}{"\n"}
        rdy: {readySentRef.current ? "Y" : "N"}{"\n"}
        stream: {localStreamRef.current ? "Y" : "N"}
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-gray-900">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />

        {isWhiteboardActive && (
          <SessionWhiteboard
            strokes={whiteboardStrokes}
            isTeacher={isHost}
            isLocked={isWhiteboardLocked}
            onToggleLock={() => {
              const newState = !isWhiteboardLocked;
              setIsWhiteboardLocked(newState);
              emitRoomEvent("whiteboard:state", { isActive: isWhiteboardActive, isLocked: newState }).catch(() => {});
            }}
            onDraw={(strokes) => {
              setWhiteboardStrokes((p) => [...p, ...strokes]);
              emitRoomEvent("whiteboard:draw", strokes).catch(() => {});
            }}
            onClear={() => {
              setWhiteboardStrokes([]);
              emitRoomEvent("whiteboard:clear").catch(() => {});
            }}
          />
        )}

        {connectionStatus !== "connected" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-light italic text-gray-400">
              {connectionCopy}
            </p>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 flex w-[min(92%,680px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl bg-black/45 px-4 py-3 text-sm text-gray-200 backdrop-blur-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-400"
                    : "animate-pulse bg-gray-400"
                }`}
              />
              <span className="font-medium">Live room {roomCode}</span>
              {remoteMediaState?.micEnabled === false && (
                <span className="text-xs text-gray-300">Mic off</span>
              )}
              {remoteMediaState?.cameraEnabled === false && (
                <span className="text-xs text-gray-300">Cam off</span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-gray-300">{presenceCopy}</p>
            {roomPresence.participantCount < 2 && (
              <p className="mt-1 truncate text-[11px] text-gray-400">
                If the other screen shows a different room code, you are in different sessions.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={copySessionLink}
            className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
          >
            {copyState === "copied"
              ? "Link copied"
              : copyState === "error"
                ? "Copy failed"
                : "Copy link"}
          </button>
        </div>
      </div>

      <div className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-white">
        <div className="flex flex-col gap-3 p-4 shrink-0">
          <div className="relative w-full">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full rounded-lg bg-gray-900 object-cover shadow-sm"
            />
            {!localStream && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/80 px-4 text-center text-xs text-gray-200">
                {mediaError ?? "Camera preview unavailable"}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-white shadow-md mb-2">
              {myName.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-sm font-bold text-gray-800">{myName}</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mt-0.5">
              {isHost ? "Teacher" : "Learner"}
            </p>
          </div>

          {mediaError && (
            <p className="text-center text-[10px] font-medium text-rose-500 bg-rose-50 rounded-md py-1 px-2">{mediaError}</p>
          )}
          {roomError && (
            <p className="text-center text-[10px] font-medium text-rose-500 bg-rose-50 rounded-md py-1 px-2">{roomError}</p>
          )}

          <div className="grid grid-cols-2 w-full gap-2 mt-1">
            <button
              onClick={toggleMic}
              disabled={!localStream}
              className={`rounded-md border py-1.5 text-[11px] font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 flex justify-center items-center gap-1.5 ${isMicOn ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
            >
              <div className={`w-2 h-2 rounded-full ${isMicOn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {isMicOn ? "Mic On" : "Mic Off"}
            </button>
            <button
              onClick={toggleCam}
              disabled={!localStream}
              className={`rounded-md border py-1.5 text-[11px] font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 flex justify-center items-center gap-1.5 ${isCamOn ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
            >
              <div className={`w-2 h-2 rounded-full ${isCamOn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {isCamOn ? "Cam On" : "Cam Off"}
            </button>
            <button
              onClick={() => {
                const newState = !isWhiteboardActive;
                setIsWhiteboardActive(newState);
                emitRoomEvent("whiteboard:state", { isActive: newState, isLocked: isWhiteboardLocked }).catch(() => {});
              }}
              className={`rounded-md border py-1.5 text-[11px] font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 ${isWhiteboardActive ? 'border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {isWhiteboardActive ? "Hide Board" : "Whiteboard"}
            </button>
            <button
              onClick={toggleScreenShare}
              disabled={!localStream}
              className={`rounded-md border py-1.5 text-[11px] font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 ${isScreenSharing ? 'border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {isScreenSharing ? "Stop Share" : "Screen Share"}
            </button>
          </div>

          <button
            onClick={endSession}
            disabled={isEndingSession}
            className="w-full rounded-md bg-rose-500 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all mt-0.5"
          >
            {isEndingSession ? "Ending Session..." : "End Session"}
          </button>
        </div>

        <div className="border-t border-gray-200" />

        <div className="flex border-b border-gray-100 bg-[#fafafa]">
          {(["CHAT", "NOTES", "FILES", "SUMMARY", "AI"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-4 text-[10px] font-bold transition-colors ${
                activeTab === tab
                  ? "text-emerald-500 border-b-2 border-emerald-500 bg-white"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden relative bg-[#fafafa]">
          <div className={`absolute inset-0 flex flex-col ${activeTab === 'CHAT' ? '' : 'hidden'}`}>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{msg.senderName}</span>
                    <span className="text-xs text-gray-400" suppressHydrationWarning>
                      {hasHydrated ? formatTime(msg.createdAt) : ""}
                    </span>
                  </div>
                  <div className="text-gray-600">{msg.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2 border-t border-gray-200 p-4 bg-white">
              <input
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim()}
                className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
          
          {activeTab === 'NOTES' && (
            <div className="absolute inset-0">
              <SessionNotes 
                content={notesContent} 
                onContentChange={(content) => {
                  setNotesContent(content);
                  emitRoomEvent("notes:sync", { content }).catch(()=>{});
                }} 
              />
            </div>
          )}

          {activeTab === 'FILES' && (
            <div className="absolute inset-0">
              <SessionResources 
                resources={resources} 
                onAddResource={(res) => {
                  setResources((prev) => [...prev, res]);
                  emitRoomEvent("resource:share", res).catch(()=>{});
                }}
                currentUserName={myName}
              />
            </div>
          )}

          {activeTab === 'SUMMARY' && (
            <div className="absolute inset-0">
              <SessionSummaryTab sessionId={session.id} messages={messages} />
            </div>
          )}

          {activeTab === 'AI' && (
            <div className="absolute inset-0 flex flex-col bg-[#fafafa]">
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {aiMessages.length === 0 && (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm font-medium text-gray-400">Ask your AI tutor anything...</p>
                  </div>
                )}
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-emerald-500 text-white rounded-br-none'
                        : 'bg-indigo-50 text-indigo-900 border border-indigo-100 rounded-bl-none shadow-sm'
                    }`}>
                      <div className={`text-[10px] font-bold mb-1 uppercase tracking-wide ${msg.role === 'user' ? 'opacity-70' : 'text-indigo-400'}`}>
                        {msg.role === 'user' ? myName : 'AI Tutor'}
                      </div>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-indigo-50 text-indigo-900 border border-indigo-100 rounded-bl-none shadow-sm">
                      <div className="flex gap-1 items-center h-5">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: "0ms"}}></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: "150ms"}}></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: "300ms"}}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 border-t border-gray-200 p-4 bg-white">
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiSend()}
                  placeholder="Ask your AI tutor anything..."
                  className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  disabled={aiLoading}
                />
                <button
                  onClick={handleAiSend}
                  disabled={!aiInput.trim() || aiLoading}
                  className="rounded-full bg-indigo-500 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  Ask
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
