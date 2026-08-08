export function getTotalClientInRoom(io, roomName) {
    const rooms = io?.sockets?.adapter?.rooms || io?.rooms;

    if (!rooms || typeof rooms.get !== "function") {
        return 0;
    }

    const room = rooms.get(roomName) || rooms.get(String(roomName)) || rooms.get(Number(roomName));
    return room ? room.size : 0;
}
