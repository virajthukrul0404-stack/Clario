const PRESENCE_CHANNEL_PREFIX = "presence-";

export function getRealtimeChannelName(roomIdentifier: string) {
  return `${PRESENCE_CHANNEL_PREFIX}${roomIdentifier}`;
}

export function getRoomIdentifierFromChannelName(channelName: string) {
  if (!channelName.startsWith(PRESENCE_CHANNEL_PREFIX)) {
    return null;
  }

  const roomIdentifier = channelName.slice(PRESENCE_CHANNEL_PREFIX.length).trim();
  return roomIdentifier || null;
}
