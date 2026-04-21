"use client";

type CreatePeerConnectionOptions = {
  iceServers?: RTCIceServer[] | null;
  localStream: MediaStream;
  onConnectionStateChange?: (
    state: RTCPeerConnectionState,
    peer: RTCPeerConnection
  ) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onRemoteStream?: (stream: MediaStream) => void;
};

const FALLBACK_RTC_CONFIGURATION: RTCConfiguration = {
  iceCandidatePoolSize: 10,
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
};

function assertBrowserApi<T>(
  value: T | undefined,
  message: string
): asserts value is T {
  if (typeof window === "undefined" || !value) {
    throw new Error(message);
  }
}

export function attachMediaStream(
  element: HTMLMediaElement | null,
  stream: MediaStream | null
) {
  if (!element || element.srcObject === stream) {
    return;
  }

  element.srcObject = stream;
}

export async function getLocalUserMedia() {
  assertBrowserApi(
    navigator?.mediaDevices?.getUserMedia,
    "Media devices are unavailable in this environment."
  );

  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export async function createPeerConnection({
  iceServers,
  localStream,
  onConnectionStateChange,
  onIceCandidate,
  onRemoteStream,
}: CreatePeerConnectionOptions) {
  assertBrowserApi(
    window.RTCPeerConnection,
    "WebRTC peer connections are unavailable in this browser."
  );

  const peer = new RTCPeerConnection({
    iceCandidatePoolSize: FALLBACK_RTC_CONFIGURATION.iceCandidatePoolSize,
    iceServers:
      iceServers && iceServers.length > 0
        ? iceServers
        : FALLBACK_RTC_CONFIGURATION.iceServers,
  });
  const remoteStream = new MediaStream();

  for (const track of localStream.getTracks()) {
    peer.addTrack(track, localStream);
  }

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate?.(event.candidate);
    }
  };

  peer.ontrack = (event) => {
    const [incomingStream] = event.streams;

    if (incomingStream) {
      onRemoteStream?.(incomingStream);
      return;
    }

    remoteStream.addTrack(event.track);
    onRemoteStream?.(remoteStream);
  };

  peer.onconnectionstatechange = () => {
    onConnectionStateChange?.(peer.connectionState, peer);
  };

  return peer;
}

export async function createPeerOffer(peer: RTCPeerConnection) {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  return offer;
}

export async function createPeerAnswer(peer: RTCPeerConnection) {
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  return answer;
}

export async function applyRemoteDescription(
  peer: RTCPeerConnection,
  description: RTCSessionDescriptionInit
) {
  await peer.setRemoteDescription(new RTCSessionDescription(description));
}

export async function addPeerIceCandidate(
  peer: RTCPeerConnection,
  candidate: RTCIceCandidateInit
) {
  await peer.addIceCandidate(new RTCIceCandidate(candidate));
}

export function closePeerConnection(peer: RTCPeerConnection | null) {
  if (!peer) {
    return;
  }

  peer.ontrack = null;
  peer.onicecandidate = null;
  peer.onconnectionstatechange = null;

  if (peer.signalingState !== "closed") {
    peer.close();
  }
}
