// Communica backend — public surface of the Step 7 skeletons.
// Route layers (Next.js API routes in production) import the function
// they need from here and wire the Db / adapter implementations
// (Prisma Client, bcrypt, jsonwebtoken, Socket.io) around them.
// This file imports no runtime dependency itself.

export * from "./errors";
export * from "./types";
export * from "./auth";
export * from "./users";
export * from "./chats";
export * from "./messages";
export * from "./media";
export * from "./calls";
export * from "./sazmu";
export * from "./socket";
