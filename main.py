from http.server import BaseHTTPRequestHandler, HTTPServer
import os

PORT=int(os.getenv("PORT",8000))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"XPS RUNNING")

HTTPServer(("",PORT),Handler).serve_forever()
