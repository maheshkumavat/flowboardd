const express = require('express');
const http = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);

  // Initialize Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  // Attach Socket.io to Express request object
  server.use((req, res, nextMiddleware) => {
    req.io = io;
    nextMiddleware();
  });

  // Socket.io connection handlers
  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join project room for live board updates
    socket.on('join:project', (projectId) => {
      if (projectId) {
        socket.join(`project:${projectId}`);
        console.log(`[Socket.io] Socket ${socket.id} joined room project:${projectId}`);
      }
    });

    // Leave project room
    socket.on('leave:project', (projectId) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
        console.log(`[Socket.io] Socket ${socket.id} left room project:${projectId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  // Express body parsers
  server.use(express.json());
  server.use(express.urlencoded({ extended: true }));

  // Fallback Next.js page & API handler
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> FlowBoard Server ready on http://${hostname}:${port}`);
    console.log(`> Real-time WebSockets enabled via Socket.io`);
  });
});
