export function checkLogin(socket) {
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
}
